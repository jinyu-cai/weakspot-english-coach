from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from app.models.common import OutputLanguage


CoachMissionType = Literal[
    "guided_scene",
    "picture_story",
    "listen_retell",
    "decision_response",
    "vocabulary_in_action",
]
CoachDurationMinutes = Literal[5, 10, 15]
CoachModality = Literal["text", "voice"]
CoachEnergy = Literal["light", "normal", "challenge"]
CoachScenarioFamily = Literal[
    "service_recovery",
    "workplace_alignment",
    "travel_disruption",
    "neighbor_coordination",
    "healthcare_admin",
    "community_event",
    "housing_issue",
    "delivery_problem",
    "learning_request",
    "social_boundary",
    "tech_support",
    "appointment_change",
]
CoachSpeechStyle = Literal["gentle", "natural", "challenge"]
CoachPictureAssetKey = Literal[
    "market_morning",
    "rainy_bus_stop",
    "kitchen_surprise",
]
CoachSkillCode = Literal[
    "grammar.verb_tense",
    "grammar.article",
    "grammar.preposition",
    "grammar.subject_verb_agreement",
    "vocab.word_choice",
    "vocab.repetition",
    "sentence.structure",
    "sentence.variety",
    "discourse.coherence",
    "style.register",
    "clarity.expression",
]
CoachCriterion = Annotated[str, Field(min_length=1, max_length=300)]
CoachHint = Annotated[str, Field(min_length=1, max_length=500)]


class CoachMissionRequest(BaseModel):
    """Preferences for one short, production-focused coaching mission."""

    durationMinutes: CoachDurationMinutes = 10
    modality: CoachModality = "text"
    energy: CoachEnergy = "normal"
    preferredType: Optional[CoachMissionType] = None
    outputLanguage: OutputLanguage = "en"


class CoachSpeechRequest(BaseModel):
    """Bounded text-to-speech request; provider credentials stay server-side."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=4096)
    style: CoachSpeechStyle = "natural"

    @field_validator("text")
    @classmethod
    def reject_blank_speech(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("text must not be blank")
        return normalized


class InputLab2TranscriptMissionRequest(BaseModel):
    """Owner-supplied material only; URLs are intentionally not supported."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=240)
    transcript: str = Field(min_length=40, max_length=12000)
    rightsBasis: str = Field(min_length=3, max_length=500)
    durationMinutes: CoachDurationMinutes = 10
    modality: CoachModality = "voice"
    energy: CoachEnergy = "normal"
    outputLanguage: OutputLanguage = "en"

    @field_validator("title", "transcript", "rightsBasis")
    @classmethod
    def reject_blank_text(cls, value: str, info: ValidationInfo) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("value must not be blank")
        if info.field_name == "transcript" and len(normalized) < 40:
            raise ValueError("transcript must contain at least 40 non-whitespace characters")
        return normalized


class CoachScene(BaseModel):
    setting: str = Field(min_length=1, max_length=500)
    userRole: str = Field(min_length=1, max_length=300)
    aiRole: str = Field(min_length=1, max_length=300)
    goal: str = Field(min_length=1, max_length=500)
    scenarioPrompt: str = Field(min_length=1, max_length=2400)
    starterMessage: str = Field(min_length=1, max_length=1000)
    scenarioFamily: CoachScenarioFamily
    scenarioKey: str = Field(min_length=1, max_length=160)


class CoachPicture(BaseModel):
    # The web app maps these allowlisted keys to first-party illustrations.
    assetKey: CoachPictureAssetKey


class CoachListening(BaseModel):
    # Listening scripts are English learning material. Surrounding UI copy may
    # still follow outputLanguage.
    script: str = Field(min_length=40, max_length=4000)
    playLimit: int = Field(default=2, ge=1, le=3)


