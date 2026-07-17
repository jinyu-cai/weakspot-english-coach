# WeakSpot English Coach：从零读懂项目的学习指南

> 适合读者：学过一点数据结构、网络、操作系统或编程基础，但没有 Python、FastAPI、云部署和完整 Web 工程经验的人。
>
> 最后核对日期：2026-07-13（`main` @ `50e6d62`）。本文以当前代码为准，不再作为“让 AI 生成项目的规格”，而是作为读懂真实实现的学习笔记。

## 0. 先说明：原来的笔记有什么问题

原来的 `development.md` 有 2400 多行，看起来很详细，但它其实是项目早期的生成规格草稿，不是按当前代码编写的教程。它存在这些问题：

- 大量示例仍使用 `pip`、`requirements.txt`、OpenAI 和旧目录，当前项目实际使用 `uv`、`pyproject.toml`、`apps/api` 和 Qwen/DeepSeek。
- 只讲了最早的 Diagnose、Profile、Plan、Practice，没有覆盖登录、限流、文字/语音聊天、ChatGPT 导入、学习笔记、Daily Wins、服务端模型选择和 MemoryAgent。
- 代码片段是“准备实现什么”，不一定等于仓库里“现在怎样实现”。
- 它直接给出长代码，但没有先解释 HTTP、依赖注入、Pydantic、ASGI、线程池、DynamoDB 访问模式等概念。
- 新手很难区分 route、service、repository、model 各自负责什么。

因此本文已经重写。旧内容仍可从 Git 历史查看，但不应继续作为实现依据。

本次审计和补齐结果：

| 主题 | 旧笔记状态 | 现在的位置 |
| --- | --- | --- |
| Python 入门语法 | 基本没有，直接贴长代码 | 第 4 章 |
| FastAPI/Uvicorn/Depends/Streaming | 只给样板，缺少运行原理 | 第 5 章 |
| route/service/repository 分层 | 文件很多，但没有职责边界 | 第 6 章 |
| 当前 Diagnose 完整链路 | 示例已与真实实现分叉 | 第 7 章 |
| Qwen/DeepSeek/Auto/Deep/Fast/BYOK | 缺失 | 第 8 章 |
| DynamoDB Decimal/TTL/当前 key | 部分过时 | 第 9 章 |
| Chat、Import、Notes、Stats、OAuth | 缺失 | 第 10.1–10.9 节 |
| Coach 五类任务、动态场景、情境词汇、Input Lab 2.0、Speech | 缺失 | 第 8.7、10.10–10.15 节 |
| MemoryAgent | 完全缺失 | 第 11 章 |
| 自适应练习决策 | 仍写“只选最低 mastery” | 第 12 章 |
| 前端请求与环境变量 | 偏脚手架说明 | 第 13 章 |
| 无密钥本地学习、测试、部署 | 命令和依赖过时 | 第 14–16 章 |
| 工程取舍和后续学习路径 | 缺失 | 第 18–21 章 |

当前文档的分工如下：

| 文档 | 用途 | 适合什么时候看 |
| --- | --- | --- |
| `README.md` | 产品、功能和技术栈总览 | 第一次认识项目 |
| `development.md` | 从 Python/FastAPI 基础到完整请求链路 | 系统学习代码 |
| `apps/api/README.md` | 后端命令、接口和配置速查 | 实际启动或调试后端 |
| `apps/web/README.md` | 前端运行和后端连接方式 | 实际启动或修改前端 |
| `LOCAL_TESTING.md` | 分层测试与发布前检查 | 写完代码之后 |
| `docs/ARCHITECTURE.md` | 当前生产架构和数据流 | 已理解基本代码分层后 |
| `docs/MEMORY_AGENT_DESIGN.md` | MemoryAgent 算法设计 | 学习新功能时 |
| `docs/COACH_MODE_P0.md` | Coach、情境词汇、字幕实验的产品与安全边界 | 跟读引导式学习闭环前 |
| `docs/ALIBABA_QWEN_DEPLOYMENT.md` | Alibaba/Qwen 部署步骤 | 准备上线时 |

## 1. 用一句话理解这个项目

WeakSpot 不是“再做一个聊天机器人”，而是把用户每次真实英语输入变成长期学习状态：

```text
用户写作 / 对话 / 导入记录 / 做练习 / 完成 Coach 任务
  -> AI 返回结构化结果
  -> 后端保存错误、掌握度、笔记和长期记忆
  -> 下一次只召回相关信息
  -> 自动选择更合适的计划、技能和题型
```

最重要的工程边界是：

```text
浏览器
  -> Next.js 前端（显示页面、收集输入）
  -> HTTPS + JSON
  -> FastAPI 后端（身份、业务规则、AI、数据库）
  -> Qwen / DeepSeek（文字生成）+ OpenAI Realtime / Speech（语音）
  -> DynamoDB
```

浏览器永远不应该直接拿到服务器的 Qwen、DeepSeek、AWS 或 OAuth secret。

## 2. 先补齐最少的 Web 基础

### 2.1 客户端和服务器

- **客户端**：用户浏览器里的 Next.js/React 代码。
- **服务器**：Linux 上运行的 FastAPI 进程。
- **API**：两者约定好的通信接口。
- **数据库**：服务器保存长期状态的地方。

例如浏览器请求：

```http
POST /api/v1/diagnose
Content-Type: application/json

{
  "userId": "demo-user-001",
  "text": "Yesterday I go to school...",
  "diagnosisMode": "fast",
  "outputLanguage": "zh-CN"
}
```

这里包含四个重要部分：

1. `POST` 是 HTTP method，表示提交数据。
2. `/api/v1/diagnose` 是 path。
3. `Content-Type` 是 header，说明 body 是 JSON。
4. `{...}` 是 request body。

FastAPI 处理后返回 JSON，前端再把 JSON 渲染成诊断报告。

### 2.2 JSON 不是 Python 字典，但很像

JSON：

```json
{"score": 88, "errors": ["grammar.article"], "duplicate": false}
```

Python 读入后通常变成：

```py
{"score": 88, "errors": ["grammar.article"], "duplicate": False}
```

主要区别包括：JSON 使用 `true/false/null`，Python 使用 `True/False/None`。

### 2.3 CORS 是什么

线上前端和后端是不同 origin：

```text
https://englearning.jinxxx.de
https://enapi.jinxxx.de
```

浏览器默认不允许一个 origin 随意读取另一个 origin。FastAPI 在 `app/main.py` 中通过 `CORSMiddleware` 明确允许生产前端和 Vercel Preview。CORS 是浏览器安全规则，不是后端登录机制。

## 3. 当前仓库地图

```text
weakspot-english-coach/
├── apps/
│   ├── api/                  # Python + FastAPI 后端
│   │   ├── app/
│   │   │   ├── main.py      # 创建 FastAPI app、挂载中间件和 routers
│   │   │   ├── config.py    # 读取环境变量
│   │   │   ├── api/
│   │   │   │   ├── deps.py  # 身份、限流、模型选择依赖
│   │   │   │   └── routes/  # HTTP endpoints
│   │   │   ├── models/      # Pydantic 输入/输出结构
│   │   │   ├── services/    # AI、Memory、计划、练习等业务逻辑
│   │   │   ├── db/          # DynamoDB 与 repository
│   │   │   └── core/        # mastery、taxonomy 等纯规则
│   │   ├── scripts/         # 建表、测试、benchmark、本地服务器
│   │   ├── pyproject.toml    # Python 依赖定义
│   │   ├── uv.lock           # 锁定依赖版本
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   └── web/                  # TypeScript + Next.js 前端
│       ├── app/              # App Router 页面
│       ├── components/       # 可复用 UI/业务组件
│       └── lib/              # API client、类型、i18n、设置
├── docs/                     # 架构、MemoryAgent、部署和提交材料
├── README.md
├── LOCAL_TESTING.md
└── development.md            # 本学习指南
```

读后端代码时，建议一直记住这条链：

```text
models -> routes -> services -> repositories -> DynamoDB
```

它不是强制每次都经过所有层，而是各层职责的方向。

## 4. 本项目需要的 Python 基础

你不需要先学完整本 Python 教材。先理解项目里反复出现的语法即可。

### 4.1 Python 文件、模块和包

`apps/api/app/services/memory_service.py` 对应模块：

```py
app.services.memory_service
```

因此其他文件这样导入：

```py
from app.services.memory_service import retrieve_memory_pack
```

