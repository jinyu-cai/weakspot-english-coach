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
    qwen_model_studio_api_key: str = ""
    qwen_model_studio_base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    qwen_model_studio_model: str = "qwen3.7-max"
    qwen_model_studio_fast_model: str = "qwen3.7-plus"
    qwen_embedding_model: str = "text-embedding-v4"
    qwen_embedding_dimensions: int = 256
    openai_api_key: str = ""
    openai_realtime_model: str = "gpt-realtime-mini-2025-12-15"
    openai_realtime_models: str = "gpt-realtime-mini-2025-12-15,gpt-realtime-2"
    # OpenAI Speech API. The same server-side key may be used for Realtime and
    # TTS, but the browser never receives it. tts-1-hd is the supported
    # quality-oriented default; deployments can change this without a rebuild.
    openai_tts_base_url: str = "https://api.openai.com/v1"
    openai_tts_model: str = "tts-1-hd"
    openai_tts_voice: str = "marin"

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

    # --- MemoryAgent ---
    memory_enabled: bool = True
    memory_context_token_budget: int = 700
    memory_retrieval_limit: int = 6
    memory_max_items_per_user: int = 200
    memory_chat_recent_messages: int = 12

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
    guest_max_output_tokens: int = 8192
    user_max_output_tokens: int = 16384
    guest_realtime_max_seconds: int = 120
    user_realtime_max_seconds: int = 300
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    owner_emails: str = ""
    member_github_logins: str = ""
    member_emails: str = ""

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def uses_qwen_model_studio(self) -> bool:
        return bool(self.qwen_model_studio_api_key)

    @property
    def default_llm_api_key(self) -> str:
        if self.uses_qwen_model_studio:
            return self.qwen_model_studio_api_key
        return self.openai_compat_api_key or self.deepseek_api_key

    @property
    def default_llm_base_url(self) -> str:
        if self.uses_qwen_model_studio:
            return self.qwen_model_studio_base_url
        return self.openai_compat_base_url or self.deepseek_base_url

    @property
    def default_llm_model(self) -> str:
        if self.uses_qwen_model_studio:
            return self.qwen_model_studio_model
        return self.openai_compat_model or self.llm_model

    @property
    def default_llm_fast_model(self) -> str:
        if self.uses_qwen_model_studio:
            return self.qwen_model_studio_fast_model
        return self.openai_compat_fast_model or self.llm_model_fast

    @property
    def openai_realtime_model_list(self) -> List[str]:
        return [model.strip() for model in self.openai_realtime_models.split(",") if model.strip()]

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
    def member_login_set(self) -> set:
        return {x.strip().lower() for x in self.member_github_logins.split(",") if x.strip()}

    @property
    def member_email_set(self) -> set:
        return {x.strip().lower() for x in self.member_emails.split(",") if x.strip()}

    @property
    def google_auth_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret and self.session_secret)


settings = Settings()
