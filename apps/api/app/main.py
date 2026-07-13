from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.api.routes import admin, auth, chat, chat_import, diagnose, health, history, input_learning, memory, models, notes, plan, practice, profile, realtime, stats
from app.db.repositories import MemoryWriteClaimLostError
from app.services.memory_write_service import MemoryWriteBusyError

app = FastAPI(title=settings.app_name)


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


@app.get("/")
def root():
    return {"name": settings.app_name, "docs": "/docs", "health": "/api/v1/health"}
