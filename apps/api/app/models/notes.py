from pydantic import BaseModel, Field, field_validator


class SaveChatSelectionRequest(BaseModel):
    sessionId: str = Field(min_length=1, max_length=160)
    messageId: str = Field(min_length=1, max_length=200)
    messageCreatedAt: str = Field(min_length=1, max_length=80)
    selectedText: str = Field(min_length=1, max_length=12000)

    @field_validator("selectedText")
    @classmethod
    def require_visible_text(cls, value: str) -> str:
        selected = value.strip()
        if not selected:
            raise ValueError("Select at least one visible character.")
        return selected
