> **⚠️ 实现变更（权威覆盖，优先级高于本文档其余部分）— 2026-06-16**
>
> 真实代码已落地在 `apps/api/`（FastAPI）与 `apps/web/`（v0 + 集成 kit）。以下覆盖适用：
>
> 1. **AI 模型：OpenAI gpt-4o-mini → DeepSeek-V4-Pro。** DeepSeek 不支持 OpenAI 的
>    `client.beta.chat.completions.parse` 强 schema；改用 **JSON mode**
>    (`response_format={"type":"json_object"}`) + Pydantic 校验 + 一次重试。
>    见 `apps/api/app/services/ai_client.py`。`.env` 改用 `DEEPSEEK_API_KEY` /
>    `DEEPSEEK_BASE_URL=https://api.deepseek.com` / `LLM_MODEL=deepseek-v4-pro`
>    （替换下文所有 `OPENAI_*`、`gpt-4o-mini`、第 10 节的 `parse_with_model`）。
> 2. **前端：create-next-app → Vercel v0。** 赛题要求用 v0 生成前端。
>    见 `apps/web/V0_PROMPT.md` 与 `apps/web/README.md`（第 4.1 节据此替换）。
> 3. **DynamoDB Decimal 修复：** boto3 不接受 Python `float`，写入前 float→Decimal、
>    读出后 Decimal→int/float。见 `apps/api/app/db/serialization.py`（第 13/14 节据此增强）。
> 4. **HTTPS/CORS：** Vercel(HTTPS) 前端调用后端必须走 HTTPS（Nginx+Certbot），
>    `CORS_ORIGINS` 必须含 Vercel 域名。
> 5. **提交交付物：** <3min Demo 视频 / 架构图 / DynamoDB 控制台截图 / Vercel 链接+Team ID。
> 6. **依赖与运行：用 uv 管理**（`apps/api/pyproject.toml` + `uv.lock`，Python 锁 3.11），
>    不再用 `requirements.txt` / `pip`。第 6.1 节的 `pip install -r requirements.txt` 用
>    `uv sync` 替换；运行与脚本命令前加 `uv run`（如 `uv run uvicorn app.main:app ...`）。
>
> 下文 OpenAI / create-next-app / pip 片段以本节为准被替换；其余架构、数据模型、API 契约、
> DynamoDB 单表设计、mastery 闭环、分阶段与验收标准仍然有效。
>
> ---

完全可以。你现在的架构应该改成：

**前端：Next.js / React / shadcn/ui，部署在 Vercel。**
**后端：FastAPI，部署在你的 Linux 服务器。**
**数据库：AWS DynamoDB。**
**AI 调用、DynamoDB、学习画像、练习生成全部放后端。**

原因是：前端部署到 Vercel 后，只能安全暴露 `NEXT_PUBLIC_` 开头的变量；OpenAI Key、AWS Key 不能放前端。Next.js 官方也说明，非 `NEXT_PUBLIC_` 环境变量不会暴露给浏览器，而 `NEXT_PUBLIC_` 会被打包进前端代码，所以这里只适合放公开 API 地址。([Next.js][1]) 另外，前后端不同域名时必须处理 CORS，FastAPI 官方建议使用 `CORSMiddleware` 明确允许前端 origin。([FastAPI][2])

下面这份是**前后端分离版开发文档**，可以直接保存为：

```txt
PROJECT_SPEC_SEPARATED.md
```

然后放进 Codex / Claude Code。

---

````md
# PROJECT_SPEC_SEPARATED.md

# Project: WeakSpot English Coach

## 0. 项目目标

构建一个前后端分离的英语学习 AI Web App。

用户通过写作、短答、练习等方式持续输入英文，系统自动分析用户的具体英语弱点，维护用户学习画像，并生成个性化学习计划和针对性练习。

核心闭环：

1. 学生输入英文
2. 后端 AI 诊断错误
3. 后端更新用户学习画像
4. 后端生成个性化学习计划
5. 前端展示学习计划和针对性练习
6. 用户练习后，后端批改并继续更新画像

一句话定位：

> Instead of asking the student what they want to practice, the system discovers what they need to practice.

---

# 1. 架构要求

## 1.1 必须前后端分离

项目必须分成两个独立应用：

```txt
weakspot-english-coach/
  apps/web/
  apps/api/
````

## 1.2 部署方式

### Frontend

* Framework: Next.js App Router
* UI: Tailwind CSS + shadcn/ui
* Deploy: Vercel
* 只负责页面、交互、调用后端 API
* 不允许在前端直接调用 OpenAI
* 不允许在前端直接访问 AWS DynamoDB

### Backend

* Framework: FastAPI
* Language: Python 3.11+
* Deploy: Linux server
* 负责：

  * OpenAI API 调用
  * AI 结构化诊断
  * DynamoDB 读写
  * 学习画像更新
  * 学习计划生成
  * 练习生成与批改
  * CORS
  * API 认证预留

### Database

* AWS DynamoDB
* 使用 single-table design
* 表名：`WeakSpotEnglishCoach`

DynamoDB 建模必须基于访问模式，不要先按传统关系型数据库方式设计表。AWS 官方建议 DynamoDB 设计时先明确系统需要满足的查询模式，并尽量让数据形状贴合查询方式。([AWS Documentation][3])

---

# 2. 技术栈

## 2.1 Frontend 技术栈

```txt
Next.js
TypeScript
Tailwind CSS
shadcn/ui
lucide-react
recharts
date-fns
```

## 2.2 Backend 技术栈

```txt
FastAPI
Uvicorn
Pydantic
OpenAI Python SDK
boto3
python-dotenv
```

FastAPI 适合这个项目，因为它天然支持 Pydantic 数据模型、自动生成 OpenAPI 文档、请求校验和清晰的 API 层结构。FastAPI 的 CORS 文档也明确说明，前端和后端不同 origin 时，需要后端允许对应前端 origin。([FastAPI][2])

## 2.3 AI 输出要求

AI 输出必须使用结构化 JSON，不允许依赖自由文本解析。

OpenAI Structured Outputs 可以让模型输出符合 JSON Schema 的结构化结果，并减少字段缺失、enum 幻觉等问题。([OpenAI Platform][4])

---

# 3. 项目目录结构

## 3.1 Root

```txt
weakspot-english-coach/
  apps/web/
  apps/api/
  README.md
  PROJECT_SPEC_SEPARATED.md
