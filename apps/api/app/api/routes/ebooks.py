from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile, status

from app.api.deps import Identity, get_llm_provider, rate_limited, resolve_identity
from app.models.ebook import (
    ComparisonLanguage,
    CreateOnDemandAnnotationRequest,
    CreateStudyPackRequest,
    EbookAnnotationResponse,
    EbookLearningTargetListResponse,
    EbookLearningTargetResponse,
    EbookListResponse,
    EbookPageListResponse,
    EbookPracticeAttemptResponse,
    EbookPracticeSessionResponse,
    EbookResponse,
    EbookStudyPackResponse,
    SubmitEbookPracticeAttemptRequest,
    UpdateEbookRequest,
)
from app.services.ai_client import LLMProviderConfig
from app.services.ebook_service import (
    EbookImportError,
    EbookProcessingError,
    begin_ebook_import,
    create_on_demand_annotation,
    create_study_pack,
    delete_book_for_user,
    get_book_for_user,
    get_study_pack_for_user,
    list_books_for_user,
    list_learning_targets_for_user,
    mark_annotation_unfamiliar,
    process_ebook_import,
    process_study_pack,
    read_book_pages,
    remove_learning_target,
    start_practice_session,
    submit_practice_attempt,
    update_book_language,
)


router = APIRouter()


def _signed_in(identity: Identity) -> Identity:
    if identity.kind == "guest":
        raise HTTPException(
            status_code=401,
            detail={
                "code": "ebook_login_required",
                "message": "Sign in before importing a private ebook.",
            },
        )
    return identity


@router.post("/ebooks/import", status_code=status.HTTP_202_ACCEPTED, response_model=EbookResponse)
def import_ebook(
    background_tasks: BackgroundTasks,
    response: Response,
    file: Annotated[UploadFile, File()],
    comparison_language: Annotated[ComparisonLanguage, Form(alias="comparisonLanguage")],
    rights_confirmed: Annotated[bool, Form(alias="rightsConfirmed")],
    identity: Identity = Depends(resolve_identity),
):
    _signed_in(identity)
    if not rights_confirmed:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "ebook_rights_confirmation_required",
                "message": "Confirm that you have the right to process this ebook.",
            },
        )
    try:
        book, temporary_path = begin_ebook_import(
            identity.user_id,
            filename=file.filename or "ebook",
            file_object=file.file,
            comparison_language=comparison_language,
        )
        if temporary_path:
            background_tasks.add_task(
                process_ebook_import,
                identity.user_id,
                book["id"],
                temporary_path,
            )
        elif book.get("status") == "ready":
            response.status_code = status.HTTP_200_OK
        return {"book": book}
    except EbookImportError as exc:
        raise HTTPException(status_code=400, detail={"code": "invalid_ebook", "message": str(exc)}) from exc


@router.get("/ebooks", response_model=EbookListResponse)
def list_ebooks(identity: Identity = Depends(resolve_identity)):
    _signed_in(identity)
    books = list_books_for_user(identity.user_id)
    return {"books": books, "count": len(books)}


@router.get("/ebooks/{book_id}", response_model=EbookResponse)
def get_ebook(book_id: str, identity: Identity = Depends(resolve_identity)):
    _signed_in(identity)
    book = get_book_for_user(identity.user_id, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Ebook not found.")
    return {"book": book}


@router.patch("/ebooks/{book_id}", response_model=EbookResponse)
def patch_ebook(
    book_id: str,
    req: UpdateEbookRequest,
    identity: Identity = Depends(resolve_identity),
):
    _signed_in(identity)
    try:
        return {"book": update_book_language(identity.user_id, book_id, req.comparisonLanguage)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/ebooks/{book_id}")
def delete_ebook(book_id: str, identity: Identity = Depends(resolve_identity)):
    _signed_in(identity)
    try:
        return delete_book_for_user(identity.user_id, book_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/ebooks/{book_id}/pages", response_model=EbookPageListResponse)
def get_pages(
    book_id: str,
    start_page: int = Query(alias="startPage", ge=1),
    end_page: int = Query(alias="endPage", ge=1),
    identity: Identity = Depends(resolve_identity),
):
    _signed_in(identity)
    try:
        pages = read_book_pages(identity.user_id, book_id, start_page, end_page)
        return {"pages": pages, "count": len(pages)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/ebooks/{book_id}/study-packs",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EbookStudyPackResponse,
)
def start_study_pack(
    book_id: str,
    req: CreateStudyPackRequest,
    background_tasks: BackgroundTasks,
    response: Response,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("ebook_study")),
):
    _signed_in(identity)
    try:
        pack = create_study_pack(identity.user_id, book_id, req)
        dispatch = bool(pack.pop("_dispatch", False))
        claim_id = pack.pop("_claimId", None)
        if dispatch:
            background_tasks.add_task(
                process_study_pack,
                identity.user_id,
                pack["id"],
                llm_provider,
                None if identity.has_unlimited_llm_quota else identity.max_output_tokens,
                claim_id,
            )
        elif pack.get("status") == "ready":
            response.status_code = status.HTTP_200_OK
        return {"studyPack": pack}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/ebook-study-packs/{pack_id}", response_model=EbookStudyPackResponse)
def get_study_pack(pack_id: str, identity: Identity = Depends(resolve_identity)):
    _signed_in(identity)
    pack = get_study_pack_for_user(identity.user_id, pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Ebook study pack not found.")
    return {"studyPack": pack}


@router.post("/ebook-study-packs/{pack_id}/annotations", response_model=EbookAnnotationResponse)
def add_annotation(
    pack_id: str,
    req: CreateOnDemandAnnotationRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("ebook_annotation")),
):
    _signed_in(identity)
    try:
        annotation = create_on_demand_annotation(
            identity.user_id,
            pack_id,
            req,
            llm_provider,
            None if identity.has_unlimited_llm_quota else identity.max_output_tokens,
        )
        return {"annotation": annotation}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ValueError, EbookProcessingError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/ebook-annotations/{annotation_id}/learning-target",
    response_model=EbookLearningTargetResponse,
)
def create_learning_target(
    annotation_id: str,
    identity: Identity = Depends(rate_limited("notes")),
):
    _signed_in(identity)
    try:
        return {"target": mark_annotation_unfamiliar(identity.user_id, annotation_id)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/ebook-learning-targets", response_model=EbookLearningTargetListResponse)
def list_learning_targets(
    due_only: bool = Query(default=False, alias="dueOnly"),
    identity: Identity = Depends(resolve_identity),
):
    _signed_in(identity)
    targets = list_learning_targets_for_user(identity.user_id, due_only=due_only)
    return {"targets": targets, "count": len(targets)}


@router.delete("/ebook-learning-targets/{target_id}")
def delete_learning_target(target_id: str, identity: Identity = Depends(resolve_identity)):
    _signed_in(identity)
    try:
        return remove_learning_target(identity.user_id, target_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/ebook-learning-targets/{target_id}/practice-sessions",
    response_model=EbookPracticeSessionResponse,
)
def create_practice_session(
    target_id: str,
    identity: Identity = Depends(rate_limited("ebook_practice")),
):
    _signed_in(identity)
    try:
        return {"session": start_practice_session(identity.user_id, target_id)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/ebook-practice-sessions/{session_id}/attempts",
    response_model=EbookPracticeAttemptResponse,
)
def submit_attempt(
    session_id: str,
    req: SubmitEbookPracticeAttemptRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("ebook_practice")),
):
    _signed_in(identity)
    try:
        return submit_practice_attempt(identity.user_id, session_id, req, llm_provider)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
