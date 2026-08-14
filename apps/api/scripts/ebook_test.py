"""Offline contract and lifecycle tests for private ebook learning.

Run from ``apps/api``:

    DYNAMODB_ENDPOINT_URL= UV_CACHE_DIR=.uv-cache uv run python -m scripts.ebook_test
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import io
import os
from pathlib import Path
import tempfile
import zipfile


def _epub_bytes(*, unsafe: bool = False, long_chapter: bool = False, bomb: bool = False) -> bytes:
    output = io.BytesIO()
    repeated = " ".join(
        f"Sentence {index} explains how a careful learner can turn reading into independent English use."
        for index in range(1, 341 if long_chapter else 8)
    )
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        archive.writestr(
            "META-INF/container.xml",
            '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
        )
        archive.writestr(
            "OEBPS/content.opf",
            '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Learning Book</dc:title><dc:creator>WeakSpot QA</dc:creator></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
        )
        archive.writestr(
            "OEBPS/chapter.xhtml",
            f'<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Learning Chapter</h1><p>{repeated}</p></body></html>',
        )
        if unsafe:
            archive.writestr("../escape.txt", "unsafe")
        if bomb:
            archive.writestr(
                "OEBPS/high-ratio.bin",
                b"x" * (6 * 1024 * 1024),
                compress_type=zipfile.ZIP_DEFLATED,
            )
    return output.getvalue()


def _text_pdf_bytes(*, include_blank_page: bool = True) -> bytes:
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    output = io.BytesIO()
    writer = PdfWriter()
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    font_reference = writer._add_object(font)
    page = writer.add_blank_page(width=360, height=240)
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_reference}),
    })
    stream = DecodedStreamObject()
    stream.set_data(
        b"BT /F1 12 Tf 36 190 Td (Reading an English book builds useful language through repeated meaningful context.) Tj "
        b"0 -22 Td (A reliable text layer keeps every sentence available for focused study and later independent practice.) Tj "
        b"0 -22 Td (Students can notice a reusable phrase, understand its grammar, and apply it to a completely new situation.) Tj ET"
    )
    page[NameObject("/Contents")] = writer._add_object(stream)
    if include_blank_page:
        writer.add_blank_page(width=360, height=240)
    writer.write(output)
    return output.getvalue()


def main() -> int:
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_REGION"] = "us-east-1"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["DYNAMODB_ENDPOINT_URL"] = ""
    os.environ["USE_FAKE_AI"] = "true"
    os.environ["SESSION_SECRET"] = "ebook-test-secret-at-least-32-bytes"
    os.environ["USER_DAILY_LIMIT"] = "100"

    import moto

    mock = moto.mock_aws()
    mock.start()
    try:
        from fastapi.testclient import TestClient
        from pypdf import PdfWriter

        from app.api.deps import make_session_jwt
        from app.db.repositories import (
            ensure_dynamodb_item_fits,
            get_ebook_analysis_page,
            get_ebook_learning_target,
            get_memory,
            get_skill,
            list_ebook_pages,
            list_notes,
            save_ebook_learning_target,
        )
        from app.main import app
        from app.models.ebook import (
            CreateOnDemandAnnotationRequest,
            CreateStudyPackRequest,
            SubmitEbookPracticeAttemptRequest,
        )
        from app.services.ebook_service import (
            EbookImportError,
            _epub_pages,
            _normalize_text,
            _pdf_pages,
            begin_ebook_import,
            create_on_demand_annotation,
            create_study_pack,
            delete_book_for_user,
            delete_study_pack_for_user,
            get_book_for_user,
            get_study_pack_for_user,
            list_study_packs_for_user,
            mark_annotation_unfamiliar,
            process_ebook_import,
            process_study_pack,
            start_practice_session,
            store_upload,
            submit_practice_attempt,
        )
        from app.services.notebook_service import list_notebook_notes
        from app.services.decision_service import recommend_next_action
        from scripts.create_table import create_table

        create_table()
        user_id = "ebook-user-a"

        # Unsafe archive paths are rejected before reading chapter content.
        with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as handle:
            handle.write(_epub_bytes(unsafe=True))
            unsafe_path = handle.name
        try:
            try:
                _epub_pages(unsafe_path)
                raise AssertionError("unsafe EPUB path should be rejected")
            except EbookImportError as exc:
                assert "unsafe" in str(exc).lower()
        finally:
            Path(unsafe_path).unlink(missing_ok=True)

        # Compression-ratio bombs and forged extensions fail before any
        # extracted content is persisted.
        with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as handle:
            handle.write(_epub_bytes(bomb=True))
            bomb_path = handle.name
        try:
            try:
                _epub_pages(bomb_path)
                raise AssertionError("high-ratio EPUB entry should be rejected")
            except EbookImportError as exc:
                assert "compressed" in str(exc).lower()
        finally:
            Path(bomb_path).unlink(missing_ok=True)
        try:
            store_upload(io.BytesIO(b"%PDF-forged-epub"), "forged.epub")
            raise AssertionError("forged EPUB extension should be rejected")
        except EbookImportError as exc:
            assert "signature" in str(exc).lower()
        # Raw uploads larger than the legacy 25 MB cap remain accepted. EPUB
        # expansion and extracted-text limits are tested separately as safety
        # controls rather than upload-size limits.
        large_upload_path = None
        try:
            large_upload_path, large_format, _, large_size = store_upload(
                io.BytesIO(b"%PDF-" + b"x" * (26 * 1024 * 1024)),
                "large.pdf",
            )
            assert large_format == "pdf"
            assert large_size > 25 * 1024 * 1024
        finally:
            if large_upload_path:
                Path(large_upload_path).unlink(missing_ok=True)
        assert _normalize_text("An inter-\nnational example.\n\nA second paragraph.") == (
            "An international example.\n\nA second paragraph."
        )

        # Import is deterministic, paginated by chapter, and removes the upload.
        long_epub_bytes = _epub_bytes(long_chapter=True)
        uploaded = io.BytesIO(long_epub_bytes)
        book, temporary_path = begin_ebook_import(
            user_id,
            filename="learning.epub",
            file_object=uploaded,
            comparison_language="zh-CN",
        )
        assert temporary_path and Path(temporary_path).exists()
        inflight, inflight_path = begin_ebook_import(
            user_id,
            filename="learning-copy.epub",
            file_object=io.BytesIO(long_epub_bytes),
            comparison_language="en",
        )
        assert inflight["id"] == book["id"] and inflight_path is None
        assert Path(temporary_path).exists()
        process_ebook_import(user_id, book["id"], temporary_path)
        assert not Path(temporary_path).exists()
        ready = get_book_for_user(user_id, book["id"])
        assert ready and ready["status"] == "ready"
        assert ready["title"] == "Test Learning Book"
        assert ready["pageCount"] >= 15
        pages = list_ebook_pages(user_id, book["id"])
        assert [page["pageNumber"] for page in pages] == list(range(1, len(pages) + 1))
        assert all(page["chapterTitle"] == "Learning Chapter" for page in pages)
        assert max(page["wordCount"] for page in pages) < 500
        assert all(ensure_dynamodb_item_fits(page) < 400_000 for page in pages)

        # A repeated identical upload reuses the ready book and deletes the new temp file.
        duplicate, duplicate_path = begin_ebook_import(
            user_id,
            filename="renamed.epub",
            file_object=io.BytesIO(long_epub_bytes),
            comparison_language="en",
        )
        assert duplicate["id"] == ready["id"]
        assert duplicate_path is None
        assert duplicate["comparisonLanguage"] == "zh-CN"

        # Range validation locks the public 1-15 consecutive-page contract.
        try:
            CreateStudyPackRequest(startPage=1, endPage=16)
            raise AssertionError("16 pages should be rejected")
        except ValueError:
            pass
        try:
            CreateStudyPackRequest(startPage=3, endPage=2)
            raise AssertionError("reverse range should be rejected")
        except ValueError:
            pass
        try:
            CreateStudyPackRequest(startPage=1, endPage=1, modelTier="turbo")
            raise AssertionError("unknown model tiers should be rejected")
        except ValueError:
            pass

        # Both the lower and upper supported study-range bounds complete, and
        # the overlapping second pack reuses the already-persisted page cache.
        one_page_pack = create_study_pack(
            user_id,
            ready["id"],
            CreateStudyPackRequest(startPage=1, endPage=1),
        )
        one_page_claim = one_page_pack.pop("_claimId")
        process_study_pack(user_id, one_page_pack["id"], None, 8192, one_page_claim)
        assert get_study_pack_for_user(user_id, one_page_pack["id"])["status"] == "ready"

        end_page = 15
        pack = create_study_pack(
            user_id,
            ready["id"],
            CreateStudyPackRequest(startPage=1, endPage=end_page),
        )
        assert pack.pop("_dispatch") is True
        pack_claim = pack.pop("_claimId")
        remembered_book = get_book_for_user(user_id, ready["id"])
        assert remembered_book["lastStudyPackId"] == pack["id"]
        assert remembered_book["lastStudyRange"] == {
            "startPage": 1,
            "endPage": end_page,
            "modelTier": "deep",
        }
        partial_pack = get_study_pack_for_user(user_id, pack["id"])
        assert partial_pack and partial_pack["status"] == "processing"
        assert [page["pageNumber"] for page in partial_pack["pages"]] == [1]
        assert partial_pack["completedPageCount"] == 1
        partial_unit = partial_pack["pages"][0]["units"][0]
        partial_annotation = create_on_demand_annotation(
            user_id,
            pack["id"],
            CreateOnDemandAnnotationRequest(
                unitId=partial_unit["unitId"],
                startOffset=0,
                endOffset=min(8, len(partial_unit["sourceText"])),
            ),
            None,
            8192,
        )
        assert partial_annotation["selectedText"] == partial_unit["sourceText"][:8]
        process_study_pack(user_id, pack["id"], None, 8192, pack_claim)
        complete_pack = get_study_pack_for_user(user_id, pack["id"])
        assert complete_pack and complete_pack["status"] == "ready"
        assert len(complete_pack["pages"]) == end_page
        assert all(
            len(page["units"]) == len({unit["unitId"] for unit in page["units"]})
            and all(unit["counterpartText"] for unit in page["units"])
            for page in complete_pack["pages"]
        )
        annotation = complete_pack["pages"][0]["annotations"][0]
        assert annotation["selectedText"] in annotation["sourceText"]

        overlapping_pack = create_study_pack(
            user_id,
            ready["id"],
            CreateStudyPackRequest(startPage=1, endPage=2),
        )
        overlapping_claim = overlapping_pack.pop("_claimId")
        process_study_pack(user_id, overlapping_pack["id"], None, 8192, overlapping_claim)
        overlap_complete = get_study_pack_for_user(user_id, overlapping_pack["id"])
        assert overlap_complete["pages"][0]["units"] == complete_pack["pages"][0]["units"]
        overlap_cache_id = overlap_complete["pages"][0]["cacheId"]
        deleted_overlap = delete_study_pack_for_user(user_id, overlapping_pack["id"])
        assert deleted_overlap["deleted"] is True
        assert get_study_pack_for_user(user_id, overlapping_pack["id"]) is None
        assert get_ebook_analysis_page(user_id, overlap_cache_id) is not None
        assert overlapping_pack["id"] not in {
            saved["id"] for saved in list_study_packs_for_user(user_id, ready["id"])
        }

        # Deleting a processing range cancels its claim. A stale worker cannot
        # recreate the history card, while its already-built page cache remains reusable.
        cancelled_pack = create_study_pack(
            user_id,
            ready["id"],
            CreateStudyPackRequest(startPage=2, endPage=2, modelTier="fast"),
        )
        cancelled_claim = cancelled_pack.pop("_claimId")
        delete_study_pack_for_user(user_id, cancelled_pack["id"])
        process_study_pack(user_id, cancelled_pack["id"], None, 8192, cancelled_claim)
        assert get_study_pack_for_user(user_id, cancelled_pack["id"]) is None

        # Fast and Deep use separate caches. A forced retry replaces the
        # processing claim, so a stale worker cannot overwrite resumed progress.
        fast_pack = create_study_pack(
            user_id,
            ready["id"],
            CreateStudyPackRequest(startPage=1, endPage=2, modelTier="fast"),
        )
        stale_claim = fast_pack.pop("_claimId")
        retried_fast_pack = create_study_pack(
            user_id,
            ready["id"],
            CreateStudyPackRequest(
                startPage=1,
                endPage=2,
                modelTier="fast",
                forceRetry=True,
            ),
        )
        active_claim = retried_fast_pack.pop("_claimId")
        assert retried_fast_pack["id"] == fast_pack["id"]
        assert active_claim != stale_claim
        process_study_pack(user_id, fast_pack["id"], None, 8192, stale_claim)
        assert get_study_pack_for_user(user_id, fast_pack["id"])["status"] == "processing"
        process_study_pack(user_id, fast_pack["id"], None, 8192, active_claim)
        fast_complete = get_study_pack_for_user(user_id, fast_pack["id"])
        assert fast_complete["status"] == "ready" and fast_complete["modelTier"] == "fast"
        assert fast_complete["pages"][0]["cacheId"] != complete_pack["pages"][0]["cacheId"]
        saved_pack_history = list_study_packs_for_user(user_id, ready["id"])
        saved_pack_ids = {saved["id"] for saved in saved_pack_history}
        assert {pack["id"], fast_pack["id"], one_page_pack["id"]} <= saved_pack_ids
        assert all("pages" not in saved for saved in saved_pack_history)

        # Self-report writes one note + one provisional weakness but no mastery penalty.
        assert get_skill(user_id, annotation["skillCode"]) is None
        target = mark_annotation_unfamiliar(user_id, annotation["id"])
        duplicate_target = mark_annotation_unfamiliar(user_id, annotation["id"])
        assert duplicate_target["id"] == target["id"]
        notes = [note for note in list_notes(user_id) if note.get("bookId") == ready["id"]]
        assert len(notes) == 1
        memory = get_memory(user_id, target["memoryId"])
        assert memory and memory["weaknessStage"] == "provisional"
        assert memory["verification"]["state"] == "candidate"
        assert memory["retention"]["stabilityDays"] == 0.5
        assert memory["retention"]["observedErrors"] == 0
        assert get_skill(user_id, annotation["skillCode"]) is None

        # Three cold production steps produce learning state and a delayed due date.
        session = start_practice_session(user_id, target["id"])
        for step, response in (
            (1, "It introduces a result discovered later and contrasts with the original expectation."),
            (2, f"My weekend plan {target['expression']} much more preparation than I expected."),
            (3, f"At work, the new task {target['expression']} careful planning, clear communication, and more time than our whole team first expected."),
        ):
            result = submit_practice_attempt(
                user_id,
                session["id"],
                SubmitEbookPracticeAttemptRequest(
                    responseText=response,
                    clientAttemptId=f"ebook-attempt-{step}",
                ),
                None,
            )
            assert result["attempt"]["passed"] is True
            session = result["session"]
        target = get_ebook_learning_target(user_id, target["id"])
        assert target and target["status"] == "learning" and target["dueAt"]
        assert get_skill(user_id, annotation["skillCode"]) is not None

        # A due, different-context cold success resolves the provisional weakness.
        target["dueAt"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat().replace("+00:00", "Z")
        target["independentSuccessAt"] = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat().replace("+00:00", "Z")
        save_ebook_learning_target(target)
        global_first = recommend_next_action(
            user_id,
            session_slot=0,
            session_size=4,
        )
        assert global_first["learningTarget"]["id"] == target["id"]
        assert global_first["errorFingerprint"]["targetExpression"] == target["expression"]
        global_second = recommend_next_action(
            user_id,
            session_slot=1,
            session_size=4,
            exclude_skill_codes=[target["skillCode"]],
        )
        assert global_second["learningTarget"] is None
        delayed = start_practice_session(user_id, target["id"])
        assert delayed["delayedReview"] is True and delayed["currentStep"] == 3
        delayed_result = submit_practice_attempt(
            user_id,
            delayed["id"],
            SubmitEbookPracticeAttemptRequest(
                responseText=f"During a trip, our simple booking {target['expression']} several phone calls, patient explanations, and a completely new plan for everyone.",
                clientAttemptId="ebook-delayed-1",
            ),
            None,
        )
        assert delayed_result["target"]["status"] == "mastered"
        resolved = get_memory(user_id, target["memoryId"])
        assert resolved and resolved["status"] == "resolved"
        notebook = [row for row in list_notebook_notes(user_id) if row.get("bookId") == ready["id"]]
        assert notebook and notebook[0]["learningState"] == "previous"

        # A later learner-reported recurrence reopens the same target and note
        # without counting an observed error or lowering generic mastery.
        mastery_before_recurrence = get_skill(user_id, target["skillCode"])["mastery"]
        reopened = mark_annotation_unfamiliar(user_id, annotation["id"])
        assert reopened["id"] == target["id"] and reopened["status"] == "confirmed"
        reopened_memory = get_memory(user_id, target["memoryId"])
        assert reopened_memory["status"] == "active"
        assert reopened_memory["retention"]["observedErrors"] == 0
        assert get_skill(user_id, target["skillCode"])["mastery"] == mastery_before_recurrence

        # Cross-user reads are not possible even when a real book id is known.
        client = TestClient(app)
        other_token = make_session_jwt({"sub": "ebook-user-b", "login": "reader-b"})
        response = client.get(f"/api/v1/ebooks/{ready['id']}", cookies={"session": other_token})
        assert response.status_code == 404
        guest_response = client.get("/api/v1/ebooks")
        assert guest_response.status_code == 401
        owner_token = make_session_jwt({"sub": user_id, "login": "reader-a"})
        rights_response = client.post(
            "/api/v1/ebooks/import",
            data={"comparisonLanguage": "zh-CN", "rightsConfirmed": "false"},
            files={"file": ("learning.epub", long_epub_bytes, "application/epub+zip")},
            cookies={"session": owner_token},
        )
        assert rights_response.status_code == 400
        route_duplicate = client.post(
            "/api/v1/ebooks/import",
            data={"comparisonLanguage": "zh-CN", "rightsConfirmed": "true"},
            files={"file": ("learning.epub", long_epub_bytes, "application/epub+zip")},
            cookies={"session": owner_token},
        )
        assert route_duplicate.status_code == 200, (
            route_duplicate.status_code,
            route_duplicate.text,
        )
        assert route_duplicate.json()["book"]["id"] == ready["id"]
        pack_history_response = client.get(
            f"/api/v1/ebooks/{ready['id']}/study-packs",
            cookies={"session": owner_token},
        )
        assert pack_history_response.status_code == 200, pack_history_response.text
        assert {row["id"] for row in pack_history_response.json()["studyPacks"]} >= {
            pack["id"],
            fast_pack["id"],
        }
        other_pack_history = client.get(
            f"/api/v1/ebooks/{ready['id']}/study-packs",
            cookies={"session": other_token},
        )
        assert other_pack_history.status_code == 404
        route_delete_pack = create_study_pack(
            user_id,
            ready["id"],
            CreateStudyPackRequest(startPage=3, endPage=3, modelTier="fast"),
        )
        cross_user_delete = client.delete(
            f"/api/v1/ebook-study-packs/{route_delete_pack['id']}",
            cookies={"session": other_token},
        )
        assert cross_user_delete.status_code == 404
        owner_delete = client.delete(
            f"/api/v1/ebook-study-packs/{route_delete_pack['id']}",
            cookies={"session": owner_token},
        )
        assert owner_delete.status_code == 200, owner_delete.text
        assert owner_delete.json()["deleted"] is True
        deleted_pack_read = client.get(
            f"/api/v1/ebook-study-packs/{route_delete_pack['id']}",
            cookies={"session": owner_token},
        )
        assert deleted_pack_read.status_code == 404
        duplicate_delete = client.delete(
            f"/api/v1/ebook-study-packs/{route_delete_pack['id']}",
            cookies={"session": owner_token},
        )
        assert duplicate_delete.status_code == 404

        # Text PDFs retain physical pages, including a blank page; the blank
        # page remains studyable without triggering OCR.
        pdf_bytes = _text_pdf_bytes()
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
            handle.write(pdf_bytes)
            readable_pdf_path = handle.name
        try:
            _, _, parsed_pdf_pages = _pdf_pages(readable_pdf_path)
            assert len(parsed_pdf_pages) == 2
            assert "English book" in parsed_pdf_pages[0]["text"]
            assert parsed_pdf_pages[1]["text"] == ""
        finally:
            Path(readable_pdf_path).unlink(missing_ok=True)
        pdf_book, pdf_temp = begin_ebook_import(
            user_id,
            filename="physical-pages.pdf",
            file_object=io.BytesIO(pdf_bytes),
            comparison_language="en",
        )
        assert pdf_temp
        process_ebook_import(user_id, pdf_book["id"], pdf_temp)
        pdf_ready = get_book_for_user(user_id, pdf_book["id"])
        assert pdf_ready and pdf_ready["status"] == "ready" and pdf_ready["pageCount"] == 2
        pdf_pages = list_ebook_pages(user_id, pdf_book["id"])
        assert [page["physicalPageNumber"] for page in pdf_pages] == [1, 2]
        blank_pack = create_study_pack(
            user_id,
            pdf_book["id"],
            CreateStudyPackRequest(startPage=1, endPage=2),
        )
        process_study_pack(user_id, blank_pack["id"], None, 8192)
        blank_complete = get_study_pack_for_user(user_id, blank_pack["id"])
        assert blank_complete["status"] == "ready" and blank_complete["pages"][1]["units"] == []

        # A scanned/blank PDF is marked failed and the temporary upload is
        # removed. Re-uploading a failed hash gets a fresh processing attempt.
        blank_pdf = io.BytesIO()
        blank_writer = PdfWriter()
        blank_writer.add_blank_page(width=100, height=100)
        blank_writer.write(blank_pdf)
        scanned, scanned_temp = begin_ebook_import(
            user_id,
            filename="scan.pdf",
            file_object=io.BytesIO(blank_pdf.getvalue()),
            comparison_language="zh-CN",
        )
        process_ebook_import(user_id, scanned["id"], scanned_temp)
        assert not Path(scanned_temp).exists()
        assert get_book_for_user(user_id, scanned["id"])["status"] == "failed"
        retry, retry_temp = begin_ebook_import(
            user_id,
            filename="scan-again.pdf",
            file_object=io.BytesIO(blank_pdf.getvalue()),
            comparison_language="en",
        )
        assert retry["id"] == scanned["id"] and retry_temp and Path(retry_temp).exists()
        process_ebook_import(user_id, retry["id"], retry_temp)
        assert not Path(retry_temp).exists()

        # Encrypted and scanned/blank PDFs fail explicitly and never enter OCR.
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            writer.encrypt("secret")
            writer.write(handle)
            encrypted_path = handle.name
        try:
            try:
                _pdf_pages(encrypted_path)
                raise AssertionError("encrypted PDF should be rejected")
            except EbookImportError as exc:
                assert "encrypted" in str(exc).lower()
        finally:
            Path(encrypted_path).unlink(missing_ok=True)

        # Deleting a book removes source text, notes, targets, and memories.
        deleted = delete_book_for_user(user_id, ready["id"])
        assert deleted["deleted"] is True
        assert get_book_for_user(user_id, ready["id"]) is None
        assert not [note for note in list_notes(user_id) if note.get("bookId") == ready["id"]]
        assert get_memory(user_id, target["memoryId"]) is None

        print("Ebook import, grounding, privacy, learning, and cleanup OK.")
        print("ALL EBOOK TESTS PASSED ✅")
        return 0
    finally:
        mock.stop()


if __name__ == "__main__":
    raise SystemExit(main())