```

---

# 4. Frontend 开发文档

## 4.1 初始化

```bash
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

进入前端目录：

```bash
cd apps/web
```

安装依赖：

```bash
npm install lucide-react recharts date-fns clsx tailwind-merge
npx shadcn@latest init
npx shadcn@latest add button card textarea input badge progress tabs scroll-area separator alert skeleton dialog sheet
```

---

## 4.2 Frontend 环境变量

创建：

```txt
apps/web/.env.local
```

内容：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEMO_USER_ID=demo-user-001
```

Vercel 部署时设置：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
NEXT_PUBLIC_DEMO_USER_ID=demo-user-001
```

注意：

* 前端只能使用 `NEXT_PUBLIC_API_BASE_URL`
* 不要在 frontend 里放 OpenAI Key
* 不要在 frontend 里放 AWS Key
* 不要在 frontend 里放任何数据库连接信息

---

## 4.3 Frontend 文件结构

```txt
apps/web/
  app/
    page.tsx
    dashboard/
      page.tsx
    plan/
      page.tsx
    practice/
      page.tsx
    history/
      page.tsx
    layout.tsx
    globals.css

  components/
    app-shell.tsx
    nav-sidebar.tsx
    diagnostic-input.tsx
    diagnostic-report.tsx
    error-card.tsx
    skill-bar-chart.tsx
    learning-plan-card.tsx
    practice-card.tsx
    submission-history.tsx
    empty-state.tsx
    loading-state.tsx

  lib/
    api-client.ts
    types.ts
    constants.ts
    utils.ts
```

---

## 4.4 Frontend API Client

创建：

```txt
apps/web/lib/api-client.ts
```

```ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.detail || data.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
}

export function getDemoUserId() {
  return process.env.NEXT_PUBLIC_DEMO_USER_ID || "demo-user-001";
}
```

---

## 4.5 Frontend 类型

创建：

```txt
apps/web/lib/types.ts
```

```ts
export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type Severity = "low" | "medium" | "high";

export type PracticeType =
  | "fix_sentence"
  | "fill_blank"
  | "rewrite_sentence";

export interface LearnerProfile {
  userId: string;
  nativeLanguage: string;
  targetLanguage: "English";
  estimatedLevel: CEFRLevel;
  totalSubmissions: number;
  totalPracticeAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillState {
  userId: string;
  skillCode: string;
  label: string;
  zhLabel: string;
  mastery: number;
  errorCount: number;
  correctCount: number;
  lastSeenAt?: string;
  lastPracticedAt?: string;
  updatedAt: string;
}

export interface EnglishError {
  id: string;
  userId: string;
  submissionId: string;
  code: string;
  category: string;
  severity: Severity;
  originalText: string;
  correctedText: string;
  explanationZh: string;
  microLessonZh: string;
  practiceGoal: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  userId: string;
  mode: "writing" | "chat" | "practice";
  originalText: string;
  correctedText?: string;
  cefrEstimate?: CEFRLevel;
  summaryZh?: string;
  createdAt: string;
}

export interface DiagnosticResult {
  cefrEstimate: CEFRLevel;
  overallScore: number;
  summaryZh: string;
  strengthsZh: string[];
  weaknessesZh: string[];
  correctedText: string;
  errors: EnglishError[];
  recommendedNextActionsZh: string[];
}

export interface LearningPlanTask {
  id: string;
  titleZh: string;
  descriptionZh: string;
  practiceType: PracticeType;
  estimatedMinutes: number;
  completed: boolean;
}

export interface LearningPlanDay {
  day: number;
  goalZh: string;
  targetSkillCodes: string[];
  tasks: LearningPlanTask[];
}

export interface LearningPlan {
  id: string;
  userId: string;
  title: string;
  days: LearningPlanDay[];
  createdAt: string;
  updatedAt: string;
}

export interface PracticeExercise {
  id: string;
  userId: string;
  type: PracticeType;
  targetSkillCode: string;
  promptZh: string;
  question: string;
  answer?: string;
  explanationZh?: string;
  createdAt: string;
}
```

---

# 5. Frontend 页面要求

## 5.1 `/`

首页为诊断页面。

功能：

1. 展示输入框
2. 默认 sample text
3. 点击 `Analyze My English`
4. 调用：

```txt
POST /api/v1/diagnose
```

5. 展示返回结果：

   * CEFR level
   * score
   * summary
   * strengths
   * weaknesses
   * corrected text
   * error cards
   * recommended next actions

请求：

```ts
await apiFetch("/api/v1/diagnose", {
  method: "POST",
  body: JSON.stringify({
    userId,
    text,
  }),
});
```

---

## 5.2 `/dashboard`

调用：

```txt
GET /api/v1/profile/demo-user-001
```

展示：

* estimatedLevel
* totalSubmissions
* totalPracticeAttempts
* skill mastery chart
* recent errors
* recommended next action

---

## 5.3 `/plan`

功能：

1. 页面加载时调用：

```txt
GET /api/v1/plan/demo-user-001
```

2. 如果没有 plan，展示按钮：

```txt
Generate 7-Day Plan
```