class CoachDecision(BaseModel):
    situation: str = Field(min_length=1, max_length=900)
    userRole: str = Field(min_length=1, max_length=300)
    audience: str = Field(min_length=1, max_length=300)
    decisionGoal: str = Field(min_length=1, max_length=600)
    constraints: list[str] = Field(min_length=2, max_length=4)


class CoachVocabularyTask(BaseModel):
    situation: str = Field(min_length=1, max_length=900)
    communicativeGoal: str = Field(min_length=1, max_length=600)
    audience: str = Field(min_length=1, max_length=300)
    tone: str = Field(min_length=1, max_length=160)
    conceptsToExpress: list[str] = Field(min_length=2, max_length=5)


class _MissionCopy(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    eyebrow: str = Field(min_length=1, max_length=100)
    briefing: str = Field(min_length=1, max_length=1000)
    targetSkills: list[CoachSkillCode] = Field(min_length=1, max_length=4)
    taskPrompt: str = Field(min_length=1, max_length=1200)
    successCriteria: list[CoachCriterion] = Field(min_length=2, max_length=5)
    hints: list[CoachHint] = Field(min_length=2, max_length=4)


class GuidedSceneMissionAI(_MissionCopy):
    type: Literal["guided_scene"]
    scene: CoachScene


class PictureStoryMissionAI(_MissionCopy):
    type: Literal["picture_story"]
    picture: CoachPicture


class ListenRetellMissionAI(_MissionCopy):
    type: Literal["listen_retell"]
    listening: CoachListening


class DecisionResponseMissionAI(_MissionCopy):
    type: Literal["decision_response"]
    decision: CoachDecision


class VocabularyInActionMissionAI(_MissionCopy):
    type: Literal["vocabulary_in_action"]
    vocabulary: CoachVocabularyTask


CoachMissionAI = Annotated[
    Union[
        GuidedSceneMissionAI,
        PictureStoryMissionAI,
        ListenRetellMissionAI,
        DecisionResponseMissionAI,
        VocabularyInActionMissionAI,
    ],
    Field(discriminator="type"),
]


class CoachMissionAIResult(BaseModel):
    mission: CoachMissionAI


class GuidedSceneMissionAIResult(BaseModel):
    mission: GuidedSceneMissionAI


class PictureStoryMissionAIResult(BaseModel):
    mission: PictureStoryMissionAI


class ListenRetellMissionAIResult(BaseModel):
    mission: ListenRetellMissionAI


class DecisionResponseMissionAIResult(BaseModel):
    mission: DecisionResponseMissionAI


class VocabularyInActionMissionAIResult(BaseModel):
    mission: VocabularyInActionMissionAI


class TranscriptMissionPlanAI(_MissionCopy):
    """LLM-generated scaffold around an immutable owner-supplied script."""

    playLimit: int = Field(default=2, ge=1, le=3)


class TranscriptMissionPlanAIResult(BaseModel):
    mission: TranscriptMissionPlanAI


class _PublicMissionBase(_MissionCopy):
    id: str = Field(min_length=1, max_length=80)
    estimatedMinutes: CoachDurationMinutes
    difficulty: CoachEnergy


class GuidedSceneMission(_PublicMissionBase):
    type: Literal["guided_scene"]
    scene: CoachScene


class PictureStoryMission(_PublicMissionBase):
    type: Literal["picture_story"]
    picture: CoachPicture


class ListenRetellMission(_PublicMissionBase):
    type: Literal["listen_retell"]
    listening: CoachListening


class DecisionResponseMission(_PublicMissionBase):
    type: Literal["decision_response"]
    decision: CoachDecision


class VocabularyInActionMission(_PublicMissionBase):
    type: Literal["vocabulary_in_action"]
    vocabulary: CoachVocabularyTask


CoachMission = Annotated[
    Union[
        GuidedSceneMission,
        PictureStoryMission,
        ListenRetellMission,
        DecisionResponseMission,
        VocabularyInActionMission,
    ],
    Field(discriminator="type"),
]


class CoachMissionResponse(BaseModel):
    mission: CoachMission