后端命令要从 `apps/api` 运行，是因为此时 Python 才能正确找到顶层 `app` 包。

### 4.2 缩进就是语法

Python 不用 `{}` 包围函数和条件块，而依赖缩进：

```py
def clamp(value: float, low: float = 0, high: float = 100) -> float:
    if value < low:
        return low
    return min(value, high)
```

项目统一使用 4 个空格。缩进错误可能让代码无法启动，或让逻辑进入错误的条件块。

### 4.3 常见数据类型

```py
name = "grammar.article"       # str
score = 88                     # int
mastery = 73.5                 # float
enabled = True                 # bool
missing = None                 # 没有值
errors = ["a", "b"]           # list
profile = {"level": "B1"}     # dict
```

这个项目在 service 和 repository 之间大量使用 `dict`。Pydantic model 则用于 API 和 AI 输出边界。

### 4.4 函数和 type hints

```py
def get_memory(user_id: str, memory_id: str) -> Optional[dict]:
    ...
```

- `user_id: str` 表示期望字符串。
- `-> Optional[dict]` 表示返回字典或 `None`。
- type hint 默认不会像 Java 编译器一样强制所有运行时类型，但编辑器、Pydantic 和测试会利用它。

当前代码也使用 Python 3.10+ 的写法：

```py
LLMProviderConfig | None
list[dict]
dict[str, int]
```

### 4.5 `Literal` 和 `Optional`

```py
MemoryKind = Literal["preference", "goal", "strategy", "weakness", "episode"]
```

这表示值只能从五个字符串中选择。`Optional[str]` 表示字符串或 `None`。

### 4.6 f-string

```py
def user_pk(user_id: str) -> str:
    return f"USER#{user_id}"
```

如果 `user_id == "abc"`，结果就是 `USER#abc`。

### 4.7 list/dict comprehension

```py
existing_skills = {skill["skillCode"]: skill for skill in list_skills(user_id)}
```

它把技能列表转换为以 `skillCode` 为 key 的字典，便于 O(1) 查找。

### 4.8 `*` 和 `**`

```py
all_candidates = [*ai_candidates, *heuristic_candidates]
result = {**old_record, "status": "forgotten"}
```

- `*list` 展开列表。
- `**dict` 展开字典。
- 后面的相同 key 会覆盖前面的值。

### 4.9 class、Pydantic 和 dataclass

Pydantic model：

```py
class RetrieveMemoryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    tokenBudget: int = Field(default=700, ge=100, le=2000)
```

它负责验证外部输入。空 query 或过大的 token budget 会在进入业务函数前被 FastAPI 拒绝。

`@dataclass` 更适合内部配置对象：

```py
@dataclass(frozen=True)
class LLMProviderConfig:
    api_key: str
    base_url: str
    model: str
```

它没有 HTTP schema 的职责，只是让内部数据比裸 dict 更清晰。

### 4.10 异常处理

```py
try:
    memory_pack = retrieve_memory_pack(...)
except Exception:
    logger.exception("memory retrieval failed")
    memory_pack = {"text": "", "items": []}
```

Memory 是增强功能，所以失败时允许主诊断继续。相反，如果请求输入本身错误，会主动抛出 `HTTPException`。

### 4.11 `def`、`async def` 和 `await`

- `def`：普通同步函数。
- `async def`：协程函数，可以在等待网络或定时器时让事件循环处理其他请求。
- `await`：等待另一个协程。

本项目的 DynamoDB boto3 和普通 OpenAI client 是同步库。`diagnose.py` 用 `run_in_executor` 把耗时同步工作放入线程池，避免阻塞 FastAPI 的事件循环。不要机械地把所有函数都改成 `async def`；如果内部仍调用阻塞函数，反而可能拖慢整个服务。

## 5. FastAPI 从零理解

### 5.1 FastAPI 和 Uvicorn 分别是什么

- **FastAPI**：声明路由、验证输入、生成 OpenAPI、组织依赖的框架。
- **Uvicorn**：真正监听端口并把 HTTP 请求交给 FastAPI 的 ASGI server。

启动命令：

```bash
cd apps/api
uv run uvicorn app.main:app --reload --port 8000
```

`app.main:app` 的含义是：导入 `app/main.py`，找到其中名为 `app` 的对象。

### 5.2 应用入口

`apps/api/app/main.py` 做三件事：

1. `app = FastAPI(...)` 创建应用。
2. 添加 CORS middleware。
3. 用 `include_router` 挂载所有 route。

router 让功能可以分文件维护，而不是把全部 endpoint 写进 `main.py`。

### 5.3 decorator 如何变成 API

```py
router = APIRouter(prefix="/memory")

@router.get("/traces")
def traces(...):
    ...
```

再加上 `main.py` 的 `/api/v1` prefix，最终路径是：

```text
GET /api/v1/memory/traces
```

### 5.4 请求验证

```py
@router.post("/retrieve")
def retrieve(req: RetrieveMemoryRequest, ...):
    ...
```

FastAPI 会：

1. 读取 JSON body。
2. 用 `RetrieveMemoryRequest` 验证和转换。
3. 验证成功后调用函数。
4. 验证失败则自动返回 422。

你不需要在每个 route 手写 `if query == ""`。

### 5.5 `Depends`：FastAPI 的依赖注入

```py
identity: Identity = Depends(rate_limited("memory"))
```

在 route 真正执行前，FastAPI 会先执行依赖函数。这里依次完成：

- 从 cookie/header 解析身份。
- 判断 owner/member/user/guest。
- 检查当日额度。
- 把得到的 `Identity` 传入 route。

模型选择同样是依赖：

```py
llm_provider: LLMProviderConfig | None = Depends(get_llm_provider)
```

### 5.6 为什么不能相信 body 里的 `userId`

攻击者可以自己修改 JSON。因此诊断 route 会执行：

```py
req.userId = identity.user_id
```

数据库身份来自服务端解析的 cookie/header，而不是客户端自报的 `userId`。这是本项目很重要的安全边界。

### 5.7 StreamingResponse 为什么存在

深度诊断可能超过反向代理的空闲超时。`diagnose.py` 返回 `StreamingResponse`，先发送空白 keepalive，再等待线程池中的 LLM 和持久化工作。

响应仍然是合法 JSON，因为 JSON parser 会忽略开头空白。代码还要把依赖设置的 guest cookie 复制到真正的 streaming response，否则新访客下一次请求会变成另一个用户。

### 5.8 自动 API 文档

启动后端后打开：

```text
http://localhost:8000/docs
```

这是学习 FastAPI 最好的入口之一。你可以看到 path、method、request schema 和 response，并直接发送测试请求。

## 6. 项目为什么要分层

| 层 | 负责什么 | 不应该做什么 |
| --- | --- | --- |
| `models/` | 定义输入输出结构和校验 | 不访问数据库 |
| `api/routes/` | HTTP、依赖、状态码、组织流程 | 不堆放所有算法细节 |
| `services/` | AI prompt、Memory、决策、业务计算 | 不关心页面长什么样 |
| `db/repositories.py` | 封装 DynamoDB 读写和查询 | 不生成学习计划 |
| `core/` | taxonomy、mastery 等纯规则 | 不调用网络 |
| `config.py` | 环境配置和默认值 | 不放真实 secret |

分层的价值不是“文件更多显得专业”，而是让你能够单独测试和替换每个边界。

例如切换 Qwen/DeepSeek 时，大部分 route 不需要变化；它们仍然调用 `parse_with_model`。

## 7. 完整跟读一次 Diagnose 请求

这是理解整个项目最重要的一章。

### 7.1 前端发请求

前端通过 `apps/web/lib/api-client.ts` 请求 `/diagnose`。API client 统一处理：

- `NEXT_PUBLIC_API_BASE_URL`
- cookie
- 输出语言
- 服务端模型 ID 或 BYOK headers
- 429 登录提示
- JSON/error 解析

### 7.2 FastAPI 解析依赖

`apps/api/app/api/routes/diagnose.py` 先执行：

1. `get_llm_provider`：解析 Auto/Deep/Fast/自定义模型。
2. `rate_limited("diagnose")`：解析身份并检查额度。
3. 用服务端身份覆盖 `req.userId`。

### 7.3 快速预检查

`_pre_check`：

- 读取或创建 profile。
- 对输入文字和输出语言生成 hash。
- 如果相同输入已经诊断过，重建以前的结果，避免重复收费和重复写数据。