3. 点击后调用：

```txt
POST /api/v1/plan
```

请求：

```json
{
  "userId": "demo-user-001"
}
```

---

## 5.4 `/practice`

功能：

1. 点击 `Generate Practice`
2. 调用：

```txt
POST /api/v1/practice/generate
```

3. 用户提交答案
4. 调用：

```txt
POST /api/v1/practice/submit
```

---

## 5.5 `/history`

调用：

```txt
GET /api/v1/history/demo-user-001
```

展示：

* recent submissions
* recent errors

---

# 6. Backend 开发文档

## 6.1 初始化

进入 backend：

```bash
mkdir backend
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
```

创建：

```txt
apps/api/requirements.txt
```

```txt
fastapi
uvicorn[standard]
pydantic
pydantic-settings
python-dotenv
openai
boto3
```

安装：

```bash
pip install -r requirements.txt
```

---

## 6.2 Backend 环境变量

创建：

```txt
apps/api/.env
```

```bash
APP_ENV=development
APP_NAME=WeakSpot English Coach API

OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
DYNAMODB_TABLE=WeakSpotEnglishCoach

CORS_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
DEMO_USER_ID=demo-user-001
```

生产环境 Linux 服务器上也要设置同样变量。

---

## 6.3 Backend 文件结构

```txt
apps/api/
  app/
    main.py
    config.py

    api/
      routes/
        health.py
        diagnose.py
        profile.py
        plan.py
        practice.py
        history.py

    core/
      taxonomy.py
      mastery.py

    models/
      common.py
      learner.py
      diagnostic.py
      plan.py
      practice.py

    services/
      ai_client.py
      diagnose_service.py
      plan_service.py
      practice_service.py
      profile_service.py

    db/
      dynamodb.py
      keys.py
      repositories.py

  requirements.txt
  Dockerfile
  docker-compose.yml
```

---

# 7. Backend 基础代码

## 7.1 `app/config.py`

```py
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "WeakSpot English Coach API"

    openai_api_key: str
    openai_model: str = "gpt-4o-mini"

    aws_region: str = "us-east-1"
    aws_access_key_id: str
    aws_secret_access_key: str
    dynamodb_table: str = "WeakSpotEnglishCoach"

    cors_origins: str = "http://localhost:3000"
    demo_user_id: str = "demo-user-001"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
```

---

## 7.2 `app/main.py`

```py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.routes import health, diagnose, profile, plan, practice, history


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(diagnose.router, prefix="/api/v1", tags=["diagnose"])
app.include_router(profile.router, prefix="/api/v1", tags=["profile"])
app.include_router(plan.router, prefix="/api/v1", tags=["plan"])
app.include_router(practice.router, prefix="/api/v1", tags=["practice"])
app.include_router(history.router, prefix="/api/v1", tags=["history"])
```

---

## 7.3 `app/api/routes/health.py`

```py
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}
```

---

# 8. Backend Pydantic Models

## 8.1 `app/models/common.py`

```py
from enum import Enum


class CEFRLevel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class PracticeType(str, Enum):
    fix_sentence = "fix_sentence"
    fill_blank = "fill_blank"
    rewrite_sentence = "rewrite_sentence"
```

---

## 8.2 `app/models/diagnostic.py`

```py
from pydantic import BaseModel, Field
from typing import List
from app.models.common import CEFRLevel, Severity


class DiagnoseRequest(BaseModel):
    userId: str
    text: str = Field(min_length=20, max_length=4000)


class DiagnosticErrorAI(BaseModel):
    code: str
    category: str
    severity: Severity
    originalText: str
    correctedText: str
    explanationZh: str
    microLessonZh: str
    practiceGoal: str


class SkillUpdateAI(BaseModel):
    skillCode: str
    label: str
    zhLabel: str
    masteryDelta: float
    evidenceZh: str


class DiagnosticAIResult(BaseModel):
    cefrEstimate: CEFRLevel
    overallScore: int = Field(ge=0, le=100)
    summaryZh: str
    strengthsZh: List[str]
    weaknessesZh: List[str]
    correctedText: str
    errors: List[DiagnosticErrorAI]
    skillUpdates: List[SkillUpdateAI]
    recommendedNextActionsZh: List[str]
```

---

## 8.3 `app/models/learner.py`

```py
from pydantic import BaseModel
from typing import Optional
from app.models.common import CEFRLevel, Severity


class LearnerProfile(BaseModel):
    userId: str
    nativeLanguage: str = "Chinese"
    targetLanguage: str = "English"
    estimatedLevel: CEFRLevel = CEFRLevel.B1
    totalSubmissions: int = 0
    totalPracticeAttempts: int = 0
    createdAt: str
    updatedAt: str


class SkillState(BaseModel):
    userId: str
    skillCode: str
    label: str
    zhLabel: str
    mastery: float
    errorCount: int
    correctCount: int
    lastSeenAt: Optional[str] = None
    lastPracticedAt: Optional[str] = None
    updatedAt: str


class Submission(BaseModel):
    id: str
    userId: str
    mode: str
    originalText: str
    correctedText: Optional[str] = None
    cefrEstimate: Optional[CEFRLevel] = None
    summaryZh: Optional[str] = None
    createdAt: str


class EnglishError(BaseModel):
    id: str
    userId: str
    submissionId: str
    code: str
    category: str
    severity: Severity
    originalText: str
    correctedText: str
    explanationZh: str
    microLessonZh: str
    practiceGoal: str
    createdAt: str
```

---

## 8.4 `app/models/plan.py`

