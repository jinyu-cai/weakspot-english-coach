from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = "development"
    app_name: str = "WeakSpot English Coach API"

    # Default OpenAI-compatible provider.
    # The DEEPSEEK_* names are kept for backwards compatibility with the first
    # deployment; OPENAI_COMPAT_* can be used for provider-neutral production config.
    # Defaults are empty so the app can be imported (smoke tests / schema gen)
    # without secrets; real values come from .env at runtime.
    openai_compat_api_key: str = ""
    openai_compat_base_url: str = ""
    openai_compat_model: str = ""
    openai_compat_fast_model: str = ""
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-v4-pro"
    llm_model_fast: str = "deepseek-v4-flash"

    # AWS DynamoDB
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    dynamodb_table: str = "WeakSpotEnglishCoach"
    # Local dev: point DynamoDB at a local emulator (e.g. http://localhost:8001).
    # Leave empty to use real AWS DynamoDB.
    dynamodb_endpoint_url: str = ""

    cors_origins: str = "http://localhost:3000"
    demo_user_id: str = "demo-user-001"

    # Local dev: return canned AI results instead of calling DeepSeek (no key needed).
    use_fake_ai: bool = False
    # Enable only while debugging malformed provider output; this can log model
    # response snippets that may contain user text.
    llm_debug_log_content: bool = False

    # --- Auth (GitHub OAuth) + rate limiting ---
    github_client_id: str = ""
    github_client_secret: str = ""
    session_secret: str = ""
    oauth_redirect_uri: str = ""
    frontend_url: str = "http://localhost:3000"
    cookie_domain: str = ""
    owner_github_logins: str = ""
    owner_bypass_token: str = ""
    guest_daily_limit: int = 3
    user_daily_limit: int = 20
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    owner_emails: str = ""

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def default_llm_api_key(self) -> str:
        return self.openai_compat_api_key or self.deepseek_api_key

    @property
    def default_llm_base_url(self) -> str:
        return self.openai_compat_base_url or self.deepseek_base_url

    @property
    def default_llm_model(self) -> str:
        return self.openai_compat_model or self.llm_model

    @property
    def default_llm_fast_model(self) -> str:
        return self.openai_compat_fast_model or self.llm_model_fast

    @property
    def owner_login_set(self) -> set:
        return {x.strip().lower() for x in self.owner_github_logins.split(",") if x.strip()}

    @property
    def auth_enabled(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret and self.session_secret)

    @property
    def owner_email_set(self) -> set:
        return {x.strip().lower() for x in self.owner_emails.split(",") if x.strip()}

    @property
    def google_auth_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret and self.session_secret)


settings = Settings()