### 7.4 召回相关长期记忆

在调用 LLM 前，`retrieve_memory_pack` 根据当前文字查询该用户的 Memory。失败时只记录日志，诊断继续执行。

### 7.5 调用结构化 AI

`diagnose_service.py`：

- Fast 模式选择 fast model。
- Deep 模式选择 deep model。
- 加入输出语言要求、Memory extraction instruction 和 Memory Pack。
- 调用 `parse_with_model(..., response_model=DiagnosticAIResult)`。

`ai_client.py`：

1. 把 Pydantic JSON schema 放进 system prompt。
2. 调用 OpenAI-compatible `chat.completions.create`。
3. 要求 JSON mode。
4. 用 `DiagnosticAIResult.model_validate_json` 再验证。
5. JSON 不合法时带校验错误重试一次。

AI 返回的是候选数据，不直接等于可信数据库写入；Pydantic 是边界验证层。

### 7.6 保存业务数据

`_llm_and_persist` 依次保存：

- submission
- 每条 diagnostic error
- learning notes
- 更新后的 skills/mastery
- profile
- submission hash

### 7.7 更新 mastery

`apps/api/app/core/mastery.py` 的简化规则：

```text
low error    -> mastery -3
medium error -> mastery -7
high error   -> mastery -12
```

练习完成后再根据 `skillMasteryDelta` 提升或降低。所有分数限制在 0 到 100。

### 7.8 保存 Memory

候选来源包括：

- Qwen 在原诊断结构中返回的 `memoryCandidates`
- 对用户文字的保守 heuristic
- 从已确认错误生成的 deterministic weakness

`remember_candidates` 再负责校验、合并、冲突替换、embedding 和容量控制。

### 7.9 返回前端

最终 response 除诊断外还包括：

- `notes`
- `memoriesSaved`
- `memoryRecall.traceId`
- 被召回的 memory IDs 和 token 估算

这就是一条完整的工程链路：HTTP → 身份 → 模型 → Memory → AI → 数据库 → JSON。

## 8. AI provider 和新的模型选择功能

### 8.1 为什么可以同时支持多个提供方

Qwen、DeepSeek 和很多服务都提供近似 OpenAI Chat Completions 的接口。项目统一使用 OpenAI Python SDK，但传入不同的 `base_url`、key 和 model。

默认优先级在 `config.py`：

```text
有 QWEN_MODEL_STUDIO_API_KEY -> Qwen
否则有 OPENAI_COMPAT_API_KEY -> provider-neutral 配置
否则 -> 旧 DeepSeek 配置
```

### 8.2 Auto、Deep 和 Fast

`GET /api/v1/llm/models` 只返回安全的 ID、标签和模型名，不返回 key/base URL。

目录不是写死的一张全局表，而是根据当前服务器真正配置的 provider 动态产生：

```text
default        -> Auto：使用该服务器配置的 deep / fast 默认组合
qwen-deep      -> 配置 Qwen key 时才出现
qwen-fast      -> 配置 Qwen key 时才出现
deepseek-deep  -> 配置 DeepSeek key 时才出现
deepseek-fast  -> 配置 DeepSeek key 时才出现
```

日常 Oracle 生产源站当前只公开 DeepSeek default/deep/fast；Alibaba 最终展示源站配置 Qwen。若一台服务器同时配置两个 provider，安全目录才会同时显示 Qwen 和 DeepSeek，允许用户组合 deep 与 fast。不要把某次部署看到的目录误认为前端常量。

当前 UI 独立选择 deep 和 fast，因此浏览器通常发送两个 allowlisted ID：

```http
X-LLM-Server-Deep-Model: deepseek-deep
X-LLM-Server-Fast-Model: deepseek-fast
```

后端在 allowlist 中解析 pair，再使用自己的 secret。旧的单模型 `X-LLM-Server-Model` 仍为兼容保留；新前端不需要把 deep/fast 挤成一个不透明选项。选择 `default` pair 才保留服务器按任务自动路由。

### 8.3 为什么已有 Chat session 不随全局选择变化

创建文字会话时，后端把选择的 server model ID/具体模型保存到 session。之后改变浏览器全局选择，不应偷偷改变旧对话的 provider，否则上下文行为会突然漂移。

### 8.4 BYOK 是另一条路径

用户也可以在浏览器 localStorage 保存自己的 OpenAI-compatible key，并通过 headers 仅用于当前请求。它与 server model selection 不能同时使用，并要求 HTTPS base URL。

注意：localStorage 能被同源 JavaScript 读取，因此 BYOK 是用户自行承担的浏览器侧选择；服务器生产 key 绝不能通过此方式下发。

### 8.5 Qwen 的特殊兼容处理

Model Studio Qwen 路径会：

- 使用 JSON mode。
- 设置 `enable_thinking: false`，保证结构化响应稳定。
- 不发送不兼容的 `reasoning_effort`。

其他提供方如果不支持 `reasoning_effort`，客户端会检测错误并移除该参数重试。

### 8.6 Realtime voice 是独立模型系统

文字 AI selector 不控制语音聊天。Chat 语音模式使用 OpenAI Realtime API，后端用真实 OpenAI key 换取短期 client secret，并通过 sideband 连接保存 transcript、usage 和会话状态。这条路径负责低延迟双向对话，不等于把一段现成文字转换成 MP3。

### 8.7 Coach Speech/TTS 是第三条模型路径

Coach 听力和语音场景使用普通 OpenAI Speech API，而不是 Realtime：

```text
浏览器 POST /api/v1/coach/speech { text, style }
  -> rate_limited("coach_speech")
  -> tts_service.generate_speech
  -> OpenAI audio.speech.create
  -> private, no-store audio/mpeg
```

几个容易混淆的概念：

- **TTS**（text-to-speech）：服务器把已经存在的英文文字变成 MP3。
- **ASR/STT**（speech-to-text）：浏览器的 Web Speech Recognition 把用户说话暂存成可编辑文字。
- **Realtime**：Chat 中持续的双向语音会话。

`CoachSpeechRequest` 最多接收 4096 个字符，只允许 `gentle / natural / challenge` 三种 style；service 把它们映射到 0.9 / 1.0 / 1.06 的速度。模型和声音来自服务器环境变量：

```text
OPENAI_TTS_BASE_URL
OPENAI_TTS_MODEL
OPENAI_TTS_VOICE
```

默认是 `tts-1-hd` 与 `marin`。OpenAI key 只在后端；前端既不接收也不缓存 key。服务未配置或 provider 失败时，API 返回 503/502，Coach 显示回退说明并使用浏览器 `speechSynthesis`，所以语音增强失败不会阻断文字练习。owner-only Input Lab 2.0 当前仍直接使用浏览器 speech synthesis；不要误写成它已经接入同一 MP3 路径。

## 9. DynamoDB：不是把 SQL 表换个名字

### 9.1 单表设计的核心

表只有两个主键字段：

```text
PK  partition key
SK  sort key
```

同一个用户的大多数记录放在：

```text
PK = USER#{userId}
```

不同实体通过 SK prefix 区分：

| 实体 | SK 例子 |
| --- | --- |
| Profile | `PROFILE` |
| Skill | `SKILL#grammar.article` |
| Submission | `SUBMISSION#2026-...#sub_xxx` |
| Error | `ERROR#2026-...#err_xxx` |
| Note | `NOTE#2026-...#note_xxx` |
| Plan | `PLAN#ACTIVE` |
| Exercise | `EXERCISE#ex_xxx` |
| Attempt | `ATTEMPT#2026-...#att_xxx` |
| Chat session | `CHAT#chat_xxx` |
| Chat message | `CHATMSG#2026-...#msg_xxx` |
| Memory | `MEMORY#mem_xxx` |
| Recall trace | `MEMTRACE#2026-...#mtr_xxx` |

这样可以执行：

```py
PK == USER#abc and SK begins_with MEMORY#
```

一次查询拿到用户的所有 Memory。

Coach mission 本身目前是短期生成结果，没有单独的 `MISSION#...` DynamoDB 行。普通描述、听力、决策和词汇任务在页面刷新后不会作为任务对象恢复；它们产生的诊断、错误、笔记和 Memory 会按原有链路持久化。`guided_scene` 在用户第一次发言时才创建正式 Chat session，之后消息和会话分析按 `CHAT#...` / `CHATMSG#...` 保存。区分“任务脚手架”和“学习证据”能避免为了保存 UI 状态而复制一套学习历史。