```py
from pydantic import BaseModel
from typing import List
from app.models.common import PracticeType


class LearningPlanTaskAI(BaseModel):
    titleZh: str
    descriptionZh: str
    practiceType: PracticeType
    estimatedMinutes: int


class LearningPlanDayAI(BaseModel):
    day: int
    goalZh: str
    targetSkillCodes: List[str]
    tasks: List[LearningPlanTaskAI]


class LearningPlanAIResult(BaseModel):
    title: str
    days: List[LearningPlanDayAI]


class GeneratePlanRequest(BaseModel):
    userId: str
```

---

## 8.5 `app/models/practice.py`

```py
from pydantic import BaseModel, Field
from app.models.common import PracticeType


class GeneratePracticeRequest(BaseModel):
    userId: str
    targetSkillCode: str | None = None


class PracticeExerciseAIResult(BaseModel):
    type: PracticeType
    targetSkillCode: str
    promptZh: str
    question: str
    answer: str
    explanationZh: str


class SubmitPracticeRequest(BaseModel):
    userId: str
    exerciseId: str
    userAnswer: str = Field(min_length=1, max_length=2000)


class PracticeGradeAIResult(BaseModel):
    isCorrect: bool
    score: int = Field(ge=0, le=100)
    feedbackZh: str
    correctedAnswer: str
    skillMasteryDelta: float
```

---

# 9. Error Taxonomy

创建：

```txt
apps/api/app/core/taxonomy.py
```

```py
ERROR_TAXONOMY = {
    "grammar.verb_tense": {
        "label": "Verb tense",
        "zhLabel": "动词时态",
        "description": "Incorrect or inconsistent use of verb tense.",
    },
    "grammar.article": {
        "label": "Articles",
        "zhLabel": "冠词",
        "description": "Incorrect or missing a/an/the.",
    },
    "grammar.preposition": {
        "label": "Prepositions",
        "zhLabel": "介词",
        "description": "Incorrect use of prepositions such as in, on, at, for.",
    },
    "grammar.subject_verb_agreement": {
        "label": "Subject-verb agreement",
        "zhLabel": "主谓一致",
        "description": "Subject and verb do not agree in number/person.",
    },
    "vocab.word_choice": {
        "label": "Word choice",
        "zhLabel": "用词不自然",
        "description": "Word is understandable but unnatural or inaccurate.",
    },
    "vocab.repetition": {
        "label": "Repetitive vocabulary",
        "zhLabel": "词汇重复",
        "description": "Same words are repeated too often.",
    },
    "sentence.structure": {
        "label": "Sentence structure",
        "zhLabel": "句子结构",
        "description": "Sentence is awkward, fragmented, or too simple.",
    },
    "sentence.variety": {
        "label": "Sentence variety",
        "zhLabel": "句式单一",
        "description": "Sentences lack variety in structure and length.",
    },
    "discourse.coherence": {
        "label": "Coherence",
        "zhLabel": "逻辑连贯性",
        "description": "Ideas are not connected clearly.",
    },
    "style.register": {
        "label": "Register and tone",
        "zhLabel": "语气和语域",
        "description": "Tone is too casual, too formal, or inappropriate.",
    },
    "clarity.expression": {
        "label": "Clarity",
        "zhLabel": "表达清晰度",
        "description": "Meaning is unclear or hard to follow.",
    },
}
```

---

# 10. OpenAI AI Client

创建：

```txt
apps/api/app/services/ai_client.py
```

```py
from openai import OpenAI
from app.config import settings

client = OpenAI(api_key=settings.openai_api_key)


def parse_with_model(messages, response_model):
    completion = client.beta.chat.completions.parse(
        model=settings.openai_model,
        messages=messages,
        response_format=response_model,
    )

    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raise ValueError("AI returned no parsed structured output")

    return parsed
```

---

# 11. AI Prompts

创建：

```txt
apps/api/app/services/diagnose_service.py
```

```py
from app.services.ai_client import parse_with_model
from app.models.diagnostic import DiagnosticAIResult


def diagnose_english_text(input_text: str) -> DiagnosticAIResult:
    system_prompt = """
You are an expert English tutor for Chinese native speakers.

Analyze the student's English writing and return a structured diagnostic report.

Important requirements:
1. Give feedback in Simplified Chinese.
2. Do not be overly harsh.
3. Focus on recurring patterns, not only isolated typos.
4. Classify each error using one of these categories when possible:
   - grammar.verb_tense
   - grammar.article
   - grammar.preposition
   - grammar.subject_verb_agreement
   - vocab.word_choice
   - vocab.repetition
   - sentence.structure
   - sentence.variety
   - discourse.coherence
   - style.register
   - clarity.expression
5. For each error, provide:
   - original text span
   - corrected version
   - Chinese explanation
   - one micro lesson
   - one practice goal
6. Estimate CEFR level based on the text.
7. Return only the structured object required by the schema.
"""

    user_prompt = f"""
Student text:
\"\"\"
{input_text}
\"\"\"
"""

    return parse_with_model(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_model=DiagnosticAIResult,
    )
```

---

# 12. DynamoDB 设计

## 12.1 表结构

表名：

```txt
WeakSpotEnglishCoach
```

主键：

```txt
PK string
SK string
```

## 12.2 Key Pattern

```txt
PK = USER#{userId}
SK = PROFILE

PK = USER#{userId}
SK = SKILL#{skillCode}

PK = USER#{userId}
SK = SUBMISSION#{createdAt}#{submissionId}

PK = USER#{userId}
SK = ERROR#{createdAt}#{errorId}

PK = USER#{userId}
SK = PLAN#ACTIVE

PK = USER#{userId}
SK = EXERCISE#{exerciseId}

PK = USER#{userId}
SK = ATTEMPT#{createdAt}#{attemptId}
```

---

# 13. Backend DynamoDB Code

## 13.1 `app/db/dynamodb.py`

