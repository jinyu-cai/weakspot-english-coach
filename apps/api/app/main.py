import logging
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.datastructures import MutableHeaders

from app.config import settings
from app.api.routes import admin, auth, chat, chat_import, coach, diagnose, ebooks, health, history, input_learning, learning, memory, models, notes, plan, practice, profile, realtime, stats
from app.db.repositories import MemoryWriteClaimLostError
from app.services.memory_write_service import MemoryWriteBusyError

logger = logging.getLogger("uvicorn.error")


class RequestBoundaryMiddleware:
    """Return observable JSON for unexpected HTTP failures.

    Keeping this middleware inside CORS means browsers receive the real 500
    response instead of reducing it to an opaque ``Failed to fetch`` error.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid4().hex[:16]
        scope.setdefault("state", {})["request_id"] = request_id
        response_started = False

        async def send_with_request_id(message):
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                MutableHeaders(scope=message)["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:  # noqa: BLE001 - final application HTTP boundary.
            logger.exception(
                "request[%s] unhandled method=%s path=%s",
                request_id,
                scope.get("method"),
                scope.get("path"),
            )
            if response_started:
                raise
            response = JSONResponse(
                status_code=500,
                content={
                    "detail": {
                        "code": "internal_error",
                        "message": (
                            "The server could not complete this request. "
                            f"Request ID: {request_id}"
                        ),
                    }
                },
            )
            await response(scope, receive, send_with_request_id)


app = FastAPI(title=settings.app_name)

# Starlette wraps later-added middleware around earlier middleware. Add the
# boundary first, then CORS below, so CORS remains the outer user middleware.
app.add_middleware(RequestBoundaryMiddleware)


@app.exception_handler(MemoryWriteBusyError)
@app.exception_handler(MemoryWriteClaimLostError)
async def memory_write_conflict_handler(
    _request: Request,
    exc: MemoryWriteBusyError | MemoryWriteClaimLostError,
):
    return JSONResponse(
        status_code=409,
        content={
            "detail": {
                "code": "memory_write_retry",
                "message": str(exc),
            }
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://weakspot-english-coach.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(models.router, prefix="/api/v1", tags=["llm"])
app.include_router(admin.router, prefix="/api/v1", tags=["admin"])
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(coach.router, prefix="/api/v1", tags=["coach"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(realtime.router, prefix="/api/v1", tags=["realtime"])
app.include_router(chat_import.router, prefix="/api/v1", tags=["chat-import"])
app.include_router(diagnose.router, prefix="/api/v1", tags=["diagnose"])
app.include_router(profile.router, prefix="/api/v1", tags=["profile"])
app.include_router(plan.router, prefix="/api/v1", tags=["plan"])
app.include_router(practice.router, prefix="/api/v1", tags=["practice"])
app.include_router(history.router, prefix="/api/v1", tags=["history"])
app.include_router(notes.router, prefix="/api/v1", tags=["notes"])
app.include_router(stats.router, prefix="/api/v1", tags=["stats"])
app.include_router(memory.router, prefix="/api/v1", tags=["memory"])
app.include_router(input_learning.router, prefix="/api/v1", tags=["input-learning"])
app.include_router(ebooks.router, prefix="/api/v1", tags=["ebooks"])
app.include_router(learning.router, prefix="/api/v1", tags=["learning"])


@app.get("/")
def root():
    return {"name": settings.app_name, "docs": "/docs", "health": "/api/v1/health"}