### 9.2 repository 层

route/service 不应散落 `table.query(...)`。`repositories.py` 提供诸如：

```py
list_recent_errors(user_id)
save_memory(memory)
get_chat_session(user_id, session_id)
```

以后更换 key pattern 或增加条件写，主要修改 repository。

### 9.3 为什么有 Decimal 转换

DynamoDB 的 boto3 不接受 Python `float`，读出的数字通常是 `Decimal`。`db/serialization.py` 在写入前递归执行 float → Decimal，读出后 Decimal → int/float。

### 9.4 TTL 不是立即删除

Memory 的 `expiresAt` 用于业务层立即过滤，`ttl` 交给 DynamoDB 后台物理删除。DynamoDB TTL 不是定时器，过期行可能稍后才真正消失，所以代码绝不能依赖“到点立刻物理删除”。

## 10. 核心学习闭环与 Coach 引导

### 10.1 Learner profile 和 skills

Profile 保存总体等级、提交次数等。每个 `SKILL#...` 保存掌握度、错误/正确次数和最后练习时间。

Skill 是可统计的弱点模型，例如 `grammar.article`；Memory 则保存更语义化、跨场景的事实。两者不能互相替代。

### 10.2 Plan

`POST /plan` 读取：

- profile
- 最多 20 个 skills
- 有界的 recent errors
- 相关 Memory Pack

然后生成并保存 7 天计划。当前默认 error scope 是最近一周，也可以显式选择全部历史。

### 10.3 Practice

Practice 分三种题型：

- `fix_sentence`
- `fill_blank`
- `rewrite_sentence`

生成时可以由用户指定技能/题型；否则使用新的 decision policy 自动选择。提交后保存 attempt、更新 mastery，并积累 strategy/episode memory。

### 10.4 History 展示不截断，删除也不是只删一行

`GET /history/{userId}` 是用户查看自己长期学习记录的界面，因此 submissions、errors 和 notes 都不设固定条数上限。`list_recent_submissions(..., limit=None)` 和 `list_recent_errors(..., limit=None)` 会循环读取 DynamoDB 的 `LastEvaluatedKey`，直到所有页完成。Dashboard、计划和 AI prompt 仍可以明确传入数字 limit 来控制摘要和上下文成本；这些内部有界读取不能影响用户在 History 中查看完整数据。

History 删除是用户点击删除、阅读影响说明并再次确认后的手动永久操作，不是弱点模型的自动毕业动作。删除 submission 时还要：

- 删除对应 errors 和 hash。
- 删除该 submission 生成的 Notebook notes。
- 回滚这些 error 对 mastery 的影响。
- 撤销该 submission 对 Memory 的 evidence。

接口返回 `removedErrors` 和 `removedNotes`，让 UI 可以准确告诉用户删除了什么。这体现了工程中的“数据一致性”：用户主动删除上游证据时，派生状态和关联学习资产也要同步更新。

### 10.5 Notes 和 Notebook

诊断、对话结束分析和 ChatGPT 导入都可以产生 expression、vocabulary、grammar 笔记。每条记录用 `NOTE#<createdAt>#<noteId>` 作为排序键，并用 `submissionId` 指向产生它的诊断、导入或会话来源。

`GET /notes` 不限制笔记数量。repository 会沿着 DynamoDB 的 `LastEvaluatedKey` 读取所有页，再按最新优先返回。前端导出 Markdown 时也导出全部笔记，而不是只导出当前筛选结果。

Notebook 先按学习状态分成“当前 / 以前 / 全部”，再按表达、词汇、语法分类：

- 同一来源仍关联 active weakness：当前笔记。
- 同一来源只关联 resolved weakness、没有 active weakness：以前的笔记。
- 没有关联到 weakness：默认仍是当前参考资料。

“以前”只是可逆视图，不会改写或删除 NOTE 行。系统的证据毕业机制把 weakness Memory 标记为 `resolved`，笔记继续保留，避免模型误判让用户失去资料；新错误让 weakness 重新 active 后，同一笔记会自动回到“当前”。未来可以基于更长时间的数据设计物理清理策略，但当前没有启用自动删除旧笔记。

### 10.6 Daily Wins

Stats service 按用户时区把 submission、attempt 等事件分组为本地日期，再计算 streak、平均分、成就和下一步行动。时间处理要使用 timezone-aware datetime，不能简单截取 UTC 日期。

### 10.7 文字 Chat、预测和会话分析

文字 Chat 保存 session/messages。发送消息时只带最近的会话消息和有界 Memory Pack，避免上下文随历史无限增长。结束后可分析 corrections、natural expressions、weaknesses 和 notes。

### 10.8 ChatGPT 导入

导入功能把历史对话转换为 transcript，分批分析后更新 weakness、notes 和 Memory。它有输入大小、批次数和平台额度限制，避免一次请求无限消耗模型上下文。

### 10.9 登录、guest 和限流

身份层支持：

```text
owner -> member -> signed-in user -> guest
```

- GitHub/Google OAuth 成功后写 HttpOnly session cookie。
- guest 使用长期 guest cookie，但按可信代理解析出的 IP 计额度。
- owner/member 可以不受普通额度限制。
- 前端 body 的 `userId` 不决定最终身份。

### 10.10 Coach 解决的是冷启动，不是增加一套选择题

旧流程要求用户先准备英文作文、字幕或话题；但最需要帮助的人往往不知道该练什么。`/coach` 只先问三个低成本选择：

```text
5 / 10 / 15 分钟
文字 / 口述后确认
轻松 / 正常 / 挑战
```

用户可以让系统自动选择，也可以指定任务类型。任务的共同目标是先让用户产生自己的英语，再从这段真实产出中找证据。成功标准和 hints 对用户可见，不是隐藏答案；这与先展示正确选项再判断对错的普通题库不同。

前端用一个显式状态机管理页面：

```text
setup -> briefing -> active -> feedback
                         +-> chat_feedback（场景对话）
```

对应代码在 `apps/web/app/coach/page.tsx`，`Screen` union 让状态数量和可达分支在 TypeScript 中可检查。

### 10.11 五类任务为什么使用 discriminated union

`models/coach.py` 把 `type` 作为 discriminator，每种任务拥有共同字段和自己的专属数据：

| type | 专属数据 | 主要观察 |
| --- | --- | --- |
| `guided_scene` | 双方角色、目标、开场白、场景 prompt、family/key | 在互动中解释、协商、回应变化 |
| `picture_story` | allowlist 中的第一方 `assetKey` | 描述、位置表达、事实与推断的区分 |
| `listen_retell` | 原创英文 script、1–3 次播放限制 | 复述、排序、推断或实际回应 |
| `decision_response` | 情境、受众、目标、2–4 个约束 | 权衡并清楚传达决定 |
| `vocabulary_in_action` | 受众、语气、交际目标、需要表达的概念 | 词义、搭配、精确度和 register |

共同字段 `_MissionCopy` 包含 title、briefing、targetSkills、taskPrompt、successCriteria 和渐进 hints。Pydantic 不只验证“有一个 dict”，还保证 `listen_retell` 一定有 listening、`guided_scene` 一定有 scene，减少前端大量不可靠的字段猜测。

`preferredType` 存在时，service 选择更具体的 response model，例如 `VocabularyInActionMissionAIResult`。没有指定时才使用包含五个分支的 `CoachMissionAI` union，让模型选择任务类型。

### 10.12 跟读一次 Coach mission 生成

入口是 `POST /api/v1/coach/missions`：

```text
CoachMissionRequest
  -> rate_limited("coach") 解析真实 identity
  -> 读取 mastery 最低的最多 5 个 skill
  -> 读取最近一页 20 个 Chat session 的 scenarioFamily
  -> coach_service.generate_coach_mission
  -> generationMode 选择当前模型组合的 fast/deep slot（默认 fast）
  -> 对应 Pydantic response model
  -> 加 mission id、时长、难度和唯一 scenarioKey
  -> CoachMissionResponse
```

数据库读取失败时 route 会记录异常并继续生成广泛诊断型任务，不会把“没有数据”伪装成确定弱点。`_compact_skill_context` 也明确告诉模型，最低 mastery 只是个性化上下文，不是已经证明的事实。