```py
import boto3
from app.config import settings

dynamodb = boto3.resource(
    "dynamodb",
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
)

table = dynamodb.Table(settings.dynamodb_table)
```

---

## 13.2 `app/db/keys.py`

```py
def user_pk(user_id: str) -> str:
    return f"USER#{user_id}"


def profile_sk() -> str:
    return "PROFILE"


def skill_sk(skill_code: str) -> str:
    return f"SKILL#{skill_code}"


def submission_sk(created_at: str, submission_id: str) -> str:
    return f"SUBMISSION#{created_at}#{submission_id}"


def error_sk(created_at: str, error_id: str) -> str:
    return f"ERROR#{created_at}#{error_id}"


def active_plan_sk() -> str:
    return "PLAN#ACTIVE"


def exercise_sk(exercise_id: str) -> str:
    return f"EXERCISE#{exercise_id}"


def attempt_sk(created_at: str, attempt_id: str) -> str:
    return f"ATTEMPT#{created_at}#{attempt_id}"
```

---

# 14. Repository Layer

创建：

```txt
apps/api/app/db/repositories.py
```

必须实现这些函数：

```py
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from app.db.dynamodb import table
from app.db.keys import (
    user_pk,
    profile_sk,
    skill_sk,
    submission_sk,
    error_sk,
    active_plan_sk,
    exercise_sk,
    attempt_sk,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_profile(user_id: str):
    res = table.get_item(
        Key={
            "PK": user_pk(user_id),
            "SK": profile_sk(),
        }
    )
    return res.get("Item")


def get_or_create_profile(user_id: str):
    existing = get_profile(user_id)
    if existing:
        return existing

    now = now_iso()
    item = {
        "PK": user_pk(user_id),
        "SK": profile_sk(),
        "entityType": "PROFILE",
        "userId": user_id,
        "nativeLanguage": "Chinese",
        "targetLanguage": "English",
        "estimatedLevel": "B1",
        "totalSubmissions": 0,
        "totalPracticeAttempts": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    table.put_item(Item=item)
    return item


def save_profile(profile: dict):
    item = {
        **profile,
        "PK": user_pk(profile["userId"]),
        "SK": profile_sk(),
        "entityType": "PROFILE",
    }
    table.put_item(Item=item)


def list_skills(user_id: str):
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("SKILL#")
    )
    return res.get("Items", [])


def put_skill(skill: dict):
    item = {
        **skill,
        "PK": user_pk(skill["userId"]),
        "SK": skill_sk(skill["skillCode"]),
        "entityType": "SKILL",
    }
    table.put_item(Item=item)


def save_submission(submission: dict):
    item = {
        **submission,
        "PK": user_pk(submission["userId"]),
        "SK": submission_sk(submission["createdAt"], submission["id"]),
        "entityType": "SUBMISSION",
    }
    table.put_item(Item=item)


def list_recent_submissions(user_id: str, limit: int = 10):
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("SUBMISSION#"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return res.get("Items", [])


def save_error(error: dict):
    item = {
        **error,
        "PK": user_pk(error["userId"]),
        "SK": error_sk(error["createdAt"], error["id"]),
        "entityType": "ERROR",
    }
    table.put_item(Item=item)


def list_recent_errors(user_id: str, limit: int = 20):
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("ERROR#"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return res.get("Items", [])


def save_active_plan(plan: dict):
    item = {
        **plan,
        "PK": user_pk(plan["userId"]),
        "SK": active_plan_sk(),
        "entityType": "PLAN",
    }
    table.put_item(Item=item)


def get_active_plan(user_id: str):
    res = table.get_item(
        Key={
            "PK": user_pk(user_id),
            "SK": active_plan_sk(),
        }
    )
    return res.get("Item")


def save_exercise(exercise: dict):
    item = {
        **exercise,
        "PK": user_pk(exercise["userId"]),
        "SK": exercise_sk(exercise["id"]),
        "entityType": "EXERCISE",
    }
    table.put_item(Item=item)


def get_exercise(user_id: str, exercise_id: str):
    res = table.get_item(
        Key={
            "PK": user_pk(user_id),
            "SK": exercise_sk(exercise_id),
        }
    )
    return res.get("Item")


def save_practice_attempt(attempt: dict):
    item = {
        **attempt,
        "PK": user_pk(attempt["userId"]),
        "SK": attempt_sk(attempt["createdAt"], attempt["id"]),
        "entityType": "ATTEMPT",
    }
    table.put_item(Item=item)
```

---

# 15. Mastery Logic

创建：

```txt
apps/api/app/core/mastery.py
```

```py
def clamp(value: float, min_value: float = 0, max_value: float = 100) -> float:
    return max(min_value, min(max_value, value))


def severity_penalty(severity: str) -> float:
    if severity == "low":
        return -3
    if severity == "medium":
        return -7
    return -12


def update_skill_from_error(existing, user_id, skill_code, label, zh_label, severity, now):
    old_mastery = existing.get("mastery", 70) if existing else 70
    old_error_count = existing.get("errorCount", 0) if existing else 0
    old_correct_count = existing.get("correctCount", 0) if existing else 0

    return {
        "userId": user_id,
        "skillCode": skill_code,
        "label": label,
        "zhLabel": zh_label,
        "mastery": clamp(old_mastery + severity_penalty(severity)),
        "errorCount": old_error_count + 1,
        "correctCount": old_correct_count,
        "lastSeenAt": now,
        "lastPracticedAt": existing.get("lastPracticedAt") if existing else None,
        "updatedAt": now,
    }


def update_skill_from_practice(existing, is_correct, mastery_delta, now):
    return {
        **existing,
        "mastery": clamp(existing.get("mastery", 70) + mastery_delta),
        "correctCount": existing.get("correctCount", 0) + (1 if is_correct else 0),
        "errorCount": existing.get("errorCount", 0) + (0 if is_correct else 1),
        "lastPracticedAt": now,
        "updatedAt": now,
    }
```

