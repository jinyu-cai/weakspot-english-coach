from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.taxonomy import ERROR_TAXONOMY


ComparisonLanguage = Literal["zh-CN", "en"]
ComparisonMode = Literal["translation", "plain_english"]
EbookModelTier = Literal["fast", "deep"]
EbookFormat = Literal["epub", "pdf"]
EbookStatus = Literal["processing", "ready", "failed"]
EbookAnnotationKind = Literal[
    "word",
    "phrase",
    "collocation",
    "grammar_pattern",
    "complex_sentence",
]
EbookLearningTargetStatus = Literal[
    "provisional",
    "confirmed",
    "learning",
    "mastered",
    "archived",
]


class Ebook(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    author: Optional[str] = None
    format: EbookFormat
    status: EbookStatus
    comparisonLanguage: ComparisonLanguage
    comparisonMode: ComparisonMode
    fileSizeBytes: int = Field(ge=0)
    pageCount: int = Field(ge=0)
    wordCount: int = Field(ge=0)
    lastStudiedPage: Optional[int] = None
    lastStudyRange: Optional[dict] = None
    lastStudyPackId: Optional[str] = None
    error: Optional[str] = None
    createdAt: str
    updatedAt: str


class EbookPage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    bookId: str
    pageNumber: int = Field(ge=1)
    physicalPageNumber: Optional[int] = None
    chapterTitle: Optional[str] = None
    text: str
    wordCount: int = Field(ge=0)
    createdAt: str


class EbookSentenceUnit(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    unitId: str
    pageNumber: int = Field(ge=1)
    position: int = Field(ge=0)
    paragraphIndex: int = Field(ge=0)
    sentenceIndex: int = Field(ge=0)
    unitType: Literal["sentence", "fragment"]
    sourceText: str
    counterpartText: str


class EbookAnnotation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    bookId: str
    studyPackId: Optional[str] = None
    pageNumber: int = Field(ge=1)
    unitId: str
    sourceText: str
    selectedText: str
    startOffset: int = Field(ge=0)
    endOffset: int = Field(gt=0)
    kind: EbookAnnotationKind
    title: str
    meaningInContext: str
    structure: str = ""
    usage: str
    collocations: list[str] = Field(default_factory=list)
    usageRegister: str = ""
    commonPitfalls: list[str] = Field(default_factory=list)
    patternTemplate: str = ""
    clauseBreakdown: list[str] = Field(default_factory=list)
    simplifiedParaphrase: str = ""
    examples: list[str] = Field(default_factory=list)
    transferPrompt: str
    skillCode: str
    modelTier: EbookModelTier = "deep"
    createdAt: str


class EbookStudyPage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    cacheId: str
    bookId: str
    pageNumber: int = Field(ge=1)
    chapterTitle: Optional[str] = None
    comparisonLanguage: ComparisonLanguage
    comparisonMode: ComparisonMode
    modelTier: EbookModelTier = "deep"
    units: list[EbookSentenceUnit] = Field(default_factory=list)
    annotations: list[EbookAnnotation] = Field(default_factory=list)


class EbookStudyPack(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    bookId: str
    bookTitle: str
    startPage: int = Field(ge=1)
    endPage: int = Field(ge=1)
    comparisonLanguage: ComparisonLanguage
    comparisonMode: ComparisonMode
    modelTier: EbookModelTier = "deep"
    status: EbookStatus
    totalPageCount: int = Field(ge=1, le=15)
    completedPageCount: int = Field(ge=0, le=15)
    failedPages: list[int] = Field(default_factory=list)
    error: Optional[str] = None
    pages: Optional[list[EbookStudyPage]] = None
    createdAt: str
    updatedAt: str


class EbookLearningTarget(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    bookId: str
    bookTitle: str
    pageNumber: int = Field(ge=1)
    annotationId: str
    kind: EbookAnnotationKind
    expression: str
    sourceText: str
    meaningInContext: str
    patternTemplate: str = ""
    transferPrompt: str
    comparisonLanguage: ComparisonLanguage
    skillCode: str
    status: EbookLearningTargetStatus
    attemptCount: int = Field(ge=0)
    dueAt: Optional[str] = None
    createdAt: str
    updatedAt: str


class EbookPracticeAttempt(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    clientAttemptId: str
    step: Literal[1, 2, 3]
    responseText: str
    hintUsed: bool
    passed: bool
    score: int = Field(ge=0, le=100)
    feedback: str
    correctedAnswer: str
    createdAt: str


class EbookPracticeExercise(BaseModel):
    model_config = ConfigDict(extra="ignore")

    step: Literal[1, 2, 3]
    title: str
    question: str
    targetExpression: str
    requiresTarget: bool
    sourceSentenceVisible: bool
    sourceText: Optional[str] = None


class EbookPracticeSession(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    bookId: str
    targetId: str
    status: Literal["active", "complete"]
    currentStep: Literal[1, 2, 3]
    delayedReview: bool
    assistanceUsed: bool = False
    attempts: list[EbookPracticeAttempt] = Field(default_factory=list)
    exercise: Optional[EbookPracticeExercise] = None
    createdAt: str
    updatedAt: str


class EbookResponse(BaseModel):
    book: Ebook


class EbookListResponse(BaseModel):
    books: list[Ebook]
    count: int


class EbookPageListResponse(BaseModel):
    pages: list[EbookPage]
    count: int


class EbookStudyPackResponse(BaseModel):
    studyPack: EbookStudyPack


class EbookAnnotationResponse(BaseModel):
    annotation: EbookAnnotation


class EbookLearningTargetResponse(BaseModel):
    target: EbookLearningTarget


class EbookLearningTargetListResponse(BaseModel):
    targets: list[EbookLearningTarget]
    count: int


class EbookPracticeSessionResponse(BaseModel):
    session: EbookPracticeSession


class EbookPracticeAttemptResponse(BaseModel):
    attempt: EbookPracticeAttempt
    target: Optional[EbookLearningTarget] = None
    session: EbookPracticeSession
    duplicate: bool = False


class UpdateEbookRequest(BaseModel):
    comparisonLanguage: ComparisonLanguage


class CreateStudyPackRequest(BaseModel):
    startPage: int = Field(ge=1)
    endPage: int = Field(ge=1)
    modelTier: EbookModelTier = "deep"
    forceRetry: bool = False

    @model_validator(mode="after")
    def validate_range(self):
        if self.endPage < self.startPage:
            raise ValueError("endPage must be greater than or equal to startPage")
        if self.endPage - self.startPage + 1 > 15:
            raise ValueError("A study pack accepts at most 15 consecutive pages")
        return self


class CreateOnDemandAnnotationRequest(BaseModel):
    unitId: str = Field(min_length=1, max_length=160)
    startOffset: int = Field(ge=0)
    endOffset: int = Field(gt=0)

    @model_validator(mode="after")
    def validate_offsets(self):
        if self.endOffset <= self.startOffset:
            raise ValueError("endOffset must be greater than startOffset")
        if self.endOffset - self.startOffset > 600:
            raise ValueError("Select at most 600 characters at a time")
        return self


class SubmitEbookPracticeAttemptRequest(BaseModel):
    responseText: str = Field(min_length=1, max_length=8000)
    clientAttemptId: str = Field(
        min_length=8,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    hintUsed: bool = False

    @field_validator("responseText")
    @classmethod
    def normalize_response(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("responseText must not be blank")
        return normalized


class EbookAIUnit(BaseModel):
    unitId: str = Field(min_length=1, max_length=160)
    counterpartText: str = Field(min_length=1, max_length=4000)


class EbookAIAnnotation(BaseModel):
    unitId: str = Field(min_length=1, max_length=160)
    selectedText: str = Field(min_length=1, max_length=600)
    kind: EbookAnnotationKind
    title: str = Field(min_length=1, max_length=180)
    meaningInContext: str = Field(min_length=1, max_length=1200)
    structure: str = Field(default="", max_length=1600)
    usage: str = Field(min_length=1, max_length=1600)
    collocations: list[str] = Field(default_factory=list, max_length=8)
    usageRegister: str = Field(default="", max_length=500)
    commonPitfalls: list[str] = Field(default_factory=list, max_length=6)
    patternTemplate: str = Field(default="", max_length=600)
    clauseBreakdown: list[str] = Field(default_factory=list, max_length=12)
    simplifiedParaphrase: str = Field(default="", max_length=1200)
    examples: list[str] = Field(default_factory=list, max_length=4)
    transferPrompt: str = Field(min_length=1, max_length=1000)
    skillCode: str = Field(default="sentence.structure", max_length=120)

    @field_validator("skillCode")
    @classmethod
    def supported_skill(cls, value: str) -> str:
        return value if value in ERROR_TAXONOMY else "sentence.structure"


class EbookPageAIResult(BaseModel):
    units: list[EbookAIUnit] = Field(default_factory=list, max_length=240)
    annotations: list[EbookAIAnnotation] = Field(default_factory=list, max_length=8)


class EbookOnDemandAnnotationAIResult(BaseModel):
    annotation: EbookAIAnnotation
