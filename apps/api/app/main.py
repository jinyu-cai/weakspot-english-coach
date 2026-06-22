from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import auth, chat_import, diagnose, health, history, notes, plan, practice, profile, stats

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://weakspot-english-coach.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(chat_import.router, prefix="/api/v1", tags=["chat-import"])
app.include_router(diagnose.router, prefix="/api/v1", tags=["diagnose"])
app.include_router(profile.router, prefix="/api/v1", tags=["profile"])
app.include_router(plan.router, prefix="/api/v1", tags=["plan"])
app.include_router(practice.router, prefix="/api/v1", tags=["practice"])
app.include_router(history.router, prefix="/api/v1", tags=["history"])
app.include_router(notes.router, prefix="/api/v1", tags=["notes"])
app.include_router(stats.router, prefix="/api/v1", tags=["stats"])


@app.get("/")
def root():
    return {"name": settings.app_name, "docs": "/docs", "health": "/api/v1/health"}