---

# 16. API Routes

## 16.1 `POST /api/v1/diagnose`

文件：

```txt
apps/api/app/api/routes/diagnose.py
```

请求：

```json
{
  "userId": "demo-user-001",
  "text": "Yesterday I go to my university..."
}
```

返回：

```json
{
  "submission": {},
  "diagnostic": {},
  "updatedSkills": [],
  "profile": {}
}
```

逻辑：

1. 校验输入文本
2. get_or_create_profile
3. 调用 AI 诊断
4. 保存 submission
5. 保存 errors
6. 更新 skill mastery
7. 更新 profile estimatedLevel / totalSubmissions
8. 返回完整结果

实现：

```py
from fastapi import APIRouter, HTTPException
from uuid import uuid4

from app.models.diagnostic import DiagnoseRequest
from app.services.diagnose_service import diagnose_english_text
from app.db.repositories import (
    get_or_create_profile,
    save_profile,
    list_skills,
    put_skill,
    save_submission,
    save_error,
    now_iso,
)
from app.core.mastery import update_skill_from_error
from app.core.taxonomy import ERROR_TAXONOMY

router = APIRouter()


@router.post("/diagnose")
def diagnose(req: DiagnoseRequest):
    try:
        now = now_iso()
        profile = get_or_create_profile(req.userId)

        diagnostic = diagnose_english_text(req.text)

        submission_id = f"sub_{uuid4().hex[:12]}"
        submission = {
            "id": submission_id,
            "userId": req.userId,
            "mode": "writing",
            "originalText": req.text,
            "correctedText": diagnostic.correctedText,
            "cefrEstimate": diagnostic.cefrEstimate.value,
            "summaryZh": diagnostic.summaryZh,
            "createdAt": now,
        }
        save_submission(submission)

        existing_skills = {
            s["skillCode"]: s
            for s in list_skills(req.userId)
        }

        updated_skills = []
        saved_errors = []

        for err in diagnostic.errors:
            error_id = f"err_{uuid4().hex[:12]}"
            error = {
                "id": error_id,
                "userId": req.userId,
                "submissionId": submission_id,
                "code": err.code,
                "category": err.category,
                "severity": err.severity.value,
                "originalText": err.originalText,
                "correctedText": err.correctedText,
                "explanationZh": err.explanationZh,
                "microLessonZh": err.microLessonZh,
                "practiceGoal": err.practiceGoal,
                "createdAt": now,
            }
            save_error(error)
            saved_errors.append(error)

            taxonomy = ERROR_TAXONOMY.get(err.code, {
                "label": err.code,
                "zhLabel": err.code,
            })

            skill = update_skill_from_error(
                existing=existing_skills.get(err.code),
                user_id=req.userId,
                skill_code=err.code,
                label=taxonomy["label"],
                zh_label=taxonomy["zhLabel"],
                severity=err.severity.value,
                now=now,
            )
            put_skill(skill)
            updated_skills.append(skill)

        profile["estimatedLevel"] = diagnostic.cefrEstimate.value
        profile["totalSubmissions"] = profile.get("totalSubmissions", 0) + 1
        profile["updatedAt"] = now
        save_profile(profile)

        return {
            "submission": submission,
            "diagnostic": {
                **diagnostic.model_dump(),
                "errors": saved_errors,
            },
            "updatedSkills": updated_skills,
            "profile": profile,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 16.2 `GET /api/v1/profile/{user_id}`

文件：

```txt
apps/api/app/api/routes/profile.py
```

返回：

```json
{
  "profile": {},
  "skills": [],
  "recentErrors": [],
  "recentSubmissions": []
}
```

实现：

```py
from fastapi import APIRouter
from app.db.repositories import (
    get_or_create_profile,
    list_skills,
    list_recent_errors,
    list_recent_submissions,
)

router = APIRouter()


@router.get("/profile/{user_id}")
def get_profile_page_data(user_id: str):
    profile = get_or_create_profile(user_id)

    return {
        "profile": profile,
        "skills": list_skills(user_id),
        "recentErrors": list_recent_errors(user_id, limit=10),
        "recentSubmissions": list_recent_submissions(user_id, limit=10),
    }
```

---

## 16.3 `POST /api/v1/plan`

请求：

```json
{
  "userId": "demo-user-001"
}
```

逻辑：

1. 获取 profile
2. 获取 skills
3. 获取 recent errors
4. AI 生成 7 天计划
5. 保存为 `PLAN#ACTIVE`
6. 返回 plan

---

## 16.4 `GET /api/v1/plan/{user_id}`

返回当前 active plan。

如果没有：

```json
{
  "plan": null
}
```

---

## 16.5 `POST /api/v1/practice/generate`

请求：

```json
{
  "userId": "demo-user-001",
  "targetSkillCode": "grammar.verb_tense"
}
```

如果没有 targetSkillCode：

1. 找 mastery 最低的 skill
2. 如果没有 skill，默认用 `grammar.verb_tense`

返回：

```json
{
  "exercise": {}
}
```

---

## 16.6 `POST /api/v1/practice/submit`

请求：

```json
{
  "userId": "demo-user-001",
  "exerciseId": "ex_123",
  "userAnswer": "Yesterday I went to the library."
}
```

逻辑：

1. 读取 exercise
2. AI 批改
3. 保存 attempt
4. 更新 skill mastery
5. 返回 feedback

---

## 16.7 `GET /api/v1/history/{user_id}`

返回：

```json
{
  "submissions": [],
  "errors": []
}
```

---

# 17. Backend Plan Service Prompt

创建：

```txt
apps/api/app/services/plan_service.py
```

