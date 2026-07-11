import asyncio
import json
import logging
import time
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse

from app.api.deps import Identity, get_llm_provider, rate_limited
from app.core.mastery import update_skill_from_error
from app.core.taxonomy import ERROR_TAXONOMY
from app.db.repositories import (
    get_or_create_profile,
    list_skills,
    now_iso,
    put_skill,
    save_error,
    save_note,
    save_profile,
    save_submission,
)
from app.models.chat_import import ChatImportAnalyzeRequest
from app.services.ai_client import LLMProviderConfig
from app.services.chat_import_service import (
    MAX_MESSAGE_CHARS,
    MAX_TRANSCRIPT_CHARS,
    analyze_imported_chat,
    build_chat_transcript,
    select_chat_import_model,
)
from app.services.memory_service import (
    heuristic_memory_candidates,
    memory_candidates_from_errors,
    remember_candidates,
    retrieve_memory_pack,
)

router = APIRouter()
logger = logging.getLogger("uvicorn.error")
PLATFORM_IMPORT_CONVERSATION_LIMIT = 20
PLATFORM_IMPORT_MESSAGE_LIMIT = 120


def _enforce_platform_import_limits(req: ChatImportAnalyzeRequest, identity: Identity) -> None:
    if identity.has_unlimited_llm_quota:
        return
    if len(req.conversations) > PLATFORM_IMPORT_CONVERSATION_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Chat import is limited to {PLATFORM_IMPORT_CONVERSATION_LIMIT} conversations for the current access tier.",
        )
    if any(len(conversation.messages) > PLATFORM_IMPORT_MESSAGE_LIMIT for conversation in req.conversations):
        raise HTTPException(
            status_code=400,
            detail=f"Each imported conversation is limited to {PLATFORM_IMPORT_MESSAGE_LIMIT} messages for the current access tier.",
        )


def elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


@router.post("/chat-import/analyze")
async def analyze_chat_import(
    req: ChatImportAnalyzeRequest,
    response: Response,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("chat_import")),
):
    req.userId = identity.user_id
    request_id = uuid4().hex[:10]
    started = time.perf_counter()
    selected_model = select_chat_import_model(req.analysisMode, llm_provider=llm_provider)

    _enforce_platform_import_limits(req, identity)

    response_headers = {
        "X-Request-ID": request_id,
        "X-Analysis-Mode": req.analysisMode,
        "X-LLM-Model": selected_model or "unconfigured",
        "X-Accel-Buffering": "no",
    }
    loop = asyncio.get_running_loop()

    async def generate():
        future = loop.run_in_executor(
            None,
            lambda: _analyze_chat_import_and_persist(
                req=req,
                identity=identity,
                llm_provider=llm_provider,
                request_id=request_id,
                started=started,
                selected_model=selected_model,
            ),
        )

        yield b" "

        while not future.done():
            await asyncio.sleep(10)
            if not future.done():
                yield b" "

        try:
            result = future.result()
        except ValueError as e:
            logger.exception("chat_import[%s] ai_error total_ms=%d", request_id, elapsed_ms(started))
            result = {"error": True, "detail": f"AI error [{request_id}]: {e}"}
        except Exception as e:
            logger.exception("chat_import[%s] server_error total_ms=%d", request_id, elapsed_ms(started))
            result = {"error": True, "detail": f"Request {request_id} failed: {e}"}

        yield json.dumps(result, ensure_ascii=False, default=_json_default).encode()

    stream = StreamingResponse(generate(), media_type="application/json", headers=response_headers)
    for name, value in response.raw_headers:
        if name.lower() == b"set-cookie":
            stream.raw_headers.append((name, value))
    return stream


def _json_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    return str(obj)