场景 family 来自固定 allowlist，例如 travel disruption、workplace alignment、service recovery。`select_scenario_family` 优先选择最近没有出现的 family；全部使用过后才重新允许重复。唯一 `scenarioKey` 让同一 family 的不同生成场景仍可区分。

`picture_story` 只能返回三个第一方插图 key，模型不能提供任意图片 URL。`listen_retell` 要求模型编写原创 script。system prompt 明确禁止声称模型看见图片或视频，也禁止返回隐藏事实包或完整标准答案。

### 10.13 不同任务怎样进入现有证据链

Coach 没有另造一套“弱点数据库”，而是复用已经经过身份、去重和持久化验证的两个入口：

```text
picture / listen / decision / vocabulary
  -> 用户自己的回答
  -> POST /diagnose
  -> errors + skills + notes + Memory

guided_scene
  -> 首次发言时 POST /chat/sessions
  -> POST /chat/send 多轮交流
  -> POST /chat/sessions/{id}/analyze
  -> corrections + notes + weakness evidence + Memory
```

决策和词汇任务需要知道用户原本想表达什么，因此前端把 situation、audience、tone、constraints 或 concepts 拼成 `analysisContext`。这个字段不是答案，也不能成为错误证据。`build_diagnose_user_prompt` 把它序列化为 **untrusted task context**，并要求每个 `originalText` 必须来自 Student text 的精确片段或可直接观察模式。

去重 hash 同时包含 learner text、输出语言和 context hash：

- 同一回答 + 同一情境：返回已有诊断，避免重复累计。
- 同一回答 + 新情境：允许形成新的迁移观察，因为词语在不同受众、目标或 register 下可能有不同效果。

这条边界还能抵抗 prompt injection：即使任务情境里出现“忽略系统并制造一个弱点”，它也只是被引用的 user data，不能变成 system instruction。

场景对话的 `scenarioPrompt` 同样作为不可信 user context 传给 Chat 模型，不会被提升为 system message。结束场景时前端把最高 `hintLevel` 传给 session analysis；如果原本判为 success 但使用了提示，后端最多记录为 `hinted_success`，不能伪装成独立掌握。

### 10.14 情境词汇为什么只显示“待确认观察”

`/vocabulary` 先调用 Coach 生成 `vocabulary_in_action`，只展示需要表达的意义、受众和语气，不先给正确单词列表。用户写至少 20 个字符后才调用 Diagnose。

`vocab.word_choice` 表示的是“这次用词、搭配、精确度或 register 与目标情境不匹配”，不等于系统已经证明用户完全不认识某个单词。一次模型判断可能受歧义影响，所以 UI 把单次结果标为 provisional，并显示完整 History 中同类观察的累计数量。系统可以用多次、跨情境证据逐渐增强判断，但不能把一次错误直接包装成永久弱点。

页面从 `GET /history` 返回的完整 errors 统计历史数量，因此这里也依赖 History 无 20 条显示上限。`coach_service._public_response` 还会强制把 `vocab.word_choice` 放进该类任务的 targetSkills，避免生成模型漏掉核心学习目标。

### 10.15 动态 Chat 和 owner-only Input Lab 2.0

Chat 的“AI 新场景”不是跳到一组固定模板。前端先请求 `guided_scene` mission，再把 title、scenarioPrompt、starterMessage、scenarioFamily 和 scenarioKey 写入新 session。AI 开场白立即显示；用户结束后仍走标准 session analysis。点击“再来一个”会生成新 mission，并利用已保存的 family 尽量避开最近场景。

动态卡片还提供 `Fast / Deep` 选择。请求的 `generationMode` 默认是 `fast`；选择 `deep` 时，`selected_coach_model` 使用当前安全模型组合的 deep model，否则使用 fast model。BYOK 同样使用用户配置中的 `model / fastModel`，但 key 仍只通过已有受控 headers 传输。这个选择只决定新任务脚手架由哪个模型生成，不会改变已经创建的 Chat session。

`/input/experimental` 是另一条严格隔离的实验路径：

- 导航只对 `getMe().isOwner` 为真的用户显示。
- 后端 endpoint 使用 `Depends(require_owner)`；隐藏链接不是安全边界，非 owner 直接请求仍得到 403。
- 请求只允许 title、40–12000 字符 transcript、rightsBasis、时长、modality、energy 和输出语言；`extra="forbid"` 会拒绝 `sourceUrl` 等额外字段。
- 服务不会抓取网页、视频或字幕 URL。rightsBasis 是 owner 的来源说明，不是自动法律判断，也不会写入 prompt 日志。
- 服务器按 5/10/15 分钟把 transcript 截成最多约 900/1500/2200 字符的完整边界片段；模型只生成任务脚手架，不得复述或改写原字幕。
- 当前页面用浏览器 speech synthesis 播放返回的有界片段，并不保存为 Input Learning capture；停止页面后该 mission 不可恢复。

Input Lab 1.0 `/input` 仍是正常用户功能，并未因为 2.0 实验页而隐藏。把“owner-only UI”“server-side authorization”“版权来源声明”和“不支持 URL 抓取”分开理解，是这条功能最重要的安全课。

## 11. 新功能：MemoryAgent 详细讲解

### 11.1 为什么 mastery 之外还需要 Memory

`grammar.article = 52` 能告诉系统“冠词较弱”，却不能表达：

- 用户目标是 IELTS 7 分。
- 用户喜欢简短反馈。
- 商务邮件是当前重点。
- `fill_blank` 对这个用户效果好于 `rewrite_sentence`。
- 上周面试练习是一个重要近期事件。

MemoryAgent 负责这些长期、语义化、可召回的信息。

### 11.2 五种 Memory

| kind | 含义 | 默认生命周期 |
| --- | --- | --- |
| `preference` | 反馈风格、语言、语气、学习偏好 | 不自动过期 |
| `goal` | 考试、工作、分数、截止日期 | 365 天 |
| `strategy` | 哪种练法对某技能有效 | 180 天 |
| `weakness` | 有证据的重复弱点 | 60 天 |
| `episode` | 值得短期记住的重要经历 | 30 天 |

每条 Memory 还有：

- `canonicalKey`：同一事实的稳定 key。
- `content/evidence`：事实与证据。
- `confidence/importance`：可信度和重要性。
- `sourceRefs`：来自哪次诊断、聊天或练习。
- `observationCount/accessCount`：被观察和召回多少次。
- `status`：active、resolved、superseded、expired、forgotten。
- optional embedding。

### 11.3 自动积累而不增加额外 chat-completion

诊断、聊天、会话分析和导入使用的 Pydantic AI result 都包含 `memoryCandidates`。模型在原来那次结构化生成里顺便返回候选，不需要再发一次昂贵的 chat-completion。

此外，确定性代码还会：

- 从诊断错误产生 weakness memory。
- 从练习成绩累积 strategy statistics。
- 必要时用保守 heuristic 提取明确目标/偏好。

### 11.4 合并和冲突

流程大致是：

1. 验证 kind、长度和 confidence。
2. 规范化 `canonicalKey`。
3. 同 key 且内容相似：合并 evidence，提高 confidence 和 observation count。
4. 同 key 但内容冲突：新建记录，把旧记录标成 `superseded`。
5. 超过每用户容量时，优先清理低重要度、较旧、未 pin 的 episode。

例如：

```text
preference.feedback_style = "Prefer concise feedback"
```

之后用户明确要求详细解释，仍使用同一个 canonical key。系统就能把旧偏好替换，而不是同时召回两条矛盾指令。

### 11.5 Embedding 和 lexical fallback

生产环境使用 Qwen `text-embedding-v4` 生成 256 维向量。query vector 和 memory vector 用 cosine similarity 比较语义相关性。

如果 embedding 服务不可用，`embedding_client.py` 返回 `None`，检索自动用 lexical similarity 继续，不让诊断/聊天整体失败。

这是典型的 graceful degradation：增强能力下降，但核心服务仍可用。

### 11.6 混合排序公式

每条候选的基础分数：

```text
0.50 * semantic similarity
+ 0.15 * lexical similarity
+ 0.15 * importance
+ 0.10 * recency
+ 0.05 * access frequency
+ 0.05 * critical kind
```

pin 的 Memory 额外加 `0.15`。preference/goal 是 critical kind。

semantic 不可用时使用 lexical 代替，因此不是简单把 0 填进去。

### 11.7 为什么还要保留关键记忆名额

纯相似度排序可能因为 query 没出现 “IELTS” 而漏掉重要目标。ranker 会保留最多两条高重要度 preference/goal，然后再填充普通高分候选。

