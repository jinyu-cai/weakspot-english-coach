"""Contract tests for conservative evidence from short writing diagnoses."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from scripts.postgres_test import mock_postgres
from pydantic import ValidationError

from app.api.routes.diagnose import (
    _grounded_error_occurrence_count,
    _grounded_memory_candidate,
    _plain_diagnosis_evidence,
)
from app.models.diagnostic import (
    DiagnosticAIResult,
    DiagnosticErrorAI,
    TargetEvidenceAI,
)
from app.models.learning import RecordEvidenceRequest
from app.models.memory import MemoryCandidate
from app.services.diagnose_service import build_diagnose_user_prompt
from app.services.learning_service import RECENT_EVIDENCE_WINDOW, record_evidence
from app.services.memory_service import _verification_snapshot
from scripts.create_table import create_table


def _diagnostic(*, target_evidence: list[TargetEvidenceAI]) -> DiagnosticAIResult:
    return DiagnosticAIResult(
        cefrEstimate="B1",
        overallScore=78,
        summaryZh="Clear short answer.",
        strengthsZh=["The past tense is used correctly."],
        weaknessesZh=["An article is missing."],
        correctedText="Yesterday I went to the library.",
        naturalRewrite=None,
        errors=[],
        recommendedNextActionsZh=["Review articles."],
        learningNotes=[],
        memoryCandidates=[],
        targetEvidence=target_evidence,
    )


def main() -> int:
    prompt = build_diagnose_user_prompt("Yesterday I went to library.")
    assert "independent SUCCESS observations" in prompt
    assert "Do not infer success" in prompt

    try:
        DiagnosticErrorAI(
            code="grammar.tense",
            category="Tense",
            severity="medium",
            originalText="I go yesterday",
            correctedText="I went yesterday",
            explanationZh="Use the past tense.",
            microLessonZh="Go becomes went.",
            practiceGoal="Practice the past tense.",
        )
        raise AssertionError("An unsupported diagnostic code was accepted.")
    except ValidationError:
        pass

    diagnostic = _diagnostic(target_evidence=[
        TargetEvidenceAI(
            skillCode="grammar.verb_tense",
            opportunityPresent=True,
            outcome="success",
            evidenceQuote="Yesterday I went",
            confidence=0.91,
        ),
        TargetEvidenceAI(
            skillCode="grammar.article",
            opportunityPresent=True,
            outcome="success",
            evidenceQuote="to library",
            confidence=0.9,
        ),
        TargetEvidenceAI(
            skillCode="grammar.preposition",
            opportunityPresent=True,
            outcome="success",
            evidenceQuote="a quote that is not in the answer",
            confidence=0.99,
        ),
    ])
    evidence = _plain_diagnosis_evidence(
        "Yesterday I went to library.",
        diagnostic,
        [{
            "code": "grammar.article",
            "severity": "medium",
            "originalText": "to library",
        }, {
            "code": "grammar.article",
            "severity": "low",
            "originalText": "at school",
        }],
    )
    assert [item["skillCode"] for item in evidence] == [
        "grammar.article",
        "grammar.verb_tense",
    ]
    assert [item["outcome"] for item in evidence] == ["failure", "success"]
    assert evidence[0]["occurrenceCount"] == 1
    assert _grounded_error_occurrence_count(
        "Yesterday I went to library.",
        [
            {"code": "grammar.article", "originalText": "to library"},
            {"code": "grammar.article", "originalText": "at school"},
        ],
        "grammar.article",
    ) == 1
    assert _grounded_memory_candidate(
        "Yesterday I went to library.",
        MemoryCandidate(
            kind="weakness",
            canonicalKey="weakness.grammar.article",
            content="The learner needs article practice.",
            evidence="to library → to the library",
        ),
    )
    assert not _grounded_memory_candidate(
        "Yesterday I went to library.",
        MemoryCandidate(
            kind="weakness",
            canonicalKey="weakness.grammar.article",
            content="The learner needs article practice.",
            evidence="at school → at the school",
        ),
    )

    now = datetime.now(timezone.utc)
    one_source = _verification_snapshot(
        confidence=0.92,
        source_refs=[{
            "sourceType": "diagnosis",
            "sourceId": "submission-1",
            "createdAt": "2026-07-28T10:00:00Z",
        }],
        source_type="diagnosis",
        now=now,
        memory_kind="weakness",
    )
    assert one_source["state"] == "candidate"
    two_sources = _verification_snapshot(
        confidence=0.95,
        source_refs=[
            {
                "sourceType": "diagnosis",
                "sourceId": "submission-1",
                "createdAt": "2026-07-28T10:00:00Z",
            },
            {
                "sourceType": "diagnosis",
                "sourceId": "submission-2",
                "createdAt": "2026-07-28T11:00:00Z",
            },
        ],
        source_type="diagnosis",
        now=now,
        memory_kind="weakness",
    )
    assert two_sources["state"] == "observed"
    assert two_sources["needsConfirmation"] is True
    three_across_days = _verification_snapshot(
        confidence=0.97,
        source_refs=[
            {
                "sourceType": "diagnosis",
                "sourceId": "submission-1",
                "createdAt": "2026-07-28T10:00:00Z",
            },
            {
                "sourceType": "diagnosis",
                "sourceId": "submission-2",
                "createdAt": "2026-07-28T11:00:00Z",
            },
            {
                "sourceType": "diagnosis",
                "sourceId": "submission-3",
                "createdAt": "2026-07-29T09:00:00Z",
            },
        ],
        source_type="diagnosis",
        now=now,
        memory_kind="weakness",
    )
    assert three_across_days["state"] == "confirmed"
    assert three_across_days["independentDayCount"] == 2
    manual = _verification_snapshot(
        confidence=1.0,
        source_refs=[{
            "sourceType": "manual",
            "sourceId": "manual-1",
            "createdAt": "2026-07-29T10:00:00Z",
        }],
        source_type="manual",
        now=now,
        memory_kind="weakness",
    )
    assert manual["state"] == "confirmed"
    assert manual["policy"] == "learner-confirmed-v1"

    with mock_postgres():
        create_table()
        user_id = "single-sentence-evidence"
        latest = None
        for index in range(RECENT_EVIDENCE_WINDOW + 5):
            outcome = "failure" if index % 5 == 0 else "success"
            latest = record_evidence(
                user_id,
                RecordEvidenceRequest(
                    clientEventId=f"single-sentence-{index}",
                    sourceId=f"submission-{index}",
                    skillCode="grammar.verb_tense",
                    outcome=outcome,
                    opportunityPresent=True,
                    modality="writing",
                    taskType="writing_diagnosis",
                    evaluatorConfidence=0.9,
                    occurrenceCount=2 if outcome == "failure" else 1,
                    contextKey="writing:freeform",
                    evidenceQuote="Yesterday I went.",
                ),
            )
        state = latest["state"]
        assert state["opportunityCount"] == RECENT_EVIDENCE_WINDOW + 5
        assert state["recentOpportunityCount"] == RECENT_EVIDENCE_WINDOW
        assert len(state["recentEvidence"]) == RECENT_EVIDENCE_WINDOW
        assert state["failureOccurrenceCount"] == 10
        assert state["recentFailureCount"] == 4
        assert state["recentFailureOccurrenceCount"] == 8
        assert state["recentErrorRate"] == 0.2
        assert state["recentIndependentSuccessRate"] == 0.8

    print("SINGLE-SENTENCE EVIDENCE TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
