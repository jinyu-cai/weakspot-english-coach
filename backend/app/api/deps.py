import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Annotated, Optional

import jwt
from fastapi import Header, HTTPException, Request, Response

from app.config import settings
from app.db.repositories import incr_rate_counter
from app.services.ai_client import LLMProviderConfig


def get_llm_provider(
    x_llm_api_key: Annotated[Optional[str], Header(alias="X-LLM-API-Key")] = None,
    x_llm_base_url: Annotated[Optional[str], Header(alias="X-LLM-Base-URL")] = None,
    x_llm_model: Annotated[Optional[str], Header(alias="X-LLM-Model")] = None,
    x_llm_fast_model: Annotated[Optional[str], Header(alias="X-LLM-Fast-Model")] = None,
) -> Optional[LLMProviderConfig]:
    """Build an optional per-request OpenAI-compatible provider config.

    No headers means the server default provider is used. If a caller opts into
    BYOK, require both key and model so we do not accidentally pair an OpenAI key
    with a server-side DeepSeek model name.
    """
    raw_values = [x_llm_api_key, x_llm_base_url, x_llm_model, x_llm_fast_model]
    if not any(value and value.strip() for value in raw_values):
        return None

    api_key = (x_llm_api_key or "").strip()
    base_url = (x_llm_base_url or "https://api.openai.com/v1").strip().rstrip("/")
    model = (x_llm_model or "").strip()
    fast_model = (x_llm_fast_model or "").strip()

    if not api_key:
        raise HTTPException(status_code=400, detail="X-LLM-API-Key is required for custom LLM provider requests.")
    if not model:
        raise HTTPException(status_code=400, detail="X-LLM-Model is required for custom LLM provider requests.")
    if not base_url.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="X-LLM-Base-URL must be an absolute URL.")

    return LLMProviderConfig(api_key=api_key, base_url=base_url, model=model, fast_model=fast_model or None)



# ----- Auth / identity / rate limiting -----

SESSION_COOKIE = "session"
GUEST_COOKIE = "guest_id"


def cookie_kwargs() -> dict:
    return {
        "httponly": True,
        "secure": settings.app_env == "production",
        "samesite": "lax",
        "domain": settings.cookie_domain or None,
        "path": "/",
    }


def make_session_jwt(claims: dict, days: int = 30) -> str:
    now = int(time.time())
    return jwt.encode({**claims, "iat": now, "exp": now + days * 86400}, settings.session_secret, algorithm="HS256")


def read_session(request: Request) -> Optional[dict]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token or not settings.session_secret:
        return None
    try:
        return jwt.decode(token, settings.session_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def make_state_jwt(redirect: str) -> str:
    now = int(time.time())
    return jwt.encode({"nonce": uuid.uuid4().hex, "redirect": redirect, "iat": now, "exp": now + 600}, settings.session_secret, algorithm="HS256")


def read_state_jwt(state: str) -> Optional[dict]:
    if not state or not settings.session_secret:
        return None
    try:
        return jwt.decode(state, settings.session_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@dataclass
class Identity:
    user_id: str
    kind: str  # "owner" | "user" | "guest"
    is_owner: bool
    rate_key: str
    daily_limit: int
    login: Optional[str] = None


def resolve_identity(request: Request, response: Response) -> Identity:
    bypass = request.headers.get("x-owner-token")
    if settings.owner_bypass_token and bypass == settings.owner_bypass_token:
        return Identity("owner", "owner", True, "owner", 10**9, None)

    claims = read_session(request)
    if claims and claims.get("sub"):
        login = (claims.get("login") or "").lower()
        is_owner = login in settings.owner_login_set
        return Identity(
            user_id=claims["sub"],
            kind="owner" if is_owner else "user",
            is_owner=is_owner,
            rate_key=claims["sub"],
            daily_limit=10**9 if is_owner else settings.user_daily_limit,
            login=claims.get("login"),
        )

    guest_id = request.cookies.get(GUEST_COOKIE)
    if not guest_id:
        guest_id = uuid.uuid4().hex
        response.set_cookie(GUEST_COOKIE, guest_id, max_age=365 * 86400, **cookie_kwargs())
    return Identity(
        user_id=f"guest_{guest_id}",
        kind="guest",
        is_owner=False,
        rate_key=f"ip_{_client_ip(request)}",
        daily_limit=settings.guest_daily_limit,
    )


def rate_limited(feature: str):
    def _dep(request: Request, response: Response) -> Identity:
        identity = resolve_identity(request, response)
        if identity.is_owner:
            return identity
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        ttl = int(time.time()) + 2 * 86400
        count = incr_rate_counter(identity.rate_key, feature, day, ttl)
        if count > identity.daily_limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "rate_limited",
                    "feature": feature,
                    "limit": identity.daily_limit,
                    "kind": identity.kind,
                    "message": (
                        f"Free guest limit reached ({identity.daily_limit}/day). Sign in with GitHub to keep going."
                        if identity.kind == "guest"
                        else f"Daily limit reached ({identity.daily_limit}/day for this feature)."
                    ),
                },
            )
        return identity

    return _dep
