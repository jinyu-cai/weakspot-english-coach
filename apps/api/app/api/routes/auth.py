from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from app.api.deps import (
    SESSION_COOKIE,
    cookie_kwargs,
    make_session_jwt,
    make_state_jwt,
    read_session,
    read_state_jwt,
    resolve_identity,
)
from app.config import settings
from app.db.repositories import upsert_github_user

router = APIRouter()

GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN = "https://github.com/login/oauth/access_token"
GITHUB_USER = "https://api.github.com/user"


def _safe_redirect(redirect: Optional[str]) -> str:
    """Only allow redirects back to our own frontend (prevents open-redirect)."""
    if redirect and settings.frontend_url and redirect.startswith(settings.frontend_url):
        return redirect
    return settings.frontend_url or "/"


@router.get("/auth/github/login")
def github_login(redirect: Optional[str] = None):
    if not settings.auth_enabled:
        raise HTTPException(status_code=503, detail="Auth is not configured on the server.")
    state = make_state_jwt(_safe_redirect(redirect))
    url = (
        f"{GITHUB_AUTHORIZE}?client_id={settings.github_client_id}"
        f"&redirect_uri={settings.oauth_redirect_uri}"
        f"&scope=read:user&state={state}"
    )
    return RedirectResponse(url, status_code=302)


@router.get("/auth/github/callback")
def github_callback(code: Optional[str] = None, state: Optional[str] = None):
    if not settings.auth_enabled:
        raise HTTPException(status_code=503, detail="Auth is not configured on the server.")
    st = read_state_jwt(state or "")
    if not st:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code.")

    with httpx.Client(timeout=15) as client:
        tok = client.post(
            GITHUB_TOKEN,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.oauth_redirect_uri,
            },
        ).json()
        access = tok.get("access_token")
        if not access:
            raise HTTPException(
                status_code=400,
                detail=f"GitHub token exchange failed: {tok.get('error_description') or tok}",
            )
        gh = client.get(
            GITHUB_USER,
            headers={
                "Authorization": f"Bearer {access}",
                "User-Agent": "weakspot-english-coach",
                "Accept": "application/json",
            },
        ).json()

    gh_id = gh.get("id")
    if not gh_id:
        raise HTTPException(status_code=400, detail="Could not fetch GitHub user profile.")

    upsert_github_user(gh_id, gh.get("login"), gh.get("name"), gh.get("avatar_url"))
    token = make_session_jwt(
        {
            "sub": f"gh_{gh_id}",
            "login": gh.get("login"),
            "name": gh.get("name"),
            "avatar": gh.get("avatar_url"),
        }
    )
    resp = RedirectResponse(_safe_redirect(st.get("redirect")), status_code=302)
    resp.set_cookie(SESSION_COOKIE, token, max_age=30 * 86400, **cookie_kwargs())
    return resp


@router.get("/auth/me")
def me(request: Request, response: Response):
    claims = read_session(request)
    if claims and claims.get("sub"):
        login = claims.get("login") or ""
        return {
            "authenticated": True,
            "userId": claims["sub"],
            "login": login,
            "name": claims.get("name"),
            "avatarUrl": claims.get("avatar"),
            "isOwner": login.lower() in settings.owner_login_set,
        }
    resolve_identity(request, response)  # establish a guest cookie
    return {"authenticated": False, "guestLimit": settings.guest_daily_limit}


@router.post("/auth/logout")
def logout():
    resp = Response(status_code=204)
    resp.delete_cookie(SESSION_COOKIE, domain=settings.cookie_domain or None, path="/")
    return resp