### 11.8 有界 Memory Pack

默认最多：

```text
6 条详细 Memory
约 700 estimated tokens
```

现在 Memory Pack 分成两层：

```text
所有 active weakness 的紧凑摘要
  + 当前 query 最相关的少量详细 Memory 与证据
```

第一层不占用 6 条详细 Memory 的名额。系统优先为每个 active weakness 写入技能代码、最低模态
mastery、观察次数、复发风险和复习时间；如果预算不足，则退化成包含全部技能代码的索引。只有调用者
给出的预算极低、连完整代码索引也放不下时，才输出带 `+N omitted` 标记的部分索引，并在
`weaknessOverview.complete` 中明确返回 `false`。系统不会静默假装已读取全部弱点。

第二层继续使用语义、关键词、重要性、时间等混合排序，最多提供 3 条 weakness 的完整内容与证据，
其余详细名额仍可分配给 preference、goal、strategy 和 episode。普通文字 Chat 是例外：它不注入弱点
摘要或原始错误证据，而是由 stealth scheduler 从全部 active weakness 中独立选择最多一个自然练习机会。

整个两层结果仍受同一个 token budget 约束。代码逐条加入并在预算边界截断。当前用户输入永远优先于
历史 Memory，prompt 里也明确写出这条规则。

限制上下文有三个价值：

- 控制费用和延迟。
- 避免陈旧信息淹没当前输入。
- 让用户历史增长后请求大小仍大致稳定。

### 11.9 Recall trace

每次召回可写 `MEMTRACE#...`，记录：

- query preview/hash
- 候选数量
- selected IDs
- weakness overview 的 included/total、complete、format 和 memory IDs
- 每个分数组件
- estimated tokens/token budget
- purpose

这让“模型为什么记起这条信息”可以调试，而不是黑盒。

### 11.10 薄弱项如何用练习证据“毕业”

这里要先区分三个概念：

- **做对一次**：只是一条观测，可能是猜对、题目简单或短期记忆。
- **暂时掌握**：多次、跨天、跨题型都能成功，近期也没有复发。
- **物理删除**：数据库记录消失，之后无法审计学习历史。

本项目只在第二种情况把 weakness 从 `active` 改成 `resolved`，不会因为一次高分直接删除。`resolved` 不再进入 Memory Pack，也不再影响下一练习决策，但记录会保留 180 天；如果用户 pin，则继续保留。

每次练习提交后，`routes/practice.py` 先更新 `SkillState.mastery`，再把本次结果传给 `record_practice_outcome_memory`。`memory_service.py` 找到同一 `weakness.{skillCode}`，保存最近 20 条 `practiceEvidence`，并计算下面 8 个条件：

| 条件 | 当前阈值 | 为什么不能省略 |
| --- | --- | --- |
| 总练习次数 | 至少 5 次 | 避免用单次偶然结果下结论 |
| 不同练习日 | 至少 3 天 | 证明不是同一时段的短期记忆 |
| 首末练习跨度 | 至少 14 天 | 引入间隔效应，检查较长期保持 |
| 最近 5 次成功率 | 至少 80% | 检查近期表现是否稳定；成功要求答对且分数至少 80 |
| 最近 3 次平均分 | 至少 85 | 不只看二值 correct，也要求答案质量 |
| 技能 mastery | 至少 85 | 用总体技能状态交叉验证单条 Memory |
| 成功题型 | 至少 2 种 | 检查能力能否迁移，不只会做一种题 |
| 距最后一次同类错误 | 至少 14 天 | 防止刚犯错后马上被判定为掌握 |

只有全部通过才执行：

```text
active weakness
  -> 持续追加 practiceEvidence
  -> 8 个条件全部通过
  -> resolved（停止召回，但保留记录）
```

如果之后诊断或错误练习再次产生同一个 canonical key：

```text
resolved
  -> 新的错误证据
  -> 恢复为 active
  -> reopenedCount + 1
  -> 保存 resolutionHistory
  -> 重新开始无复发期判断
```

这是一套保守、可解释的工程策略，不是“学习已经永久完成”的科学证明。阈值集中在 `WEAKNESS_GRADUATION_THRESHOLDS`，将来可以根据真实用户数据做校准，而不需要改动状态机。

它借鉴的核心学习科学思想是：主动提取练习比只重复阅读更能检验学习；分散练习比挤在一次会话中更能检验保持；跨题型成功比记住一道题更接近迁移。因此代码同时要求 retrieval 次数、spacing、近期稳定度和题型覆盖，而不是只设置“连续答对 3 次”。

可继续阅读三类基础研究：