```py
from app.services.ai_client import parse_with_model
from app.models.plan import LearningPlanAIResult


def generate_learning_plan(profile, skills, recent_errors) -> LearningPlanAIResult:
    system_prompt = """
You are an adaptive English learning coach.

Create a 7-day personalized learning plan for this learner.

Requirements:
1. Output Chinese learning goals and task descriptions.
2. Each day should have 2 or 3 tasks.
3. Each task must target one or more weak skills.
4. Prefer short, focused practice over generic lessons.
5. Practice types must be one of:
   - fix_sentence
   - fill_blank
   - rewrite_sentence
6. Do not create speaking or pronunciation tasks in MVP.
7. Return only the structured object required by the schema.
"""

    user_prompt = f"""
Learner profile:
{profile}

Current skill states:
{skills}

Recent errors:
{recent_errors}
"""

    return parse_with_model(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_model=LearningPlanAIResult,
    )
```

---

# 18. Backend Practice Service Prompt

创建：

```txt
apps/api/app/services/practice_service.py
```

```py
from app.services.ai_client import parse_with_model
from app.models.practice import PracticeExerciseAIResult, PracticeGradeAIResult


def generate_practice_exercise(skill_code, zh_label, cefr_level, recent_error_examples):
    system_prompt = """
You are creating one targeted English exercise for a Chinese native speaker.

Requirements:
1. Generate exactly one exercise.
2. The exercise should target the weakness directly.
3. The difficulty should match the learner level.
4. Use Chinese for instructions and explanation.
5. Exercise type must be one of:
   - fix_sentence
   - fill_blank
   - rewrite_sentence
6. Include the correct answer and a short Chinese explanation.
7. Return only the structured object required by the schema.
"""

    user_prompt = f"""
Target skill:
{skill_code} / {zh_label}

Estimated CEFR level:
{cefr_level}

Recent learner error examples:
{recent_error_examples}
"""

    return parse_with_model(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_model=PracticeExerciseAIResult,
    )


def grade_practice(question, expected_answer, user_answer, target_skill_code):
    system_prompt = """
You are grading a targeted English exercise.

Requirements:
1. Decide if the answer is correct.
2. Give a score from 0 to 100.
3. Give feedback in Simplified Chinese.
4. Provide corrected answer.
5. Provide a skillMasteryDelta:
   - +6 to +10 if clearly correct
   - +1 to +5 if partially correct
   - -3 to 0 if incorrect
6. Return only the structured object required by the schema.
"""

    user_prompt = f"""
Target skill:
{target_skill_code}

Question:
{question}

Expected answer:
{expected_answer}

Student answer:
{user_answer}
"""

    return parse_with_model(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_model=PracticeGradeAIResult,
    )
```

---

# 19. Linux Server 部署

## 19.1 Backend Dockerfile

创建：

```txt
apps/api/Dockerfile
```

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 19.2 Docker Compose

创建：

```txt
apps/api/docker-compose.yml
```

```yaml
services:
  api:
    build: .
    container_name: weakspot-api
    restart: always
    ports:
      - "8000:8000"
    env_file:
      - .env
```

启动：

```bash
docker compose up -d --build
```

测试：

```bash
curl http://localhost:8000/api/v1/health
```

---

## 19.3 Nginx 反向代理

假设后端域名是：

```txt
api.your-domain.com
```

Nginx 配置：

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

然后用 Certbot 配 HTTPS：

```bash
sudo certbot --nginx -d api.your-domain.com
```

生产环境前端的环境变量应改成：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

后端 `.env` 的 CORS 应包含：

```bash
CORS_ORIGINS=https://your-vercel-app.vercel.app,https://your-custom-frontend-domain.com
```

---

# 20. Vercel 部署 Frontend

在 Vercel 导入 GitHub repo 时：

* Root Directory 选择：

```txt
frontend
```

* Build Command:

```txt
npm run build
```

* Output 默认即可。

设置 Environment Variables：

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
NEXT_PUBLIC_DEMO_USER_ID=demo-user-001
```

注意：如果后端 API 地址换了，Vercel 需要重新部署，因为 `NEXT_PUBLIC_` 变量会在 build 时进入前端 bundle。([Next.js][1])

---

# 21. CORS 要求

后端必须允许：

```txt
http://localhost:3000
https://your-vercel-app.vercel.app
https://your-custom-frontend-domain.com
```

不要在生产环境长期使用：

```py
allow_origins=["*"]
```

除非 demo 阶段临时使用。

FastAPI 文档说明，如果前端和后端不同 origin，浏览器会发送跨域请求，后端必须通过 CORS header 明确授权该 origin。([FastAPI][2])

---

# 22. Demo Flow

最终 demo 必须支持以下流程：

## Step 1

打开 Vercel 前端。

## Step 2

在 Diagnose 页面输入：

```txt
Yesterday I go to my university and I meet my friend. We talk about our project, but I feel my English is not very good. Sometimes I cannot explain my idea clearly, and I always use simple words. I want to improve my speaking and writing because I need to do presentation in class.
```

## Step 3

点击：

```txt
Analyze My English
```

前端调用 Linux 后端：

```txt
POST https://api.your-domain.com/api/v1/diagnose
```

## Step 4

后端：

1. 调用 OpenAI
2. 得到结构化诊断 JSON
3. 写入 DynamoDB
4. 更新 learner profile
5. 返回结果

## Step 5

前端展示：

* CEFR: A2 / B1
* 动词时态错误
* 词汇重复
* 表达清晰度问题
* corrected text
* recommended next actions

## Step 6

进入 Dashboard。

展示：

* skill mastery chart
* recent errors
* weakest skills

## Step 7

进入 Plan。

点击：

```txt
Generate 7-Day Plan
```

展示个性化计划。

## Step 8

进入 Practice。

生成针对最低 mastery skill 的练习。

---

# 23. 前后端 API Contract

所有 API base URL：

```txt
/api/v1
```

## Backend Endpoints

```txt
GET  /api/v1/health