def _analyze_chat_import_and_persist(
    *,
    req: ChatImportAnalyzeRequest,
    identity: Identity,
    llm_provider: LLMProviderConfig | None,
    request_id: str,
    started: float,
    selected_model: str,
):
    message_count = sum(len(c.messages) for c in req.conversations)
    user_message_count = sum(1 for c in req.conversations for m in c.messages if m.role == "user")
    assistant_message_count = sum(1 for c in req.conversations for m in c.messages if m.role == "assistant")
    transcript = build_chat_transcript(req.conversations, char_budget=2800)

    logger.info(
        "chat_import[%s] start user_id=%s mode=%s model=%s conversations=%d messages=%d provider=%s",
        request_id,
        req.userId,
        req.analysisMode,
        selected_model or "unconfigured",
        len(req.conversations),
        message_count,
        "custom" if llm_provider else "server-default",
    )

    try:
        memory_pack = retrieve_memory_pack(
            req.userId,
            f"Analyze imported English-learning conversations: {transcript}",
            purpose="chat_import",
        )
    except Exception:
        logger.exception("chat_import[%s] memory_retrieval_error", request_id)
        memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}

    analysis = analyze_imported_chat(
        req.conversations,
        analysis_mode=req.analysisMode,
        output_language=req.outputLanguage,
        llm_provider=llm_provider,
        max_tokens=None if identity.has_unlimited_llm_quota else identity.max_output_tokens,
        transcript_char_budget=None if identity.has_unlimited_llm_quota else MAX_TRANSCRIPT_CHARS,
        message_char_limit=None if identity.has_unlimited_llm_quota else MAX_MESSAGE_CHARS,
        trace_id=request_id,
        memory_context=memory_pack.get("text"),
    )

    now = now_iso()
    profile = get_or_create_profile(req.userId)
    submission_id = f"chat_{uuid4().hex[:12]}"
    submission = {
        "id": submission_id,
        "userId": req.userId,
        "mode": "chat",
        "originalText": transcript,
        "correctedText": analysis.summaryZh,
        "cefrEstimate": analysis.cefrEstimate.value,
        "summaryZh": analysis.summaryZh,
        "sourceName": req.sourceName,
        "outputLanguage": req.outputLanguage,
        "conversationCount": len(req.conversations),
        "messageCount": message_count,
        "createdAt": now,
    }
    save_submission(submission)

    existing_skills = {s["skillCode"]: s for s in list_skills(req.userId)}
    saved_errors = []
    updated_skills = []

    for weakness in analysis.weaknesses:
        error_id = f"err_{uuid4().hex[:12]}"
        error = {
            "id": error_id,
            "userId": req.userId,
            "submissionId": submission_id,
            "code": weakness.code,
            "category": weakness.category,
            "severity": weakness.severity.value,
            "originalText": weakness.evidenceQuote,
            "correctedText": weakness.suggestedBetterEnglish,
            "explanationZh": weakness.explanationZh,
            "microLessonZh": weakness.microLessonZh,
            "practiceGoal": weakness.practiceGoal,
            "evidenceType": weakness.evidenceType,
            "confidence": weakness.confidence,
            "createdAt": now,
        }
        save_error(error)
        saved_errors.append(error)

        taxonomy = ERROR_TAXONOMY.get(weakness.code, {"label": weakness.category, "zhLabel": weakness.category})
        skill = update_skill_from_error(
            existing=existing_skills.get(weakness.code),
            user_id=req.userId,
            skill_code=weakness.code,
            label=taxonomy["label"],
            zh_label=taxonomy["zhLabel"],
            severity=weakness.severity.value,
            now=now,
        )
        put_skill(skill)
        existing_skills[weakness.code] = skill
        updated_skills.append(skill)

    saved_notes = []
    for note_ai in analysis.learningNotes:
        note_id = f"note_{uuid4().hex[:12]}"
        note = {
            "id": note_id,
            "userId": req.userId,
            "submissionId": submission_id,
            "type": note_ai.type,
            "topic": note_ai.topic,
            "original": note_ai.original,
            "natural": note_ai.natural,
            "explanation": note_ai.explanation,
            "context": note_ai.context,
            "examples": note_ai.examples,
            "createdAt": now,
        }
        save_note(note)
        saved_notes.append(note)

    profile["estimatedLevel"] = analysis.cefrEstimate.value
    profile["totalSubmissions"] = int(profile.get("totalSubmissions", 0)) + 1
    profile["updatedAt"] = now
    save_profile(profile)

    learner_text = " ".join(
        message.text
        for conversation in req.conversations
        for message in conversation.messages
        if message.role == "user"
    )
    try:
        saved_memories = remember_candidates(
            req.userId,
            [
                *analysis.memoryCandidates,
                *heuristic_memory_candidates(learner_text),
                *memory_candidates_from_errors(saved_errors),
            ],
            source_type="chat_import",
            source_id=submission_id,
        )
    except Exception:
        logger.exception("chat_import[%s] memory_persist_error", request_id)
        saved_memories = []

    logger.info(
        "chat_import[%s] complete total_ms=%d weaknesses=%d updated_skills=%d notes=%d",
        request_id,
        elapsed_ms(started),
        len(saved_errors),
        len(updated_skills),
        len(saved_notes),
    )

    return {
        "submission": submission,
        "analysis": analysis.model_dump(mode="json"),
        "savedErrors": saved_errors,
        "updatedSkills": updated_skills,
        "notes": saved_notes,
        "profile": profile,
        "memoriesSaved": saved_memories,
        "memoryRecall": {
            "traceId": memory_pack.get("traceId"),
            "memoryIds": [item.get("id") for item in memory_pack.get("items", [])],
            "estimatedTokens": memory_pack.get("estimatedTokens", 0),
        },
        "importStats": {
            "conversationCount": len(req.conversations),
            "messageCount": message_count,
            "userMessageCount": user_message_count,
            "assistantMessageCount": assistant_message_count,
        },
    }