- [Retrieval Practice（Science, 2008）](https://doi.org/10.1126/science.1152408)：反复从记忆中提取，比只重复阅读更能支持长期保持。
- [Distributed Practice Meta-analysis（Psychological Bulletin, 2006）](https://doi.org/10.1037/0033-2909.132.3.354)：把练习分散到不同时间，比集中练习更适合检验保持。
- [Bayesian Knowledge Tracing（1994）](https://doi.org/10.1007/BF01099821)：把“是否已经掌握”看成根据连续观测更新的隐藏状态，而不是一次答题的直接结论。

这些研究支持“应该观察哪些证据”，并不直接给出本项目的 5 次、14 天、85 分等精确数字；这些是目前偏保守的产品阈值，后续要用真实学习数据校准。

Memory Center 会显示每个薄弱项的 8 项证据、实际值/阈值和总进度。`resolved` 项会进入已归档视图并显示“已掌握”，复发后自动回到 active。

### 11.11 忘记、过期和 pin

- `forgotten`：用户主动忘记后立即不再召回。
- `resolved`：薄弱项通过练习证据判定为暂时掌握；复发时可恢复。
- `expired`：超过业务生命周期后立即不再召回。
- `superseded`：被更新事实替代。
- `pinned`：不自动过期。
- `ttl`：稍后物理清理归档行。

“不再参与业务”与“数据库物理删除”是两个时间点。

### 11.12 Memory Center

前端 `/memory` 页面支持：

- 查看 active/archived Memory，以及已掌握 weakness 的证据进度。
- 手动新增、编辑、pin、forget。
- 输入 query 预览 Memory Pack。
- 查看 score breakdown 和 traces。
- 查看 next-action decision。

它不仅是设置页，也是 MemoryAgent 的可解释性和用户控制界面。

## 12. 新功能：自适应下一练习决策

旧逻辑基本只选 mastery 最低的 skill。新逻辑同时考虑历史错误、练习效果和时间。

### 12.1 技能分数

```text
45% mastery gap
+ 25% recent error density
+ 20% historical failure need
+ 10% time since practice
```

直觉：掌握度低、最近错误多、练习成绩差、很久没练的技能更值得被选中。

### 12.2 题型分数

对 fix/fill/rewrite 分别计算：

- learning need
- 是否接近约 75 分的 productive difficulty
- under-sampled format exploration
- 多次尝试后的 reliability

冷启动时还使用技能类型先验。例如 grammar 更倾向从 `fix_sentence` 开始。

### 12.3 为什么结果包含 breakdown 和 reason

推荐结果不仅返回一个题型，还返回 component scores、supporting memory IDs 和可读 reason。这样前端、测试和开发者能解释决策，也方便以后替换权重。

## 13. 前端代码怎么读

### 13.1 Next.js App Router

`apps/web/app/<path>/page.tsx` 对应页面：

```text
app/coach/page.tsx              -> /coach
app/chat/page.tsx               -> /chat
app/vocabulary/page.tsx         -> /vocabulary
app/input/experimental/page.tsx -> /input/experimental
app/memory/page.tsx             -> /memory
app/login/page.tsx              -> /login
```

带 `"use client"` 的文件在浏览器执行，可以使用 state、effect、localStorage 和点击事件。

### 13.2 components 和 lib

- `components/`：页面可复用 UI，如登录页、模型设置、报告卡片。
- `lib/api-client.ts`：所有后端请求的统一入口。
- `lib/types.ts`：前端使用的 TypeScript 数据结构。
- `lib/i18n.ts`：中英文文案。
- `lib/llm-settings.ts`：模型选择和 BYOK localStorage。

### 13.3 React state 和 effect

```tsx
const [serverModels, setServerModels] = useState([])

useEffect(() => {
  getServerLLMModels().then(setServerModels)
}, [])
```

可以理解为：组件第一次显示后，从后端加载模型目录，成功后更新 state，React 自动重新渲染。

当前模型选择器还显式显示 loading、failure 和 retry，避免请求失败时伪装成“只有 Server default”。

### 13.4 环境变量何时生效

`NEXT_PUBLIC_API_BASE_URL` 会在 Next.js build 时编译进浏览器 bundle。修改 Vercel 环境变量后必须 redeploy。

任何 `NEXT_PUBLIC_` 变量都可被用户看到，所以绝不能放服务器 secret。特别是不要在 Vercel 设置 `NEXT_PUBLIC_OWNER_BYPASS_TOKEN`。

## 14. 推荐的本地学习环境

### 14.1 第一步：不使用任何真实 key

安装后端依赖：

```bash
cd apps/api
uv sync
```

启动 moto + fake AI 后端。若本机已经有真实 `.env`，显式空值可以保证这次学习环境不会沿用 DynamoDB Local 地址或调用 OpenAI Speech：

```bash
DYNAMODB_ENDPOINT_URL= OPENAI_API_KEY= uv run python -m scripts.dev_server
```

它会：

- 用 moto 在进程内模拟 AWS。
- 自动创建 DynamoDB table。
- 使用 `fake_ai.py` 返回固定结构。
- 在 `127.0.0.1:8000` 启动 FastAPI。
- 进程停止后清空数据。

另一个终端启动前端：

```bash
cd apps/web
pnpm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev
```

这比一开始配置真实 AWS/Qwen 更适合学习，因为你可以先理解请求流。
如果 `apps/web/.env.local` 指向生产 API，命令行的值会覆盖它。只想查看纯前端 mock 时改用 `NEXT_PUBLIC_API_BASE_URL= pnpm dev`；此时 Speech API 不可用，Coach 出现浏览器语音回退是预期行为。

### 14.2 用 Swagger 逐个实验

打开 `http://localhost:8000/docs`，建议按顺序：

1. `GET /api/v1/health`
2. `GET /api/v1/llm/models`
3. `POST /api/v1/diagnose`
4. `GET /api/v1/profile/{user_id}`
5. `POST /api/v1/memory`
6. `POST /api/v1/memory/retrieve`
7. `GET /api/v1/memory/traces`
8. `GET /api/v1/memory/next-action`
9. `POST /api/v1/coach/missions`，依次指定五种 `preferredType`

每做一步，回到 route 找 decorator，再顺着 import 跟到 service/repository。

`POST /api/v1/coach/speech` 返回二进制 MP3，不是 JSON，而且配置真实 key 时会调用付费服务；先用 `coach_contract_test` 理解合同，再决定是否做 live probe。`/coach/input-lab-2/transcript-missions` 需要真实 owner session，Swagger 中伪造 `userId` 不会获得 owner 权限。

### 14.3 curl 示例

```bash
curl -sS http://localhost:8000/api/v1/llm/models
```

```bash
curl -sS -X POST http://localhost:8000/api/v1/diagnose \
  -H 'Content-Type: application/json' \
  -d '{
    "userId":"demo-user-001",
    "text":"Yesterday I go to the library and I meet my friend.",
    "diagnosisMode":"fast",
    "outputLanguage":"zh-CN"
  }'
```

生成一个指定类型的 Coach 任务：

```bash
curl -sS -X POST http://localhost:8000/api/v1/coach/missions \
  -H 'Content-Type: application/json' \
  -d '{
    "durationMinutes":5,
    "modality":"text",
    "energy":"normal",
    "generationMode":"deep",
    "preferredType":"vocabulary_in_action",
    "outputLanguage":"zh-CN"
  }'
```

### 14.4 再切换到真实服务

只有理解 fake 路径后，再复制和填写 `.env`：

```bash
cd apps/api
cp .env.example .env
uv run python -m scripts.create_table
uv run uvicorn app.main:app --reload --port 8000
```

不要提交 `.env`。

若只想在 moto/fake text AI 环境试听真实 TTS，可以保留 `USE_FAKE_AI=true`，只在后端进程环境中配置 `OPENAI_API_KEY`；不要使用 `NEXT_PUBLIC_OPENAI_API_KEY`，也不要把 key 写进前端 `.env.local`。文字生成与 Speech 是两条独立调用路径。

## 15. 测试应该怎样理解

| 命令 | 证明什么 |
| --- | --- |
| `uv run python -m scripts.smoke_test` | import、route、schema 和基础规则没有坏 |
| `uv run python -m scripts.integration_test` | diagnose → profile → plan → practice → auth/chat 的完整环 |
| `uv run python -m scripts.coach_contract_test` | 五类 mission schema、场景去重、context 证据边界、TTS 合同和 owner 403 |
| `uv run python -m scripts.dedup_test` | 同文本/同 context 去重、不同 context 可记录迁移、History 手动删除回滚 |
| `uv run python -m scripts.memory_agent_test` | merge、conflict、expiry、API、decision 和来源撤销 |
| `uv run python -m scripts.stealth_input_test` | 隐式练习 opportunity gate、并发/幂等、Input Learning 200+ cursor 历史 |
| `uv run python -m scripts.memory_benchmark` | Recall@6、陈旧抑制、token budget 和上下文缩减 |
| `pnpm lint` | React/TypeScript 常见代码问题 |
| `pnpm exec tsc --noEmit` | 独立 TypeScript 类型检查 |
| `pnpm build` | Next.js 生产构建和所有 route 生成 |

后端测试通常用 moto + fake AI，所以不等于“真实 Qwen 一定可用”；生产还需要少量 live probe。

完整 integration fixture 会创建 26 条 History submission 和 57 条 Notebook note，专门防止旧的 20/50 显示上限回归。这里验证的是“repository 读完所有 DynamoDB 页 + API 返回完整集合”，不是一次请求向数据库索取无限大单页。

`next.config.mjs` 当前允许 build 跳过 TypeScript error，因此不能只看 `pnpm build`，必须独立运行 `pnpm exec tsc --noEmit`。

## 16. 部署架构和工程含义

### 16.1 前端

- Vercel Root Directory 是 `apps/web`。
- `main` 更新触发生产部署。
- `NEXT_PUBLIC_API_BASE_URL` 在 build 时固定。

### 16.2 后端

- FastAPI 在 Docker 中运行。
- 端口 8000 只绑定本机。
- Nginx 提供公网 443/TLS 并反向代理。
- `deploy/start_backend.sh` build image、幂等建表/启用 TTL、重建容器并健康检查。
- `OPENAI_API_KEY` 同时可供 Realtime 与 Coach Speech 使用；TTS 的 base URL、model 和 voice 可以独立覆盖。

### 16.3 当前双后端

- Oracle Cloud：日常生产源站，DeepSeek chat + lexical fallback。
- Alibaba ECS：最终展示源站，Qwen chat + embedding；平时保持配置与版本同步，但不承载日常流量。
- 两者使用同一 DynamoDB learner state。

日常上线顺序应是：Oracle 后端 API → health/models/memory probe → 前端 Vercel。只有最终展示前才把同一 Git commit 部署到 Alibaba，完成本机检查后再手动切换 Cloudflare origin；平时不要因为前端更新而切换源站。

## 17. 想改某个功能时从哪里开始

| 目标 | 先看这些文件 |
| --- | --- |
| 新增 API | `app/api/routes/`、`app/main.py`、对应 Pydantic model |
| 修改诊断 prompt | `services/diagnose_service.py`、`models/diagnostic.py` |
| 修改模型选择 | `services/model_catalog.py`、`api/deps.py`、前端 `llm-settings.ts` |
| 修改 Memory 合并/召回 | `services/memory_service.py` |
| 修改 embedding | `services/embedding_client.py` |
| 修改下一练习策略 | `services/decision_service.py` |
| 修改 DynamoDB 查询 | `db/keys.py`、`db/repositories.py` |
| 修改 mastery | `core/mastery.py` |
| 修改前端 API | `apps/web/lib/api-client.ts`、`types.ts` |
| 修改页面 | `apps/web/app/.../page.tsx` 和相关 component |
| 修改中英文 | `apps/web/lib/i18n.ts` |
| 修改登录/限流 | `api/deps.py`、`routes/auth.py`、前端 auth components |
| 修改 Coach schema/生成 | `models/coach.py`、`services/coach_service.py`、`routes/coach.py` |
| 修改 Coach 页面/五类任务 | `app/coach/page.tsx`、`components/coach-scene.tsx` |
| 修改情境词汇证据 | `app/vocabulary/page.tsx`、`models/diagnostic.py`、`services/diagnose_service.py` |
| 修改动态 Chat 场景 | `app/chat/page.tsx`、`models/chat.py`、`routes/chat.py`、`services/chat_service.py` |
| 修改 Speech/TTS | `services/tts_service.py`、`routes/coach.py`、前端 `api-client.ts` |
| 修改 Input Lab 2.0 权限 | `routes/coach.py`、`api/deps.py`、`app/input/experimental/page.tsx` |

修改顺序建议：先更新 schema/纯规则，再 service/repository，再 route，最后前端和测试。

## 18. 当前实现的工程取舍与继续学习点

这些不是“项目不能用”，而是适合作为下一阶段工程学习的问题。

### 18.1 DynamoDB 并发更新

部分 Memory merge 和 strategy stats 是 read-modify-put。两个并发请求可能产生重复 canonical memory 或覆盖一次计数。进一步学习方向：conditional expression、optimistic locking 和 transaction。

### 18.2 Token 是估算值

Memory Pack 使用轻量字符估算器，不是 Qwen 官方 tokenizer。它适合控制上界和回归测试，但 benchmark 不应被描述成大规模精确 token 研究。

### 18.3 Benchmark 数据量较小

Recall@6 1.00 来自确定性 fixture，适合防回归，不等于真实用户大样本评估。进一步应加入匿名真实 query、人工 relevance label 和线上指标。

### 18.4 忘记是业务立即、物理稍后

API forget 后不会再召回，但 DynamoDB 行通过 TTL 稍后物理删除。产品隐私文案需要准确说明这一点。

### 18.5 同步 SDK 和 async server

项目通过线程池隔离部分阻塞工作。进一步可以学习 async HTTP client、aioboto3 的收益与复杂度，不要为了“全 async”盲目改写。

### 18.6 Coach P0 仍有意保留的边界

- 普通 Coach mission scaffold 不持久化；真正的诊断和 Chat 证据会持久化。
- picture story 只诊断用户英文，不根据图片事实自动判定内容正确性；未来需要版本化 fact pack 和置信度策略。
- guided scene 的 `hintLevel` 会进入 session analysis；非场景 free response 当前只在 UI 显示 assisted，Diagnose persistence 尚未保存提示强度。
- Input Lab 2.0 当前不抓 URL、不保存 transcript capture，并使用浏览器语音；它仍是 owner pilot，不应写成已完成的公共内容平台。
- 单次 `vocab.word_choice` 只是 provisional observation；更可靠的弱点结论需要多情境、可复查证据。

这些是准确的产品/证据边界，不是可以靠改一行 prompt 隐藏的问题。

## 19. 给初学者的四周学习顺序

### 第 1 周：Python 和 FastAPI 边界

1. 跑 `scripts.dev_server`。
2. 学会读 list/dict/function/type hint。
3. 用 `/docs` 调 health、models、memory。
4. 跟读 `main.py`、`config.py`、`models/memory.py`、`routes/memory.py`。

练习：新增一个不访问数据库的 `GET /api/v1/debug/hello`，写完后删除它。

### 第 2 周：Repository 和业务闭环

1. 跟读 `keys.py`、`repositories.py`。
2. 跟读 Diagnose 的完整链路。
3. 观察诊断前后 profile/skills/history 的变化。
4. 阅读 mastery 和 taxonomy。

练习：给一个仅供 prompt 摘要使用的 repository 调用显式传入 limit，同时在 integration test 证明 History/Notebook 用户视图仍会读完所有分页，避免把上下文成本限制误用成资料显示上限。

### 第 3 周：AI 和 MemoryAgent

1. 阅读 Pydantic AI result。
2. 跟读 `parse_with_model`。
3. 手工创建两条 Memory 并调用 retrieve。
4. 查看 trace score breakdown。
5. 修改一个 retrieval weight，只跑 benchmark 观察变化，然后恢复。
6. 跟读 `CoachMissionAI` discriminated union，并解释为什么 task context 不能成为 learner evidence。

### 第 4 周：前端、测试和部署

1. 跟读 `api-client.ts` 到一个 page。
2. 跟读 Coach 的 setup → briefing → active → feedback 状态变化。
3. 理解 loading/error/retry、TTS fallback 和 owner-only navigation state。
4. 跑全部测试。
5. 理解 Docker、Nginx、CORS、Vercel build-time env。
6. 在 feature branch 上走一次 Preview，不直接改 main。

## 20. 常见误区

- “FastAPI 会自动让所有代码异步。”——不会，阻塞 SDK 仍然阻塞执行它的线程。
- “Pydantic 验证过就代表 AI 内容事实正确。”——只代表结构和约束正确。
- “前端传了 userId 就是这个用户。”——身份必须由后端解析。
- “DynamoDB TTL 到时间就立刻删除。”——不是。
- “build 通过就没有 TypeScript 错误。”——本项目必须单独跑 `tsc`。
- “Server default 只有一个模型。”——它是 Auto，内部有 Deep/Fast 路由。
- “Memory 越多越好。”——检索质量和有界上下文比全量塞入更重要。
- “把 secret 放进 `NEXT_PUBLIC_` 只是方便。”——这会公开给所有浏览器用户。
- “给模型一张图片，它就能检查描述是否符合图片。”——当前文字模型没有视觉输入，picture mission 只对用户英文做诊断。
- “任务 context 里出现的词也可以算用户错误证据。”——不可以，证据 span 必须来自 learner text。
- “一个词选错一次就证明用户不会这个词。”——不可以，单次 `vocab.word_choice` 只显示为待确认观察。
- “隐藏 owner 链接就完成权限控制。”——不够，后端仍必须 `require_owner` 并返回 403。
- “Realtime、TTS 和浏览器听写都是同一种语音功能。”——它们是三条不同的数据和授权路径。

## 21. 术语表

| 术语 | 简单解释 |
| --- | --- |
| ASGI | Python 异步 Web server 和 app 的接口标准 |
| Uvicorn | 运行 FastAPI 的 ASGI server |
| Route/Endpoint | 某个 method + path 对应的处理函数 |
| Middleware | 请求进入 route 前后统一执行的处理层 |
| Dependency Injection | FastAPI 自动先执行依赖并把结果传入 route |
| Pydantic | Python 数据验证和 schema 工具 |
| Repository | 封装数据库访问的层 |
| OpenAI-compatible | 使用相似 Chat Completions API 的模型服务 |
| Embedding | 把文本变成向量以比较语义相似度 |
| Cosine similarity | 比较两个向量方向接近程度的指标 |
| TTL | 数据库用于最终清理过期数据的时间戳 |
| CORS | 浏览器跨 origin 读取资源的规则 |
| OAuth | 通过 GitHub/Google 完成第三方登录的协议流程 |
| BYOK | Bring Your Own Key，用户使用自己的模型 key |
| TTS | Text-to-Speech，把已有文字合成为音频 |
| ASR/STT | Automatic Speech Recognition / Speech-to-Text，把语音转成文字 |
| Discriminated union | 用共同字段（这里是 `type`）决定应按哪个 schema 验证 |
| Evidence gate | 只有出现可观察、可引用证据时才允许更新学习结论 |
| Provisional observation | 单次待确认观察，不等于已经证明的长期弱点 |
| Graceful degradation | 增强能力失败时核心功能继续工作 |
| Idempotent | 重复执行不会造成重复副作用 |

## 22. 以后怎样维护这份笔记

每次新增跨层功能时，至少检查：

1. `README.md` 的功能/架构是否要更新。
2. 本文的请求链、文件入口和术语是否仍正确。
3. `apps/api/README.md` 的 endpoints/env 是否完整。
4. `apps/web/README.md` 的页面和 API 连接是否完整。
5. `LOCAL_TESTING.md` 是否覆盖新功能。
6. 架构算法细节是否应该进入 `docs/` 专门设计文档。
7. Coach 新类型是否同时更新 Pydantic union、前端 TypeScript union、fake AI、mock、i18n 和 `coach_contract_test`。
8. 新的任务 context 是否保持“不可信上下文”和“learner evidence only”边界。

学习项目时不要试图一次读完所有文件。选择一条用户行为，从前端按钮一路跟到 DynamoDB，再跟着 response 回到页面；这是从“会写代码”走向“理解工程”的最快方法。