POST /api/v1/diagnose

GET  /api/v1/profile/{user_id}

POST /api/v1/plan
GET  /api/v1/plan/{user_id}

POST /api/v1/practice/generate
POST /api/v1/practice/submit

GET  /api/v1/history/{user_id}
```

---

# 24. Codex / Claude Code 开发顺序

## Phase 1: Backend Skeleton

先完成：

* FastAPI app
* config
* CORS
* health endpoint
* Dockerfile
* docker-compose

验收：

```bash
curl http://localhost:8000/api/v1/health
```

返回：

```json
{"status":"ok"}
```

---

## Phase 2: Frontend Skeleton

完成：

* Next.js app
* shadcn/ui
* sidebar
* 5 个页面
* api-client.ts
* mock UI

验收：

```bash
cd apps/web
npm run dev
```

页面可打开，导航可点击。

---

## Phase 3: DynamoDB

完成：

* DynamoDB table
* repositories.py
* get_or_create_profile
* list_skills
* save_submission
* save_error

验收：

```bash
curl http://localhost:8000/api/v1/profile/demo-user-001
```

返回 profile。

---

## Phase 4: Diagnose API

完成：

* Pydantic AI schema
* OpenAI client
* diagnose_service
* POST /api/v1/diagnose
* 保存 submission/errors/skills/profile

验收：

```bash
curl -X POST http://localhost:8000/api/v1/diagnose \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user-001","text":"Yesterday I go to school and I meet my friend."}'
```

必须返回 structured diagnostic。

---

## Phase 5: Connect Frontend Diagnose

完成：

* 首页调用真实后端
* loading state
* error state
* diagnostic report UI

验收：

前端能通过 Vercel 或 localhost 调用后端。

---

## Phase 6: Dashboard

完成：

* GET /api/v1/profile/{user_id}
* chart
* recent errors

---

## Phase 7: Plan

完成：

* plan AI schema
* POST /api/v1/plan
* GET /api/v1/plan/{user_id}
* frontend plan page

---

## Phase 8: Practice

完成：

* generate practice
* submit practice
* grade answer
* update mastery
* frontend practice page

---

## Phase 9: Deployment

完成：

* backend deploy to Linux
* Nginx reverse proxy
* HTTPS
* Vercel frontend deploy
* CORS production origin

---

# 25. 验收标准

## 25.1 Backend

必须满足：

```bash
GET /api/v1/health
```

返回 ok。

```bash
POST /api/v1/diagnose
```

返回结构化诊断结果。

```bash
GET /api/v1/profile/demo-user-001
```

返回 profile、skills、recentErrors、recentSubmissions。

---

## 25.2 Frontend

必须满足：

* Vercel 前端能打开
* 可以提交英文文本
* 可以展示 AI 诊断
* Dashboard 能展示用户弱点
* Plan 能生成学习计划
* Practice 能生成练习并批改

---

## 25.3 数据闭环

必须能证明：

1. 用户提交英文
2. 后端识别错误
3. DynamoDB 保存错误
4. Skill mastery 变化
5. Plan 基于弱点生成
6. Practice 基于最低 mastery skill 生成
7. 练习后 mastery 再次更新

---

# 26. 黑客松展示重点

评委最需要看到的不是你做了一个聊天机器人，而是你做了一个自适应学习系统。

重点展示：

1. AI 不是只回答问题，而是提取结构化错误。
2. 每个错误都会影响用户画像。
3. 用户画像会影响下一步学习计划。
4. 练习不是随机生成，而是来自用户真实弱点。
5. 前端、后端、数据库、AI 构成完整闭环。

Demo 话术：

> Most AI English tools wait for the learner to ask the right question. Our system observes the learner’s actual mistakes, builds a weakness profile, and automatically turns those mistakes into a personalized learning path.

---

# 27. 给 Codex / Claude Code 的执行指令

把下面这段作为第一条 prompt：

```txt
Read PROJECT_SPEC_SEPARATED.md carefully.

Build this project as a apps/web/backend separated app.

Architecture:
- apps/web/ is a Next.js app deployed to Vercel.
- apps/api/ is a FastAPI app deployed to a Linux server.
- Frontend must not contain OpenAI or AWS secrets.
- Frontend must call backend using NEXT_PUBLIC_API_BASE_URL.
- Backend owns all AI, DynamoDB, learner profile, plan, and practice logic.

Implement phase by phase:
1. Backend skeleton
2. Frontend skeleton
3. DynamoDB repositories
4. Diagnose API
5. Connect frontend diagnose page
6. Dashboard
7. Plan
8. Practice
9. Deployment files

Do not use Next.js API routes.
Do not put backend logic inside frontend.
Do not skip error handling.
Keep the app demo-ready for a hackathon.
```

End of spec.

````

---

你现在应该把上一版文档里的 **Next.js API Routes** 全部删掉，改成这版的：

```txt
frontend -> fetch -> Linux FastAPI backend -> OpenAI + DynamoDB
````

这个架构更干净，也更符合你“前端 Vercel，后端 Linux 服务器”的要求。

[1]: https://nextjs.org/docs/app/guides/environment-variables "Guides: Environment Variables | Next.js"
[2]: https://fastapi.tiangolo.com/tutorial/cors/ "CORS (Cross-Origin Resource Sharing) - FastAPI"
[3]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html "NoSQL design for DynamoDB - Amazon DynamoDB"
[4]: https://platform.openai.com/docs/guides/structured-outputs "Structured model outputs | OpenAI API"
