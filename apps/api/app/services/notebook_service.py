from collections import defaultdict

from app.db.repositories import list_memories, list_notes


def _weakness_skill_code(memory: dict) -> str:
    fingerprint = memory.get("errorFingerprint")
    if isinstance(fingerprint, dict) and fingerprint.get("skillCode"):
        return str(fingerprint["skillCode"])
    canonical_key = str(memory.get("canonicalKey") or "")
    return canonical_key.removeprefix("weakness.")


def _source_ids(memory: dict) -> set[str]:
    source_ids = {str(memory.get("sourceId") or "").strip()}
    source_ids.update(
        str(ref.get("sourceId") or "").strip()
        for ref in memory.get("sourceRefs") or []
        if isinstance(ref, dict)
    )
    source_ids.discard("")
    return source_ids


def list_notebook_notes(user_id: str) -> list[dict]:
    """Return all notes with a reversible view of their weakness lifecycle.

    Notes are durable learning assets. A note moves to the previous view only
    when its source is linked to at least one resolved weakness and no active
    weakness. If later evidence reopens that weakness, the same note naturally
    returns to the current view without rewriting or deleting it.
    """

    notes = list_notes(user_id)
    # The Notebook itself is intentionally unbounded, so lifecycle enrichment
    # must not silently lose older resolved weakness links behind another cap.
    memories = list_memories(user_id, limit=None)
    weaknesses_by_source: dict[str, dict[str, dict]] = defaultdict(dict)

    for memory in memories:
        status = str(memory.get("status") or "active")
        if memory.get("kind") != "weakness" or status not in {"active", "resolved"}:
            continue
        summary = {
            "id": memory.get("id"),
            "skillCode": _weakness_skill_code(memory),
            "status": status,
            "resolvedAt": memory.get("resolvedAt"),
        }
        memory_key = str(memory.get("id") or memory.get("canonicalKey") or "")
        for source_id in _source_ids(memory):
            weaknesses_by_source[source_id][memory_key] = summary

    enriched: list[dict] = []
    for note in notes:
        related = list(weaknesses_by_source.get(str(note.get("submissionId") or ""), {}).values())
        related.sort(key=lambda item: (item["status"] != "active", item["skillCode"]))
        has_active = any(item["status"] == "active" for item in related)
        has_resolved = any(item["status"] == "resolved" for item in related)
        enriched.append({
            **note,
            "learningState": "previous" if has_resolved and not has_active else "current",
            "relatedWeaknesses": related,
        })
    return enriched
