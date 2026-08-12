# WeakSpot English Coach：从零读懂项目的学习指南

> 适合读者：真正从零开始的大一新生。你可以还没写过程序、没用过终端，也不知道 API、端口、数据库和部署是什么。
>
> 最后核对日期：2026-07-30。本文以真实代码为准，不再作为“让 AI 生成项目的规格”，而是作为读懂和重建项目的学习教程。
>
> English edition: [`development.en.md`](development.en.md). 两个版本使用相同的 0–24 章结构；代码、命令和文件路径保持一致，方便双语对照。

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
| GPT-5.6 Responses API 自适应任务 | 缺失 | 第 8.9 节 |
| DynamoDB Decimal/TTL/当前 key | 部分过时 | 第 9 章 |
| Chat、Import、Notes、Stats、OAuth | 缺失 | 第 10.1–10.9 节 |
| Coach 五类任务、动态场景、情境词汇、Input Lab 2.0、Speech | 缺失 | 第 8.8、10.10–10.15 节 |
| MemoryAgent | 完全缺失 | 第 11 章 |
| 自适应练习决策 | 仍写“只选最低 mastery” | 第 12 章 |
| 混合练习 sessionSlot 多样性 | 缺失 | 第 10.3、12.4 节 |
| Session Win / welcome-back | 缺失 | 第 10.6.1、13.7 节 |
| Coach 计时结束后的反馈冻结 | 缺失 | 第 10.10 节 |
| 随机场景两阶段请求与 500 调试 | 缺失 | 第 10.16 节 |
| 前端请求与环境变量 | 偏脚手架说明 | 第 13 章 |
| 无密钥本地学习、测试、部署 | 命令和依赖过时 | 第 14–16 章 |
| 工程取舍和后续学习路径 | 缺失 | 第 18–21 章 |
| 从空目录重建最小同类项目 | 缺失 | 第 23 章 |

当前文档的分工如下：

| 文档 | 用途 | 适合什么时候看 |
| --- | --- | --- |
| `README.md` | 产品、功能和技术栈总览 | 第一次认识项目 |
| `development.md` | 从 Python/FastAPI 基础到完整请求链路 | 系统学习代码 |
| `development.en.md` | 与本文对应的英文教程 | 用英文学习或核对术语 |
| `docs/PROJECT_CODE_WALKTHROUGH_ZH.md` | 当前自定义函数、路由、service 和前端组件索引 | 已懂概念后定位源码 |
| `apps/api/README.md` | 后端命令、接口和配置速查 | 实际启动或调试后端 |
| `apps/web/README.md` | 前端运行和后端连接方式 | 实际启动或修改前端 |
| `LOCAL_TESTING.md` | 分层测试与发布前检查 | 写完代码之后 |
| `docs/ARCHITECTURE.md` | 当前生产架构和数据流 | 已理解基本代码分层后 |
| `docs/MEMORY_AGENT_DESIGN.md` | MemoryAgent 算法设计 | 学习新功能时 |
| `docs/COACH_MODE_P0.md` | Coach、情境词汇、字幕实验的产品与安全边界 | 跟读引导式学习闭环前 |
| `docs/ALIBABA_QWEN_DEPLOYMENT.md` | Alibaba/Qwen 部署步骤 | 准备上线时 |

本文判断一个知识点“讲清楚了”，至少要同时回答四个问题：

1. **它是什么**：先用普通语言给出定义。
2. **为什么项目需要它**：指出它解决的真实故障、成本或安全问题。
3. **代码里在哪里**：给出当前文件、数据流或关键函数。
4. **怎样验证理解**：给出输入/输出、数值演算、失败反例或可以亲手运行的实验。

阅读代码示例时不要只复制。先遮住示例结果，自己预测 status code、返回值或状态变化，再运行验证。
如果预测错了，回到上面四个问题定位：是概念没理解、边界没看见，还是把部署配置误当成代码常量。

代码块使用同一套阅读规则：

- 标着“完整文件”“从某目录运行”或“可直接运行”的，是可以复制执行的内容。
- 标着“源码节选”或包含 `...` 的，是为了解释局部逻辑，省略了 imports、fixture 或周边实现，不能单独运行。
- 标着“概念片段”“伪代码”或“纸上数据”的，只表达设计/数据关系。
- 没有明确标成完整文件时，默认把它当作教学节选；第 14、23 章的实验会明确给出 cwd、完整命令和预期结果。

**真正零基础的第一次路线**：先读 0–3 章中的 2.4–2.7，接着直接完成 14.1–14.3 的工具检查和
无密钥首次运行。看到页面、Network 200 和后端日志后，再回到第 4 章按顺序学习 Python、FastAPI、
数据库和 React。不要先硬读两千多行高级算法才运行项目。

### 0.1 学完以后，怎样才算“真的会了”

“读完”不是目标。完成本文后，你应该能够独立做出这些可观察的事情：

1. 在自己的电脑上安装并检查 Git、Node.js、pnpm 和 uv。
2. 说清楚浏览器、Next.js、FastAPI、模型服务和 DynamoDB 各自做什么。
3. 用两个终端启动无密钥本地环境，并知道怎样安全停止进程。
4. 从一个页面按钮跟到 HTTP request、route、service、repository，再跟着 response 回到页面。
5. 看懂项目里最常见的 Python、TypeScript 和 React 语法，而不是只会复制。
6. 用 Swagger、浏览器 Network 面板和后端日志定位 4xx、5xx、超时与 CORS 问题。
7. 在 feature branch 上完成一个小改动，运行对应测试，检查 diff，并提交而不泄露 secret。
8. 从空目录重建第 23 章的最小版，并能解释每个文件存在的理由。

本文把能力分成四级。每学一个主题，都可以用同一张表自查：

| 级别 | 你能做什么 | 还不算会的表现 |
| --- | --- | --- |
| 识别 | 看到名词知道大意 | 只能复述一句定义 |
| 解释 | 能用自己的话说输入、输出和边界 | 离开原文就说不清 |
| 验证 | 能预测结果并用工具证实 | 只凭“页面看起来正常”判断 |
| 应用 | 能安全修改、补测试并解释取舍 | 只复制代码，不知道为什么成功 |

### 0.2 推荐的学习动作：读、跑、画、改、测

每章不要连续读到底。使用下面的固定循环：

```text
读：先读一小节，只圈出不认识的词
跑：运行该节最小例子，先预测再看结果
画：画出数据从哪里来、到哪里去
改：只改一个变量或一个边界
测：运行最小相关测试，恢复或提交改动
```

例如学习 diagnose 时，不要一开始读完整个 service。先画：

```text
textarea
  -> POST /api/v1/diagnose
  -> DiagnoseRequest
  -> diagnose service
  -> repository
  -> DiagnoseResponse
  -> diagnostic report
```

然后只改一次输入：把合法的 20 个字符缩成 2 个字符，预测它会在模型调用之前返回 422。这个小实验同时验证
HTTP、Pydantic 和“失败发生在哪一层”三个概念。

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
  -> Qwen / DeepSeek（文字生成）+ OpenAI Realtime（双向语音）
  -> Qwen3-TTS-Flash（把现有文字合成音频）
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

**origin（来源）= scheme/协议 + host/主机 + 有效 port/端口**；path 和 query 不参与。即使都在本机，
`http://localhost:3000` 与 `http://localhost:8000` 也因端口不同而属于不同 origin。线上前端和后端同样是
不同 origin：

```text
https://englearning.jinxxx.de
https://enapi.jinxxx.de
```

浏览器默认不允许一个 origin 随意读取另一个 origin。**middleware（中间件）**是在 route 前后统一执行的
处理层；FastAPI 在 `app/main.py` 中通过 `CORSMiddleware` 明确允许生产前端和 Vercel Preview。
CORS 是浏览器安全规则，不是后端登录机制；curl/Postman 不替浏览器执行 CORS，所以“curl 成功、页面被
CORS 拦截”完全可能。

### 2.4 终端、目录、命令、进程和端口

**终端（terminal）** 是向操作系统输入文字命令的窗口；**shell** 是读取这些命令的程序。看到类似下面的
一行时：

```text
jinyu@mac weakspot-english-coach %
```

最后的 `%` 或 `$` 是提示符，不要把它复制进命令。`weakspot-english-coach` 通常表示当前目录。几个最先要会
的命令是：

```bash
pwd
ls
cd apps/api
cd ../web
```

- `pwd` 显示“我现在在哪个目录”。
- `ls` 显示当前目录里的文件。
- `cd apps/api` 进入子目录。
- `..` 表示父目录，所以 `cd ../web` 先向上一层再进入 `web`。
- `/` 分隔目录；`apps/web/app/page.tsx` 是从仓库根目录开始写的相对路径。

运行 `uv run python -m scripts.dev_server` 后，shell 会一直被占用，因为它启动了一个**进程**。这个进程监听
`127.0.0.1:8000`：

```text
127.0.0.1 或 localhost = 只指向你自己的电脑
8000                    = 这台电脑上区分服务的端口号
```

前端通常监听 3000，后端监听 8000，所以需要两个终端。按 `Ctrl+C` 是请求前台进程停止，不是复制文本。若
关闭终端或电脑，localhost 服务也会消失；它不是已经部署到互联网。

亲手验证：

```bash
pwd
cd apps/api
pwd
```

第二次输出应该以 `/apps/api` 结尾。若某条命令报 `No such file or directory`，先运行 `pwd` 和 `ls`，不要
靠反复重输碰运气。

### 2.5 URL、DNS 和一次 HTTP 往返

把这个 URL 拆开：

```text
https://enapi.jinxxx.de/api/v1/health
└─┬─┘ └───────┬───────┘└──────┬──────┘
 协议          主机名             path
```

- `https` 表示 HTTP 经过 TLS 加密。
- DNS 把 `enapi.jinxxx.de` 这样的主机名解析到服务器地址。
- HTTPS 默认端口是 443，所以通常不写；localhost 的 8000 必须写。
- path 告诉服务器要调用哪个 endpoint。
- query string 写在 `?` 后，例如 `?limit=20`。

一次请求不是“点按钮后服务器直接改页面”，而是：

```text
浏览器建立连接
  -> 发送 method/path/headers/body
  -> 中间件检查 CORS、身份等
  -> route 校验并调用业务逻辑
  -> 服务器返回 status/headers/body
  -> 前端根据结果更新 React state
```

最常见状态码：

| 状态码 | 普通语言 | 本项目中先查什么 |
| --- | --- | --- |
| 200/201 | 成功/已创建 | response body 是否也符合业务合同 |
| 400 | 请求语义不合法 | route 主动抛出的错误信息 |
| 401 | 未登录或凭证失效 | cookie、Authorization header |
| 403 | 身份已知但没有权限 | owner-only 边界 |
| 404 | path 不存在 | URL、router 是否注册 |
| 409 | 当前状态冲突 | 幂等 claim 或重复资源 |
| 422 | body/query 未通过 schema | 字段名、类型、长度、必填项 |
| 429 | 请求过多 | guest quota 或 rate limit |
| 500 | 服务器未处理的错误 | 后端 traceback 和 request ID |
| 503 | 依赖暂不可用 | key/provider/可降级路径 |
| 504 | 上游等待超时 | 哪一段有 timeout、是否可安全重试 |

4xx 通常表示请求或权限边界；5xx 通常表示服务器或上游依赖失败，但这只是定位起点，不是最终原因。

### 2.6 Cookie、环境变量和 secret

浏览器会在符合规则时自动随请求发送 cookie；后端用它恢复登录 session。cookie 不是 React state：刷新页面后
state 会重建，但未过期的 cookie 仍可存在。`HttpOnly` cookie 不能被普通前端 JavaScript 读取，这可以降低
token 被脚本窃取的风险。

**环境变量**是进程启动时从外部读取的配置，例如：

```text
QWEN_TTS_API_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

它们与代码变量不同：

- 后端 secret 只应存在于后端进程环境或服务器 `.env`。
- `NEXT_PUBLIC_` 会进入浏览器 bundle，任何人都能看见，绝不能放 key。
- `.env.example` 只说明字段名；`.env` 才可能含真实值，不能提交。
- 修改后端 `.env` 后要重启进程；修改 `NEXT_PUBLIC_` 后通常要重新 build/deploy。

检查“变量有没有设置”时只打印布尔值或长度，不要把 key 本身贴到终端、截图、日志或聊天中。

### 2.7 用浏览器 Network 面板看见真实请求

在 Chrome/Edge 打开开发者工具（macOS 常用 `⌥⌘I`，Windows/Linux 常用 `F12`），进入 **Network**：

1. 勾选 Preserve log，避免页面跳转后记录消失。
2. 再执行一次失败操作。
3. 点开红色请求，依次看 URL、method、status、request payload 和 response。
4. 在 Response 中找后端给出的具体错误，不要只看页面 toast。
5. 再用同一时间点和 path 去后端终端找日志。

例如页面显示“发送失败”，Network 显示：

```text
POST http://localhost:8000/api/v1/chat/sessions/.../messages
Status: (failed) net::ERR_CONNECTION_REFUSED
```

这通常表示 8000 端口根本没有进程监听，不是模型回答失败。若 status 是 422，连接已经成功，应检查 JSON
字段；若长时间等待后浏览器主动 abort 或服务器返回 504，则继续核对各层 timeout 和后端日志。先区分这三种
情况，能消除大量无效猜测。

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

### 4.3.1 变量、比较、条件、循环和 `return`

等号在程序里通常是**赋值**，不是数学命题：

```py
score = 80        # 把 80 保存到名字 score
score = score + 5 # 先读旧值 80，再把 85 写回 score
```

`==` 才是比较是否相等。常见比较还有 `!=`、`<`、`<=`、`>`、`>=`：

```py
if score >= 80:
    level = "ready"
else:
    level = "practice"
```

Python 会把 `False`、`None`、`0`、空字符串、空 list 和空 dict 当作“假”，其他多数值当作“真”：

```py
errors = []
if not errors:
    message = "No grounded errors"
```

`for` 逐个处理容器，不需要自己维护下标：

```py
for error in diagnosis.errors:
    print(error.code)
```

需要下标时用 `enumerate`：

```py
for index, error in enumerate(diagnosis.errors, start=1):
    print(index, error.code)
```

`return` 立即结束当前函数，并把值交给调用者：

```py
def status_for(score: int) -> str:
    if score >= 80:
        return "ready"
    return "practice"
```

第二个 `return` 不需要 `else`，因为第一个分支一旦执行，函数已经结束。初学者最常见的错误是把
`print(result)` 当作 `return result`：前者只把文字显示到终端，调用者拿到的仍是 `None`。

### 4.3.2 list/dict 的读取、方法和安全边界

list 使用从 0 开始的下标：

```py
codes = ["grammar.article", "grammar.verb_tense"]
first = codes[0]   # grammar.article
last = codes[-1]   # grammar.verb_tense
```

超出范围的 `codes[9]` 会抛出 `IndexError`。切片 `codes[:1]` 返回新 list，即使原 list 为空也不会因为
第 0 项不存在而失败。

dict 用 key 读取：

```py
profile = {"level": "B1", "streak": 3}
level = profile["level"]
missing = profile.get("nickname")          # None
name = profile.get("nickname", "Learner") # Learner
```

`profile["nickname"]` 在 key 不存在时抛 `KeyError`；`.get(...)` 适合字段确实可缺失的情况。不要为了
“不报错”全部改成 `.get`：必填字段悄悄变成 `None`，错误可能在更远处才爆发。

常见方法：

```py
codes.append("clarity.expression") # 原 list 增加一项
text = "  Hello ".strip()          # 新字符串 "Hello"
normalized = text.lower()          # 新字符串 "  hello "
```

字符串不可变，所以 `strip()`、`replace()`、`lower()` 返回新字符串；如果没有赋回变量，原字符串不变。

### 4.3.3 名字、属性和方法调用

下面三种点号很常见：

```py
request.text
result.model_dump()
settings.default_llm_model
```

- `request.text` 读取对象的属性。
- `result.model_dump()` 调用对象的方法；括号表示真的执行。
- `settings.default_llm_model` 从配置对象读取值。

名字来自哪里，要向上找赋值、参数或 import：

```py
from app.config import settings
```

这不是把整个 `config.py` 复制进当前文件，而是在当前模块里建立名字 `settings`，指向那个模块导出的对象。
遇到陌生调用时按顺序问：

```text
这个名字在哪里定义/导入？
点号前对象是什么类型？
括号里的参数是什么？
函数 return 什么？
异常由谁处理？
```

这个五问法比从大文件第一行一路读到底更可靠。

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

它们都是用来缩小“一个值允许是什么”的类型标注。先看 `Literal`：

```py
from typing import Literal

MemoryKind = Literal["preference", "goal", "strategy", "weakness", "episode"]
```

`MemoryKind` 在这里不是一个新的 Python class，而是一个类型别名。它表示：被标注为
`MemoryKind` 的值，应该是下面五个字符串之一：

```py
def save_memory(kind: MemoryKind) -> None:
    ...

save_memory("goal")       # 合法：是五个候选值之一
save_memory("weakness")   # 合法
save_memory("random")     # 类型检查器会提示错误
```

普通的 `str` 可以是任意字符串，而 `Literal[...]` 把范围进一步限制成几个明确的值。这很适合表示
“记忆类型”“模型模式”“语言代码”这类有限选项。

不过，`Literal` 本身主要是给编辑器和类型检查器看的。Python 运行函数时不会自动阻止
`save_memory("random")`；如果这个值来自 HTTP 请求，还需要 Pydantic 等工具在运行时验证。

`Optional` 表示“这个位置可以有指定类型的值，也可以没有值”：

```py
from typing import Optional

def display_name(nickname: Optional[str]) -> str:
    if nickname is None:
        return "Anonymous"
    return nickname
```

这里的 `Optional[str]` 等价于 Python 3.10+ 写法 `str | None`：

```py
nickname: Optional[str]
nickname: str | None       # 含义相同
```

要特别注意：`Optional[str]` 不代表调用函数时可以省略这个参数，它只代表参数值可以是 `None`：

```py
display_name(None)         # 合法，结果是 "Anonymous"
display_name("Jin")        # 合法，结果是 "Jin"
display_name()             # 错误：仍然缺少 nickname 参数
```

如果希望参数既能省略，又能接受 `None`，还要给它一个默认值：

```py
def display_name(nickname: str | None = None) -> str:
    ...
```

### 4.6 f-string

f-string 是把变量值放进字符串的一种写法。字符串前面的 `f` 表示可以计算其中 `{...}` 里的内容：

```py
def user_pk(user_id: str) -> str:
    return f"USER#{user_id}"
```

调用过程可以展开成：

```py
user_id = "abc"
result = f"USER#{user_id}"
#              └─ 把变量 user_id 的值放到这里

print(result)  # USER#abc
```

它与下面的字符串拼接结果相同，但通常更容易读：

```py
"USER#" + user_id
```

花括号里也可以放简单表达式：

```py
name = "jin"
count = 3

message = f"{name.upper()} has {count + 1} tasks"
# 结果："JIN has 4 tasks"
```

本项目用 `USER#abc` 这种字符串作为 DynamoDB key 的一部分。`USER#` 是固定前缀，
`abc` 是具体用户 ID；前缀让人和程序都能快速看出这条数据属于用户。

### 4.7 list/dict comprehension

comprehension（推导式）是“遍历一批数据，并顺便创建新容器”的简写。假设
`list_skills(user_id)` 返回：

```py
skills = [
    {"skillCode": "grammar.article", "mastery": 40},
    {"skillCode": "vocabulary.travel", "mastery": 75},
]
```

原代码使用的是 dict comprehension（字典推导式）：

```py
existing_skills = {skill["skillCode"]: skill for skill in list_skills(user_id)}
```

可以从右向左理解：

1. `for skill in list_skills(user_id)`：逐个取出技能字典。
2. `skill["skillCode"]`：把当前技能的编号作为新字典的 key。
3. 冒号后面的 `skill`：把完整的技能字典作为 value。

它等价于下面这段普通循环：

```py
existing_skills = {}

for skill in list_skills(user_id):
    key = skill["skillCode"]
    existing_skills[key] = skill
```

最终得到：

```py
existing_skills = {
    "grammar.article": {
        "skillCode": "grammar.article",
        "mastery": 40,
    },
    "vocabulary.travel": {
        "skillCode": "vocabulary.travel",
        "mastery": 75,
    },
}
```

转换的目的，是让程序可以直接按编号找技能：

```py
article_skill = existing_skills["grammar.article"]
```

这里的 `O(1)` 是算法复杂度的近似说法，意思是：字典通常可以根据 key 直接定位数据。
即使技能数量增加，单次查询所需时间通常也不会跟着线性增长。相比之下，如果保留原来的列表，
程序就要从头逐项比较，最坏要检查完整个列表，这叫 `O(n)`。

如果输入列表中有两个技能使用相同的 `skillCode`，后出现的技能会覆盖前一个，因为字典的 key
不能重复。

### 4.8 `*` 和 `**`

在下面两个容器字面量中，`*` 和 `**` 都表示“把容器拆开，将里面的内容放到这里”。

先看列表：

```py
all_candidates = [*ai_candidates, *heuristic_candidates]
```

假设：

```py
ai_candidates = ["AI-A", "AI-B"]
heuristic_candidates = ["RULE-C"]
```

那么：

```py
all_candidates = [*ai_candidates, *heuristic_candidates]
# 结果：["AI-A", "AI-B", "RULE-C"]
```

如果不加 `*`，两个列表本身会成为外层列表的两个元素：

```py
all_candidates = [ai_candidates, heuristic_candidates]
# 结果：[["AI-A", "AI-B"], ["RULE-C"]]
```

所以这里的 `*` 相当于把两个列表展开后再按顺序合并，也可以写成：

```py
all_candidates = ai_candidates + heuristic_candidates
```

再看字典：

```py
result = {**old_record, "status": "forgotten"}
```

假设旧数据是：

```py
old_record = {
    "memoryId": "m-001",
    "status": "active",
    "content": "Practice articles",
}
```

`**old_record` 会先把旧字典中的所有 key-value 放进新字典，然后再写入
`"status": "forgotten"`：

```py
result = {
    "memoryId": "m-001",
    "status": "forgotten",
    "content": "Practice articles",
}
```

因为 `"status": "forgotten"` 出现在后面，所以它覆盖了旧的 `"status": "active"`。
`old_record` 本身不会被修改；`result` 是一个新的字典。这种写法经常用于“保留旧记录的大部分字段，
只更新其中几个字段”。

覆盖顺序始终是从左到右，后面的同名 key 获胜：

```py
defaults = {"mode": "fast", "language": "en"}
user_settings = {"mode": "deep"}

settings = {**defaults, **user_settings}
# 结果：{"mode": "deep", "language": "en"}
```

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

例如，下面的写法虽然函数前有 `async`，`time.sleep` 仍会卡住事件循环：

```py
async def bad_route():
    time.sleep(5)  # 这 5 秒内，同一个事件循环不能处理其它协程
    return {"ok": True}
```

本项目采用的思路是把同步工作交给线程：

```py
loop = asyncio.get_running_loop()
result = await loop.run_in_executor(None, blocking_diagnose)
```

可以把它想成：`await` 不是“让代码自动变快”，而是“当前请求在等线程时，把事件循环还给其它请求”。
实验时同时发两个慢请求：若第二个 health 请求也一直卡住，通常说明仍有阻塞工作跑在事件循环上。

### 4.12 可变对象、复制和副作用

list 和 dict 是可变对象。两个名字可能指向同一个对象：

```py
original = {"status": "active"}
alias = original
alias["status"] = "forgotten"

assert original["status"] == "forgotten"
```

这不是数据库自动同步，而是 `alias` 与 `original` 指向同一个内存对象。若想做浅复制：

```py
copied = {**original}
copied["status"] = "active"
```

浅复制只复制最外层；嵌套 list/dict 仍可能共享。第 23 章的内存 repository 使用 `deepcopy`，是为了避免调用
者取出记录后在 repository 不知情的情况下修改存储状态。

“副作用”是函数除了 return 之外对外部世界造成的变化，例如写数据库、发模型请求、改 list 或记录日志。
纯函数只由输入决定输出，更容易测试。项目因此把 mastery 计算等纯规则放在 `core/`，把数据库副作用放在
repository。

### 4.13 decorator 和 context manager 先认形状

decorator 写在函数上方：

```py
@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
```

可以先把它理解成“注册或包装下面的函数”。`@router.get` 告诉 FastAPI：GET `/health` 时调用
`health`。函数仍能被测试直接调用，但 HTTP 是否可达还取决于 router 是否被 `main.py` 挂载。

context manager 使用 `with`，保证进入和离开时执行配套动作：

```py
with open("example.txt", encoding="utf-8") as file:
    content = file.read()
```

离开缩进块时文件会关闭，即使中间抛异常。测试 fixture、数据库资源和锁也常用同一思想。你暂时不必会自己
实现 decorator/context manager，但必须看得出“`@` 不是注释”“`with` 不只是缩进装饰”。

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

例如浏览器请求 `GET /api/v1/health` 时，匹配过程是：

```text
Uvicorn 收到 GET /api/v1/health
  -> app.main:app
  -> main.py 为 health.router 添加 /api/v1
  -> health.py 中 @router.get("/health")
  -> health_check()
  -> {"status": "ok", ...}
```

如果你新写了 `routes/debug.py` 却忘记在 `main.py` 中 `include_router`，Python 文件虽然存在，
`GET /api/v1/debug/...` 仍会返回 404。这个反例能帮助区分“模块已写好”和“路由已注册”。

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

从网络字节看，它近似这样：

```text
第 0 秒：HTTP 200 headers + " "
第 10 秒：" "
第 20 秒：" "
完成时：{"submissionId":"sub_123", ...}
```

拼起来是 `   {"submissionId":"sub_123"}`；`JSON.parse` 会忽略开头空白。若中途发送
`processing...`，最终 body 就不再是合法 JSON，所以 keepalive 只能使用 JSON 允许的空白字符。
keepalive 防的是代理“长时间没有任何 response bytes”的空闲超时；浏览器 AbortController 的 20/110 秒
是从请求开始计算的总时限，收到空白不会重新计时。

headers 一旦以 200 发出，后续模型/存储失败不能再把 status 改成 500。Diagnose/Import 此时会用 HTTP 200
结束，但 body 是 `{"error":true,"code":"...","detail":"..."}`。所以 `apiFetch` 在 `response.ok` 之后还要
检查 `payload.error`：

```text
stream headers 前失败 -> 真实 4xx/5xx
stream headers 后失败 -> HTTP 200 + error body
成功                  -> HTTP 200 + 正常 typed body
```

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

下面各节都使用同一个贯穿示例：

```text
learner text = "Yesterday I went to library."
可观察错误 = "to library" 缺少 article
可观察成功 = "Yesterday I went" 正确使用过去式
不在原文中的候选 = "at school"（必须丢弃）
```

### 7.1 前端发请求

前端通过 `apps/web/lib/api-client.ts` 请求 `/diagnose`。API client 统一处理：

- `NEXT_PUBLIC_API_BASE_URL`
- cookie
- 输出语言
- 服务端模型 ID 或 BYOK headers
- 429 登录提示
- JSON/error 解析

例如，页面最终发出的核心 body 是：

```json
{
  "userId": "demo-user-001",
  "text": "Yesterday I went to library.",
  "diagnosisMode": "fast",
  "outputLanguage": "zh-CN"
}
```

`userId` 是兼容合同字段，不是授权证明；下一节会看到后端覆盖它。

### 7.2 FastAPI 解析依赖

`apps/api/app/api/routes/diagnose.py` 先执行：

1. `get_llm_provider`：解析 Auto/Deep/Fast/自定义模型。
2. `rate_limited("diagnose")`：解析身份并检查额度。
3. 用服务端身份覆盖 `req.userId`。

例如攻击者把 body 改成 `"userId": "owner"`，但 guest cookie 解析成
`guest_abc`，route 执行后仍是：

```py
req.userId = "guest_abc"
```

若当天额度已用完，依赖会先返回 429，诊断模型不会被调用，也不会产生 DynamoDB 写入。

### 7.3 快速预检查

`_pre_check`：

- 读取或创建 profile。
- 对输入文字和输出语言生成 hash。
- 如果相同输入已经诊断过，重建以前的结果，避免重复收费和重复写数据。

例如同一用户连续提交两次相同 text、language 和 context：

```text
第一次 -> 调模型、写 submission/error/note/hash
第二次 -> 命中 hash、返回 duplicate=true、没有第二组副作用
```

如果第二个请求在第一次仍为 `processing` 时并发到达，它不会等待并共享正在传输的 response，而是立即返回
`409` 和 `detail.code="diagnosis_in_progress"`。客户端应等第一条结束后再重试；完成后才会得到
`duplicate=true` 的旧结果。只有 claim 标成 failed、失去 owner 或超过 stale 门槛时，新请求才能接管；
已经保存的 `diagnosticDraft` 可避免再次调用模型。

只改变 `analysisContext` 时 hash 会改变，因为同一句话在不同受众或任务目标下可能需要新的迁移观察。

### 7.4 召回相关长期记忆

在调用 LLM 前，`retrieve_memory_pack` 根据当前文字查询该用户的 Memory。失败时只记录日志，诊断继续执行。

例如用户有 100 条 Memory，query 与商务邮件有关，调用者并不会把 100 条全塞进 prompt：

```text
100 active/archive candidates
  -> 过滤 active、未过期、未 forgotten
  -> semantic + lexical + importance 等排序
  -> 最多 6 条详细项，约 700 estimated tokens
```

embedding API 暂时失败时，semantic 分量退化为 lexical，而不是让 `/diagnose` 返回 500。

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

例如模型返回 `"overallScore": "great"` 会在 Pydantic 边界失败并触发一次结构修复；模型返回结构合法、
但 `originalText: "at school"` 不在 learner text 中，则会通过“结构”检查，却在后续 evidence grounding
被丢弃。两道检查解决的是不同问题。

### 7.6 保存业务数据

`_llm_and_persist` 依次保存：

- submission
- 每条 diagnostic error
- learning notes
- 更新后的 skills/mastery
- profile
- submission hash

贯穿示例成功后，逻辑上会出现：

```text
SUBMISSION#...      保存原文、分数、rewrite
ERROR#...           保存 grammar.article 与原文 quote "to library"
NOTE#...            保存对应微课（若诊断返回）
SKILL#grammar...    更新 evidence/mastery
MEMORY#...          保存或合并保守 weakness candidate
```

如果某一步失败，不能把 response 包装成“全部成功”；幂等 claim 让客户端可以安全重试而不重复计数。

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

例如模型提出：

```json
{
  "kind": "weakness",
  "canonicalKey": "weakness.grammar.article",
  "evidence": "at school -> at the school"
}
```

由于 `"at school"` 不在贯穿示例原文中，`_grounded_memory_candidate` 会拒绝它。确定性代码根据已经保存的
`"to library"` error 生成的候选则有真实来源，可以进入合并流程，但第一次观察仍只是 `candidate`。

### 7.9 返回前端

最终 response 除诊断外还包括：

- `notes`
- `memoriesSaved`
- `memoryRecall.traceId`
- 被召回的 memory IDs 和 token 估算

这就是一条完整的工程链路：HTTP → 身份 → 模型 → Memory → AI → 数据库 → JSON。

简化 response 例子：

```json
{
  "diagnostic": {
    "overallScore": 78,
    "errors": [{"code": "grammar.article", "originalText": "to library"}]
  },
  "duplicate": false,
  "memoriesSaved": [{"id": "mem_article", "kind": "weakness"}],
  "memoryRecall": {
    "traceId": "mtr_abc",
    "memoryIds": [],
    "estimatedTokens": 0
  }
}
```

前端应根据 HTTP status 和字段渲染，不应从自然语言 summary 猜测错误数量。

### 7.10 一句话为什么不能立刻证明“会”或“不会”

当前实现把“诊断报告”“学习证据”和“长期弱点确认”分成三层。贯穿示例中：

```text
"to library"
  -> quote 在 learner text 中 + taxonomy code 合法
  -> 本次 grammar.article failure evidence
  -> weakness.grammar.article verification = candidate

"Yesterday I went"
  -> 模型显式返回 opportunityPresent=true、outcome=success
  -> confidence >= 0.55 且 quote 在 learner text 中
  -> 本次 grammar.verb_tense success evidence

模型没有报告 grammar.preposition
  -> 不能推导 success；“没看到错误”不等于“看到了正确使用机会”
```

长期 weakness 的确认规则在 `memory_service._verification_snapshot`：

| 独立证据 | weakness 状态 | 含义 |
| --- | --- | --- |
| 1 个来源 | `candidate` | 有一次真实观察，仍需重复 |
| 至少 2 个来源且 confidence ≥ 0.7 | `observed` | 已重复，但仍需跨日 |
| 至少 3 个来源、至少 2 天且 confidence ≥ 0.7 | `confirmed` | 达到当前保守确认门槛 |
| 用户手动创建 | `confirmed` | 用户本人确认，不等待模型重复 |

这里的“独立”按 `(sourceType, sourceId)` 去重。同一 submission 里模型重复写三遍，不会变成三个来源。

Skill evidence 同时保留累计值和最近 20 条窗口。例如 25 次机会中有 5 次 failure，而最近 20 次有
4 次 failure：

```text
opportunityCount = 25
failureCount = 5
recentOpportunityCount = 20
recentFailureCount = 4
recentErrorRate = 4 / 20 = 0.20
```

累计值回答“历史上发生过多少”，最近窗口回答“当前风险怎样”；旧错误不会因为窗口滚动而从审计历史消失。
对应合同测试是：

```bash
cd apps/api
uv run python -m scripts.single_sentence_evidence_test
```

这个测试同时证明不支持的 taxonomy code 被拒绝、原文外 quote 被丢弃、显式 success 才能记为成功、
weakness 需要跨来源/跨日确认，以及窗口只保留最近 20 条。

### 7.11 统一学习闭环：ActivityRun → EvidenceEvent → LearningState

前一节解释了“一句话只是一条证据”。项目还需要回答三个不同问题，所以不能把所有字段都塞进一个对象：

| 记录 | 普通语言 | 典型字段 | 是否反复修改 |
| --- | --- | --- | --- |
| `ActivityRun` | 学生被分配并完成了什么活动 | 类型、目标技能、状态、提示/播放/尝试次数 | 会按状态机更新 |
| `EvidenceEvent` | 某一时刻实际观察到了什么 | outcome、机会、支持强度、难度、quote | 创建后作为事实保留 |
| `LearningState` | 截至现在对某个技能的汇总判断 | 能力均值、不确定度、近期风险、复习时间 | 每条新证据后重新投影 |

真实数据流是：

```text
Diagnose / Practice / Coach / Chat / Input
  -> 建立或取得 ActivityRun
  -> 学生作答，系统形成一条 EvidenceEvent
  -> 同一数据库事务写 event 并更新 LearningState
  -> Dashboard / Coach scheduler 读取 state 决定下一步
```

这三个名字表达的是不同粒度。一次活动可以产生多条技能证据；同一技能又会汇总许多不同活动的证据。
如果只保存最终 mastery，就无法回答“哪次活动、哪句原文、有没有提示、为何发生变化”。

#### ActivityRun 是受约束的状态机

初始状态是 `assigned`。允许的转移是：

```text
assigned -> started / completed / abandoned / skipped
started  -> completed / abandoned / skipped
terminal -> 只能保持原 terminal 状态
```

`completed`、`abandoned`、`skipped` 都是 terminal（终止）状态，不能再回到 `started`。每次更新会设置对应
时间戳并增加 `version`；非法倒退由 route 转成 409，而不是静默篡改历史。`version` 也用于防止两个请求同时
拿着旧值相互覆盖。

#### 五种 outcome 不能混为“对/错”

| outcome | 含义 | 是否更新能力 |
| --- | --- | --- |
| `success` | 有机会且无提示独立成功 | 强正向 |
| `hinted_success` | 借助提示后成功 | 较弱正向，同时保留少量风险 |
| `failure` | 有机会但失败 | 负向 |
| `avoided` | 有机会但回避了目标形式 | 较弱负向 |
| `no_opportunity` | 本轮根本没有出现可评估机会 | 不更新能力，只记覆盖缺口 |

即使调用方传 `outcome="success"`，只要 `supportLevel > 0`，service 也会规范化成
`hinted_success`。这能防止“看了提示才答对”被伪装成独立掌握。反过来，`no_opportunity` 必须搭配
`opportunityPresent=false`；其他四种必须为 `true`，错误组合会在 Pydantic 层得到 422。

#### 每条证据怎样更新数值

先计算权重：

```text
weight = evaluatorConfidence * (0.75 + 0.5 * taskDifficulty)
if delayed:      weight *= 1.25
if novelContext: weight *= 1.15
最后限制在 0.05–1.75
```

`alpha` 可以先理解为“支持掌握的加权证据”，`beta` 是“支持仍有风险的加权证据”。本项目当前规则：

```text
success         -> alpha += 1.20 * weight
hinted_success  -> alpha += 0.45 * weight; beta += 0.15 * weight
failure         -> beta  += 1.00 * weight
avoided         -> beta  += 0.35 * weight
no_opportunity  -> alpha/beta 不变

abilityMean = alpha / (alpha + beta) * 100
```

例如一个全新技能从 `alpha=1, beta=1` 开始，一次普通难度 `.5`、置信度 `1`、无延迟的独立成功，
`weight=1`，于是：

```text
alpha = 1 + 1.2 = 2.2
beta = 1
abilityMean = 2.2 / 3.2 * 100 = 68.75
```

这不是说学生“确定有 68.75 分能力”，而是当前投影。随着 `alpha+beta` 增大，`abilityUncertainty`
才下降。旧版 `Skill` 已有 evidence 时，初始化还会把最多 8 单位的旧 mastery 当作 prior，所以真实老用户
不一定从 1/1 开始。

#### 最近窗口、覆盖和复习时间

`LearningState` 同时保留 lifetime counters 与最近 20 条 `recentEvidence`。最近窗口计算 failure rate、
risk、独立成功率和不同日期数；旧事件滚出窗口不等于从审计记录消失。

覆盖状态按当前合同推进：

```text
没有可评分机会                         -> unassessed
已有机会但证据不足                     -> exploring
至少 5 次机会，并覆盖两个 context/task/day -> enough_evidence
```

一次独立成功会增大 `retentionStabilityDays`，延迟成功增幅更大；提示成功只小幅增加；failure 或 avoided
会缩短稳定期。`dueAt = 当前时间 + stability`，表示下一次复习建议，不是保证遗忘的日期。状态还分别保存
每种 modality 的 alpha/beta，避免把写作成功直接当成口语已掌握。

#### 幂等和并发为什么都需要

event ID 由 `userId + clientEventId` 的 hash 产生。同一个客户端事件重试时返回原 event 和
`duplicate=true`，不会再加一次能力。首次写入把 `EvidenceEvent` 与新 `LearningState` 放在同一条件事务；
若另一请求先更新了 state version，service 最多重新读取并计算 6 次。这样不会出现“event 已保存、state
没更新”的半成品，也不会让两个旧版本静默覆盖。

#### 可亲手完成的 Swagger 实验

保持第 14 章的 moto/fake 后端运行，在 Swagger 使用同一浏览器 cookie：

1. `POST /api/v1/learning/runs`：

```json
{
  "activityType": "practice",
  "title": "Learning-state lab",
  "taskType": "fix_sentence",
  "targetSkills": ["grammar.verb_tense"],
  "modality": "writing",
  "estimatedMinutes": 5
}
```

复制 `run.id`；初始应为 `assigned`、`version=1`。用
`PATCH /api/v1/learning/runs/{run_id}` 发送 `{"status":"started","attemptCount":1}`。

2. `POST /api/v1/learning/evidence`，把占位 ID 换成真实 run ID：

```json
{
  "clientEventId": "lab-evidence-0001",
  "runId": "替换为真实 run.id",
  "sourceId": "learning-state-lab",
  "skillCode": "grammar.verb_tense",
  "outcome": "success",
  "opportunityPresent": true,
  "supportLevel": 1,
  "modality": "writing",
  "taskType": "fix_sentence",
  "taskDifficulty": 0.5,
  "evaluatorConfidence": 1.0,
  "contextKey": "past-trip",
  "novelContext": false,
  "delayed": false,
  "evidenceQuote": "Yesterday I went to school."
}
```

由于 `supportLevel=1`，response 的 event 应是 `hinted_success`。完全重复同一 body，第二次应
`duplicate=true`，state 计数与 version 不再增加。打开 `GET /api/v1/learning/overview`，找到该技能并
解释每个变化。

3. 把 run patch 为 `{"status":"completed"}`，再故意 patch 回 `{"status":"started"}`；预期 409。
另做一次纸上预测：把 `outcome` 改为 `no_opportunity` 却保持 `opportunityPresent=true`，预期 422。

最后运行可重复合同：

```bash
cd apps/api
uv run python -m scripts.learning_loop_test
```

只有当你能解释“为什么提示成功不是独立成功、为什么重复 event 不加两次、为什么 terminal 不能倒退”，
才算真正理解了这条学习闭环。

## 8. AI provider 和新的模型选择功能

### 8.1 先分清 provider、model、API、SDK、prompt 和 token

这些词经常被混成“AI”，但故障边界完全不同：

| 词 | 普通语言 | 本项目例子 |
| --- | --- | --- |
| provider | 提供网络服务和计费的一方 | Alibaba Model Studio、DeepSeek、OpenAI |
| model | provider 托管的具体模型 | Qwen、DeepSeek chat、GPT-5.6、Qwen3-TTS-Flash |
| API | 程序通过网络调用服务的合同 | Chat Completions、Responses、Realtime、TTS |
| SDK | 帮程序构造 API 请求的代码库 | Python `openai` package |
| prompt | 发给文字模型的指令和上下文 | 诊断规则、learner text、Memory Pack |
| token | 模型处理文本的计量单位 | context budget、usage、价格通常按 token 计 |

所以“代码使用 OpenAI SDK”不等于“请求一定发给 OpenAI”。SDK 可以向兼容 base URL 发请求。反过来，同一
provider 的文字、Realtime、embedding 和 TTS 也可能使用不同 API、模型、价格和 key。

文字模型不是数据库或证明器。它根据上下文预测输出，因此可能：

- **hallucinate**：生成听起来合理但没有证据的内容；
- 返回合法 JSON，却引用 learner text 中不存在的句子；
- 因 context 太长而截断重要内容；
- 在同一 prompt 上产生略有差异的答案。

项目用四层约束降低风险：

```text
prompt 说明任务
  -> Structured Output/Pydantic 限制形状
  -> deterministic grounding 检查证据
  -> 测试和 trace 验证业务边界
```

“结构化输出”只证明字段、类型和允许值正确，不证明解释一定真实。这正是第 7.10 节不能把一句话直接当成长
期结论的原因。

embedding 是另一类模型调用：它把文本变成一串数字向量。两个句子的向量方向越接近，通常表示语义越相近。
系统用 cosine similarity 比较方向，不是让 embedding 生成答案：

```text
"I want to practice job interviews"
  -> [0.12, -0.03, ...]

"Help me prepare for an interview"
  -> [0.10, -0.01, ...]
  -> cosine similarity 较高
```

向量相似也不是事实证明；它只是召回候选的一个信号，所以 Memory 排序还结合 lexical、recency、importance
和 verification。

### 8.2 为什么可以同时支持多个提供方

Qwen、DeepSeek 和很多服务都提供近似 OpenAI Chat Completions 的接口。项目统一使用 OpenAI Python SDK，但传入不同的 `base_url`、key 和 model。

默认优先级在 `config.py`：

```text
同时有 OPENROUTER_API_KEY 与 DEEPSEEK_API_KEY -> 默认组合：Luna Pro Deep / 官方 DS V4 Flash 0731 Fast
只有 OPENROUTER_API_KEY -> OpenRouter（Deep: Luna Pro / Fast: Luna）
否则有 QWEN_MODEL_STUDIO_API_KEY -> Qwen
否则有 OPENAI_COMPAT_API_KEY -> provider-neutral 配置
否则 -> 旧 DeepSeek 配置
```

### 8.3 Auto、Deep 和 Fast

`GET /api/v1/llm/models` 只返回安全的 ID、标签和模型名，不返回 key/base URL。

目录不是写死的一张全局表，而是根据当前服务器真正配置的 provider 动态产生：

```text
default        -> Auto：使用该服务器配置的 deep / fast 默认组合
openrouter-deep -> 配置 OpenRouter key 时才出现
openrouter-fast -> 配置 OpenRouter key 时才出现
qwen-deep      -> 配置 Qwen key 时才出现
qwen-fast      -> 配置 Qwen key 时才出现
deepseek-deep  -> 配置 DeepSeek key 时才出现
deepseek-fast  -> 配置 DeepSeek key 时才出现
```

当前默认组合是 OpenRouter Deep `openai/gpt-5.6-luna-pro` 与 DeepSeek 官方 Fast
`ds-v4-flash-0731`；OpenRouter Luna 仍保留为可选 Fast。若一台服务器同时配置多个 provider，安全目录
才会显示对应选项，并允许用户组合 deep 与 fast。不要把某次部署看到的目录误认为前端常量。

当前 UI 独立选择 deep 和 fast，因此浏览器通常发送两个 allowlisted ID：

```http
X-LLM-Server-Deep-Model: openrouter-deep
X-LLM-Server-Fast-Model: deepseek-fast
```

后端在 allowlist 中解析 pair，再使用自己的 secret。旧的单模型 `X-LLM-Server-Model` 仍为兼容保留；新前端不需要把 deep/fast 挤成一个不透明选项。选择 `default` pair 才保留服务器按任务自动路由。

任务最终选 fast 还是 deep，不应散落在每个 service 里。`services/model_routing.py` 用
`select_text_model(tier, provider)` 统一解析：fast 优先请求的 `fast_model`，缺失时退回 deep；deep 还保留
`max` reasoning effort，fast 使用 `medium`。OpenRouter 通过统一的 `reasoning.effort` 对象接收该设置。
这让“速度/质量策略”和“具体 provider 名字”保持分离。

### 8.4 为什么已有 Chat session 不随全局选择变化

创建文字会话时，后端把选择的 server model ID/具体模型保存到 session。之后改变浏览器全局选择，不应偷偷改变旧对话的 provider，否则上下文行为会突然漂移。

例如周一用 `deepseek-deep` 创建 `chat_1`，周二把全局 Fast 改成 Qwen；继续 `chat_1` 时仍使用它保存的
provider/model，新建的 `chat_2` 才使用新选择。这个行为让同一会话可以复现和审计。

### 8.5 BYOK 是另一条路径

用户也可以在浏览器 localStorage 保存自己的 OpenAI-compatible key，并通过 headers 仅用于当前请求。它与 server model selection 不能同时使用，并要求 HTTPS base URL。

注意：localStorage 能被同源 JavaScript 读取，因此 BYOK 是用户自行承担的浏览器侧选择；服务器生产 key 绝不能通过此方式下发。

反例：同时发送 `X-LLM-Server-Deep-Model` 和 BYOK key 会被拒绝，而不是“哪个 header 最后出现就用哪个”。
实验时只使用测试 key，并在浏览器 DevTools 的 Network 面板确认生产 server key 从未出现在 request/response。

### 8.6 Qwen 的特殊兼容处理

Model Studio Qwen 路径会：

- 使用 JSON mode。
- 设置 `enable_thinking: false`，保证结构化响应稳定。
- 不发送不兼容的 `reasoning_effort`。

其他提供方如果不支持 `reasoning_effort`，客户端会检测错误并移除该参数重试。

例如第一次请求返回 provider 的 “unknown parameter: reasoning_effort”，adapter 才用同一 messages 和
request ID 做一次兼容重试；认证失败或限流不能靠删除参数重试，否则会掩盖真正故障并重复收费。

### 8.7 Realtime voice 是独立模型系统

文字 AI selector 不控制语音聊天。Chat 语音模式使用 OpenAI Realtime API，后端用真实 OpenAI key 换取短期 client secret，并通过 sideband 连接保存 transcript、usage 和会话状态。这条路径负责低延迟双向对话，不等于把一段现成文字转换成 MP3。

例如：

```text
Realtime: 用户说一句 -> 模型边听边回话 -> transcript/usage 持续产生
TTS: 已有 "Hold on a second." -> 一次请求 -> 返回完整 audio/*（当前通常是 WAV）
```

所以在文字模型 selector 中选 Qwen，不会自动把 Realtime 语音模型也切成 Qwen。

### 8.8 Coach Speech/TTS 是第三条模型路径

Coach 听力和语音场景使用 Qwen 的非实时 TTS API，而不是 Realtime：

```text
浏览器 POST /api/v1/coach/speech { text, style }
  -> rate_limited("coach_speech")
  -> tts_service.generate_speech
  -> Qwen3-TTS-Flash 原生生成接口
  -> 校验 Alibaba 音频 URL 并下载
  -> private, no-store provider audio
```

几个容易混淆的概念：

- **TTS**（text-to-speech）：服务器把已经存在的英文文字变成音频。
- **ASR/STT**（speech-to-text）：浏览器的 Web Speech Recognition 把用户说话暂存成可编辑文字。
- **Realtime**：Chat 中持续的双向语音会话。

`CoachSpeechRequest` 最多接收 4096 个字符，只允许 `gentle / natural / challenge` 三种 style；`qwen3-tts-flash` 试用期间保留这个客户端合同，但不据此改变语速。模型、声音和语言来自服务器环境变量：

```text
QWEN_TTS_API_KEY
QWEN_TTS_BASE_URL
QWEN_TTS_MODEL
QWEN_TTS_VOICE
QWEN_TTS_LANGUAGE
```

默认是 `qwen3-tts-flash`、`Cherry` 与 `English`。服务优先使用专用 `QWEN_TTS_API_KEY`；未设置时依次复用 `QWEN_MODEL_STUDIO_API_KEY`、`QWEN_EMBEDDING_API_KEY`。key 只在后端，前端既不接收也不缓存。服务未配置或 provider 失败时，API 返回 503/502，Coach 显示回退说明并使用浏览器 `speechSynthesis`，所以语音增强失败不会阻断文字练习。owner-only Input Lab 2.0 当前仍直接使用浏览器 speech synthesis；不要误写成它已经接入同一服务端音频路径。

### 8.9 GPT-5.6 Adaptive Mission Planner

Coach 有两种明确分开的运行路径：

```text
runtimeMode = "adaptive_planner"
  -> official OpenAI Responses API
  -> gpt-5.6-sol + Pydantic Structured Outputs
  -> mission + plannerInsight + generation metadata

runtimeMode = "selected_provider"
  -> 当前用户选择的安全 server pair / BYOK provider
  -> OpenAI-compatible Chat Completions
  -> mission
```

前者用于 Today’s Mission，后者用于 Chat 页面的随机情境。不能把第二条路径生成的内容标成 GPT-5.6 证据。`coach_service.py` 的核心分支是：

```py
if uses_adaptive_mission_planner(req):
    result, generation = parse_gpt56_mission(
        messages=messages,
        response_model=_gpt56_response_model_for_request(req),
        user_id=user_id,
        max_output_tokens=max_tokens,
        trace_id=trace_id,
    )
    planner_insight = result.plannerInsight
else:
    result = parse_with_model(
        messages=messages,
        response_model=_response_model_for_request(req),
        model=selected_coach_model(req, llm_provider),
        provider=llm_provider,
    )
```

`openai_mission_service.py` 使用官方 Responses API、`store=False`、哈希后的 safety identifier，并直接把响应解析成指定 Pydantic model。`config.py` 还会 fail closed：功能开启但没有 key，或 model 名不以 `gpt-5.6` 开头时，任务生成失败，而不是偷偷换模型后继续展示错误的运行时标签。

返回值中的 `plannerInsight` 回答四件事：

- `whyNow`：为什么现在练这个。
- `evidenceUsed`：哪些有界证据参与选择。
- `adaptation`：时长、模态和精力选项怎样改变任务。
- `evaluationFocus`：完成后观察什么可见语言信号。

前端只有同时看到 `mission.generation.provider === "OpenAI"` 和 `plannerInsight` 才显示证据面板。也就是说，UI 展示的是后端返回的运行时事实，不是写死的宣传文案。

## 9. DynamoDB：不是把 SQL 表换个名字

### 9.1 先理解数据库、item、key、Query 和 Scan

数据库是让数据在进程停止后仍能保存，并支持按规则读取的系统。第 23 章的 Python dict 只在内存里；后端一
停止就丢失。DynamoDB 的基本单位可以先这样理解：

| 通用概念 | DynamoDB 名称 | 本项目例子 |
| --- | --- | --- |
| 一份记录 | item | 一个 profile、一条 memory |
| 记录中的一个值 | attribute | `status="active"` |
| 唯一定位规则 | primary key | `PK + SK` |
| 按 key 条件读取一组记录 | Query | 某用户所有 `MEMORY#` |
| 检查整张表 | Scan | 测试/维护时偶尔使用，主请求应避免 |

关系型数据库通常先设计多张 table，再用 join 组合；DynamoDB 更强调先列出 **access pattern**：

```text
我要怎样读取数据？
  -> 已知 userId，读取 profile
  -> 已知 userId，按时间列出 submissions
  -> 已知 userId，只列出 MEMORY# 前缀
```

然后反推 key。DynamoDB 的 partition key 决定数据分组，sort key 在组内排序并支持前缀/范围条件。
`Query` 能直接定位一个 partition；`Scan` 通常要查看大量无关 item，因此数据增长后成本和延迟都更差。

数据库一次 response 也可能放不下全部结果，会返回 continuation key；调用者必须继续 Query，这叫**分页**。
“用户 History 要完整显示”和“给模型的上下文必须有界”是两个不同规则：前者可能读完所有页，后者应在业务
层明确截取，不应把数据库第一页误当成全部历史。

### 9.2 单表设计的核心

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
| Chat message (v2) | `CHATMSG#chat_xxx#2026-...#msg_xxx` |
| Memory | `MEMORY#mem_xxx` |
| Recall trace | `MEMTRACE#2026-...#mtr_xxx` |
| Activity run | `RUN#run_xxx` |
| Completed-run timeline | `RUN_TIME#2026-...#run_xxx` |
| Evidence | `EVIDENCE#ev_xxx` |
| Evidence timeline | `EVIDENCE_TIME#2026-...#ev_xxx` |
| Unified learning state | `LEARNING#grammar.article` |

这样可以执行：

```text
PK == USER#abc and SK begins_with MEMORY#
```

这个 access pattern 可以逻辑上列出该用户的 Memory；底层可能需要跟随 `LastEvaluatedKey` 做多页 Query，
repository/API 还会执行显式的 200/500 等上限。不要把“一种 Query 条件”误解成“一页永远返回无限数据”。

Coach mission 本身目前是短期生成结果，没有单独的 `MISSION#...` DynamoDB 行。普通描述、听力、决策和词汇任务在页面刷新后不会作为任务对象恢复；它们产生的诊断、错误、笔记和 Memory 会按原有链路持久化。`guided_scene` 在用户第一次发言时才创建正式 Chat session，之后消息和会话分析按 `CHAT#...` / `CHATMSG#...` 保存。区分“任务脚手架”和“学习证据”能避免为了保存 UI 状态而复制一套学习历史。

用五条纸上数据验证 Query：

```text
PK=USER#abc  SK=PROFILE
PK=USER#abc  SK=MEMORY#001
PK=USER#abc  SK=MEMORY#002
PK=USER#abc  SK=NOTE#001
PK=USER#xyz  SK=MEMORY#003
```

条件 `PK = USER#abc AND begins_with(SK, "MEMORY#")` 只返回 001、002。它不会返回 abc 的 NOTE，也不会
混入 xyz 的 MEMORY。若你的预测不同，先回到“partition 选组、sort key 在组内筛选”这句话。

### 9.3 repository 层

route/service 不应散落 `table.query(...)`。`repositories.py` 提供诸如：

```py
list_recent_errors(user_id)
save_memory(memory)
get_chat_session(user_id, session_id)
```

以后更换 key pattern 或增加条件写，主要修改 repository。

### 9.4 为什么有 Decimal 转换

DynamoDB 的 boto3 不接受 Python `float`，读出的数字通常是 `Decimal`。`db/serialization.py` 在写入前递归执行 float → Decimal，读出后 Decimal → int/float。

例如直接写 `{"mastery": 73.5}` 可能触发 boto3 的 float 序列化错误；repository 实际先变成：

```py
{"mastery": Decimal("73.5")}
```

读回 API 前再转成 `73.5`，否则 FastAPI/JSON encoder 可能不知道怎样公开 `Decimal`。

### 9.5 一致性、条件写和 TTL

一次“先读再改再写”不是天然原子的。两个请求同时读到 4，各自写 5，最终可能丢掉一次增加。DynamoDB
conditional expression 可以要求“只有数据库仍是我读到的版本时才写”；transaction 则用于需要一起成功或
一起失败的多项操作。项目在幂等 claim 等关键路径使用条件边界，但第 18.1 节也明确列出仍值得改进的
read-modify-put。

Memory 的 `expiresAt` 用于业务层立即过滤，`ttl` 交给 DynamoDB 后台物理删除。DynamoDB TTL 不是定时器，过期行可能稍后才真正消失，所以代码绝不能依赖“到点立刻物理删除”。

例如 `expiresAt=12:00`、当前时间 `12:01` 时，retrieve 必须立即排除这条 Memory；即使你此时在 DynamoDB
控制台仍能看到该行，也不代表业务过滤失败。TTL worker 可能到稍后才物理删除它。

## 10. 核心学习闭环与 Coach 引导

### 10.1 Learner profile 和 skills

Profile 保存总体等级、提交次数等。每个 `SKILL#...` 保存掌握度、错误/正确次数和最后练习时间。

Skill 是可统计的弱点模型，例如 `grammar.article`；Memory 则保存更语义化、跨场景的事实。两者不能互相替代。

例如同一用户可以同时拥有：

```json
{
  "profile": {"cefrLevel": "B1", "submissionCount": 12},
  "skill": {"skillCode": "grammar.article", "mastery": 58, "errorCount": 7},
  "memory": {"kind": "goal", "content": "Prepare for an interview in September."}
}
```

Profile 回答“整体是谁/做了多少”，Skill 回答“某个可量化能力怎样”，Memory 回答“跨技能、可语义召回的
长期事实”。把面试日期硬塞进 mastery 或把 article 58 当成自然语言偏好都会破坏职责。

### 10.2 Plan

`POST /plan` 读取：

- profile
- 最多 20 个 skills
- 有界的 recent errors
- 相关 Memory Pack

然后生成并保存 7 天计划。当前默认 error scope 是最近一周；`errorScope="all"` 表示不限定为本周，但仍只
读取最近 50 条并压缩为最多 40 条 prompt evidence。它是“全时间范围中的有界近期样本”，不是把全部历史
无限塞进模型。

请求例子：

```json
{
  "userId": "body-value-will-be-overwritten",
  "errorScope": "weekly",
  "outputLanguage": "zh-CN"
}
```

`weekly` 控制“哪些 error 进入生成上下文”，不代表删除一周前的数据。返回计划固定有 7 天；每天
2 个 task，每个 task 3 道 exercise，且 `estimatedMinutes` 被 model validator 规范成 15。若模型返回
8 天或每个 task 5 道题，边界会裁到合同上限；若返回非法 skill code，则验证失败而不是保存脏计划。

### 10.3 Practice

Practice 分三种题型：

- `fix_sentence`
- `fill_blank`
- `rewrite_sentence`

生成时可以由用户指定技能/题型；否则使用新的 decision policy 自动选择。提交后保存 attempt、更新 mastery，并积累 strategy/episode memory。

**混合练习（mixed session）不是四次独立“只取 top-1 skill”的请求。** 前端会并行生成多道题，并为每一道带上：

```text
sessionSlot   // 本 session 中的第几题，从 0 开始
sessionSize   // 本 session 一共几题（例如 4）
```

对应 API 字段见 `apps/api/app/models/practice.py`，前端在
`apps/web/lib/api-client.ts` 的 generate 调用里传入。后端
`decision_service.recommend_next_action` 用这些字段做三件事：

1. **技能分散**：在高 need 技能池里按 slot 轮换，避免四道题都打同一个 proper-noun 大小写错误。
2. **阶段轮换**：`replay → variation → transfer → variation`（在证据仍只支持 replay 时不会硬推 transfer）。
3. **表面形式**：只有 slot 0 且 stage 为 `replay` 时保留 `errorFingerprint`；后续题必须换人名、场景和句式，prompt 里也会写明 “distinct surface form”。

如果不传 `sessionSlot`，行为仍是单次推荐，兼容旧客户端。

例如一个四题 mixed session 可以并行发送。下面数组用于一次看清四个 body；实际是四次独立请求，不是把
整个数组发给单个 endpoint：

```json
[
  {"sessionId":"mix_20260729","sessionSlot":0,"sessionSize":4},
  {"sessionId":"mix_20260729","sessionSlot":1,"sessionSize":4},
  {"sessionId":"mix_20260729","sessionSlot":2,"sessionSize":4},
  {"sessionId":"mix_20260729","sessionSlot":3,"sessionSize":4}
]
```

四个请求共享 session 身份，但 slot 不同。后端因此可以让第 0 题 replay 冠词原错误，第 1 题换成
动词时态 variation，第 2 题做冠词 transfer，第 3 题再换题型，而不是四次复制同一句话。

### 10.4 History 展示不截断，删除也不是只删一行

`GET /history/{userId}` 是用户查看自己长期学习记录的界面，因此 submissions、errors 和 notes 都不设固定条数上限。`list_recent_submissions(..., limit=None)` 和 `list_recent_errors(..., limit=None)` 会循环读取 DynamoDB 的 `LastEvaluatedKey`，直到所有页完成。Dashboard、计划和 AI prompt 仍可以明确传入数字 limit 来控制摘要和上下文成本；这些内部有界读取不能影响用户在 History 中查看完整数据。

History 删除是用户点击删除、阅读影响说明并再次确认后的手动永久操作，不是弱点模型的自动毕业动作。删除 submission 时还要：

- 删除对应 errors 和 hash。
- 删除该 submission 生成的 Notebook notes。
- 回滚这些 error 对 mastery 的影响。
- 撤销该 submission 对 Memory 的 evidence。

接口返回 `removedErrors` 和 `removedNotes`，让 UI 可以准确告诉用户删除了什么。

当前必须诚实记录一个一致性缺口：Diagnose 还会写统一 `RUN#`、`EVIDENCE#` 和 `LEARNING#`，现有删除 route
尚未撤销/重算这些新记录。因此删除已经级联到旧 Skill/Memory/Notebook，但 **Learning Overview 仍可能保留
该来源的 evidence/state**。在实现带并发保护的 evidence retraction/rebuild 前，UI 和文档不能宣称“所有派生
学习状态都已删除”。这是第 18 章列出的待改进边界。

例如删除 `sub_123` 前有 2 条 error、1 条 note，且两个 error 都降低过 mastery：

```json
{"submissionId":"sub_123","errors":2,"notes":1}
```

确认删除后，response 应明确报告类似：

```json
{"deleted":true,"removedErrors":2,"removedNotes":1}
```

若只删 `SUBMISSION#...` 而不撤销 error source refs，Memory Center 仍会显示来自一个已不存在来源的弱点，
这就是需要级联回滚的反例；统一 Learning state 的完整撤销则仍是后续工作。

### 10.5 Notes 和 Notebook

诊断、对话结束分析和 ChatGPT 导入都可以产生 expression、vocabulary、grammar 笔记。每条记录用 `NOTE#<createdAt>#<noteId>` 作为排序键，并用 `submissionId` 指向产生它的诊断、导入或会话来源。

`GET /notes` 不限制笔记数量。repository 会沿着 DynamoDB 的 `LastEvaluatedKey` 读取所有页，再按最新优先返回。前端导出 Markdown 时也导出全部笔记，而不是只导出当前筛选结果。

Notebook 先按学习状态分成“当前 / 以前 / 全部”，再按表达、词汇、语法分类：

- 同一来源仍关联 active weakness：当前笔记。
- 同一来源只关联 resolved weakness、没有 active weakness：以前的笔记。
- 没有关联到 weakness：默认仍是当前参考资料。

“以前”只是可逆视图，不会改写或删除 NOTE 行。系统的证据毕业机制把 weakness Memory 标记为 `resolved`，笔记继续保留，避免模型误判让用户失去资料；新错误让 weakness 重新 active 后，同一笔记会自动回到“当前”。未来可以基于更长时间的数据设计物理清理策略，但当前没有启用自动删除旧笔记。

例如一条 article note 来源是 `sub_123`：

```text
weakness.grammar.article = active   -> Notebook “当前”
weakness.grammar.article = resolved -> Notebook “以前”
同技能再次出现 grounded error       -> weakness reopened -> Notebook 自动回“当前”
```

三步中 NOTE 数据本身没有删除或重建，变化的是根据来源证据计算出的视图。

### 10.6 Daily Wins

Stats service 按用户时区把 submission、attempt 等事件分组为本地日期，再计算 streak、平均分、成就和下一步行动。时间处理要使用 timezone-aware datetime，不能简单截取 UTC 日期。

例如洛杉矶用户在 `2026-07-29 23:30 PDT` 完成练习，对应 UTC 已是
`2026-07-30 06:30Z`。Daily Wins 应计入用户的 7 月 29 日；若直接截取 UTC 日期，就会错误地把 streak
移到 7 月 30 日。

### 10.6.1 Session Win（一次练习结束时的小胜利）

Daily Wins 是**服务端、按日聚合**的统计；Session Win 是**前端、单次闭环结束**时的即时反馈。目标是：用户刚诊断完、刚判完练习、刚结束 Coach/Chat 时，立刻看到“我得到了什么 + 下一步点哪里”，而不是空白回到首页。

实现入口：

| 文件 | 职责 |
| --- | --- |
| `apps/web/lib/session-win.ts` | 从已有结果构造 `SessionWinModel`；`markSessionWin` / `getWelcomeBackMessage` |
| `apps/web/components/session-win.tsx` | 展示卡片；挂载时写入 localStorage |
| `diagnostic-report.tsx` / `practice/page.tsx` / `coach/page.tsx` / `session-summary.tsx` | 各闭环结束时挂上卡片 |
| `app/page.tsx` | 隔天（或更久）回来时显示 welcome-back 文案 |
| `lib/i18n.ts` 的 `sessionWin` | 中英文案 |

数据流可以记成：

```text
Diagnose / Practice grade / Coach feedback / Chat analyze
  -> sessionWinFromDiagnose | sessionWinFromPractice | ...
  -> <SessionWin model=... />
  -> markSessionWin(source)  // localStorage: weakspot-last-session-win
  -> 下次打开首页，若 last day < today，显示 welcome-back
```

要点：

- **不新增后端 API**，也不写 DynamoDB。wins 文案从现有 `DiagnosticResult`、grades、session analysis 派生。
- 标题按粗分档（例如 diagnose 用 overallScore 阈值）选文案，wins 最多 2 条，避免变成第二份报告。
- `localStorage` 失败（隐私模式）直接忽略；welcome-back 只是增强，不能当账号级进度。
- 与 Daily Wins 互补：一个回答“今天整体如何”，一个回答“这一次刚结束时我为什么不该关掉页面”。

### 10.7 文字 Chat、预测和会话分析

文字 Chat 保存 session/messages。发送消息时只带最近的会话消息和有界 Memory Pack，避免上下文随历史无限增长。结束后可分析 corrections、natural expressions、weaknesses 和 notes。

例如会话有 80 条 message，而 `memory_chat_recent_messages=12`：

```text
发送第 81 条
  -> prompt 只取最近 12 条 + 有界 Memory
  -> DynamoDB 仍保留完整 80 条历史
```

“prompt 有界”与“用户历史被删除”是两件不同的事。

### 10.8 ChatGPT 导入

导入功能把历史对话转换为 transcript，再由**前端**分批请求：`selectImportConversations` 先按英语学习
相关性选择会话，并为每个入选会话保留最近 80 条消息；`chunkChatImportConversations` 再保证每个会话
片段不超过后端普通权限的 120 条消息、每批不超过 20 个会话，并按序列化后的 UTF-8 字节把请求控制在
约 200 KB。Import 页面逐批调用 service，最后仍由前端合并各批 response。后端只分析收到的一批，不会
替浏览器拆分或汇总 300 条消息。

因此“文件里有 300 条消息”不等于“一次 prompt 塞入 300 条”：若它们分布在多个入选会话中，前端可能
产生多个有界请求；若 300 条都在同一个会话中，当前产品选择层只分析最近 80 条。batch helper 仍独立
执行 120 条上限，防止未来调用方绕过选择层后构造出普通权限会被 400 拒绝的 request。
学习者说的话可以提供错误证据；assistant 已给出的 correction 可以作为已确认的纠正上下文，但不能把
assistant 自己的语法错误误记成 learner error。

### 10.9 登录、guest 和限流

身份层支持：

```text
owner -> member -> signed-in user -> guest
```

- GitHub/Google OAuth 成功后写 HttpOnly session cookie。
- guest 使用长期 guest cookie，并按 `x-real-ip` → `x-forwarded-for` → socket peer 的顺序取 IP 计额度。
  代码本身没有 trusted-proxy allowlist；安全性依赖 FastAPI 8000 不被公网绕过，且 Nginx/Cloudflare 覆盖而
  不是透传客户端伪造的转发头。这是部署不变量，不是 header 天然可信。
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

**计时任务与反馈不能互相打架。** 选了 5/10/15 分钟后，`active` 阶段会开写作/语音计时。用户提交完成时必须**永久冻结**计时器（见 `coach/page.tsx` 里 finish 路径的注释）：否则 duration 到点会把用户从 `feedback` 踢走，Session Win 和批改结果也会一起消失。语音超时则走另一条路径：`use-realtime-chat` 的 `onAutoEnd` 先保存 transcript，再交给分析，而不是静默清空 UI。

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

例如任务要求“礼貌拒绝老板临时加会”，用户写 `I don't want it.`。这次可以记录
`vocab.word_choice`/register 观察；但 UI 只能说“这次表达与受众不完全匹配”。如果用户在不同受众、不同
日期反复出现相同问题，verification 才从 candidate → observed → confirmed。

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

权限反例很具体：普通用户即使手工在地址栏输入 `/input/experimental`，或直接 POST endpoint，也必须得到
403；只在导航中隐藏链接却让 API 返回 200，说明授权只做在 UI，属于安全漏洞。

### 10.16 随机对话为什么曾出现两个连续 500，以及怎样定位

Chat 页面的“Generate a random conversation”实际包含两个串行 POST：

```text
1. POST /api/v1/coach/missions
   返回 guided_scene mission
2. POST /api/v1/chat/sessions
   把 mission 变成可持久化的 Chat session
```

所以用户只看到一个红色 toast，并不代表只有一个后端函数。浏览器 Network 面板必须分别检查两个请求的 status、response body 和 request payload。

前端实现位于 `apps/web/app/chat/page.tsx`：

```tsx
const mission = await generateCoachMission({
  durationMinutes: sceneGenerationMode === "deep" ? 15 : 10,
  modality: "text",
  energy: "normal",
  generationMode: sceneGenerationMode,
  runtimeMode: "selected_provider",
  preferredType: "guided_scene",
})

const session = await createChatSession(
  DEMO_USER_ID,
  mission.title,
  undefined,
  mission.scene?.scenarioPrompt,
  mission.scene?.starterMessage,
  mission.scene?.scenarioFamily,
  mission.scene?.scenarioKey,
)
```

第一类失败来自 AI 可能生成超过 session 合同的长 `scenarioPrompt`。只让模型“尽量简短”并不可靠，因此 `CoachScene` 在模型边界做确定性裁剪：

```py
class CoachScene(BaseModel):
    scenarioPrompt: str = Field(
        min_length=1,
        max_length=COACH_SCENARIO_PROMPT_MAX_CHARACTERS,
    )

    @field_validator("scenarioPrompt", mode="before")
    def bound_scenario_prompt(cls, value: object) -> object:
        # 保留开头的角色/设定和结尾的行为规则
        ...
```

第二类边界发生在生成成功后创建 session：`ChatCreateSessionRequest.topic` 允许最多 300 字符，而 ActivityRun `title` 最多 240 字符。当前 Coach mission title 自身最多 160 字符，因此正常动态场景不会触发这一差值；但普通客户端可以提交 241–300 字符 topic，未来上游合同也可能变宽。route 应在写入**较窄的下游合同**前显式投影，而不是依赖某一个调用方碰巧更短：

```py
CreateActivityRunRequest(
    title=req.topic[:240] if req.topic else "English conversation",
    goal=req.topic or "Practice meaningful English conversation.",
)
```

同时，DynamoDB 单条 item 仍有大小上限。repository 在序列化后检查 item 大小，并把特定异常转换成 API 的 `413 payload_too_large`；未知异常才是 500。这样前端和日志能区分“用户/模型 payload 太大”与“服务器内部故障”。

这一故障给新手四个通用调试原则：

1. 一个按钮可能调用多个 API，逐个定位失败请求。
2. Pydantic 上游验证通过，不代表更窄的下游 model/database 一定能接收。
3. LLM 输出必须有确定性边界；prompt 约束不是数据库保护。
4. 500 response 应携带服务端 request/trace ID，日志用该 ID 串起 route 和 service。

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

例如 query 是 “prepare for a job interview”，Memory 写的是 “practice answering recruiter questions”。
两者共享词很少，lexical 分数可能低，但 embedding 可以判断语义接近。若 embedding API 超时，系统仍按
`interview / recruiter / questions` 等可见 token、importance 和 recency 排序；质量可能下降，但请求继续。

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

数值例子（先不计 verification factor）：

```text
semantic=0.80, lexical=0.50, importance=0.90
recency=0.70, frequency=0.20, critical=1.00

score =
  0.50*0.80 + 0.15*0.50 + 0.15*0.90
  + 0.10*0.70 + 0.05*0.20 + 0.05*1.00
  = 0.74

若 pinned，再加 0.15 -> 0.89
```

`candidate` weakness 还会乘较低 verification factor，所以一次高相似度观察不应压过已确认的重要目标。

### 11.7 为什么还要保留关键记忆名额

纯相似度排序可能因为 query 没出现 “IELTS” 而漏掉重要目标。ranker 会保留最多两条高重要度 preference/goal，然后再填充普通高分候选。

例如 6 个名额的纯相似度 top-6 全是近期冠词 episode，但用户有一条高重要度
`goal.ielts_7`。保留策略可以先占 1 个 goal 名额，再用剩余 5 个名额按普通分数填充；它不是让 goal 永远
排第一，而是防止关键长期方向完全消失。

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

简化 trace 例子：

```json
{
  "id": "mtr_abc",
  "purpose": "diagnose",
  "totalCandidates": 18,
  "selectedMemoryIds": ["mem_goal", "mem_article"],
  "estimatedTokens": 164,
  "tokenBudget": 700,
  "selected": [{
    "id": "mem_article",
    "score": 0.73,
    "scoreBreakdown": {
      "semantic": 0.82,
      "lexical": 0.40,
      "verification": "observed",
      "verificationFactor": 1.0
    }
  }]
}
```

若用户问“为什么系统又提 IELTS”，先看 trace 是否因 critical slot 选中 `mem_goal`，不要只猜 prompt。

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

例如把四个分量归一化为 `0.80 / 0.60 / 0.50 / 0.90`：

```text
0.45*0.80 + 0.25*0.60 + 0.20*0.50 + 0.10*0.90 = 0.70
```

比较技能时使用相同量纲；不能把 mastery 的 0–100 直接与 recency 的 0–1 相加。

### 12.2 题型分数

对 fix/fill/rewrite 分别计算：

- learning need
- 是否接近约 75 分的 productive difficulty
- under-sampled format exploration
- 多次尝试后的 reliability

冷启动时还使用技能类型先验。例如 grammar 更倾向从 `fix_sentence` 开始。

例如 learner 对 `fix_sentence` 已做 20 次且稳定高分，对 `rewrite_sentence` 只做 1 次。前者 reliability
高，后者 exploration 高；policy 会在“已知有效”和“收集不足题型的证据”之间权衡，而不是永远选历史
最高分题型。

### 12.3 为什么结果包含 breakdown 和 reason

推荐结果不仅返回一个题型，还返回 component scores、supporting memory IDs 和可读 reason。这样前端、测试和开发者能解释决策，也方便以后替换权重。

例如：

```json
{
  "decision": {
    "targetSkillCode": "grammar.article",
    "practiceType": "rewrite_sentence",
    "reason": "Article mastery is low and rewrite is under-sampled.",
    "supportingMemoryIds": ["mem_article"],
    "skillScores": [{
      "skillCode": "grammar.article",
      "score": 0.70,
      "breakdown": {
        "masteryNeed": 0.8,
        "errorNeed": 0.6,
        "failureNeed": 0.5,
        "staleness": 0.9
      }
    }],
    "practiceTypeScores": [{
      "practiceType": "rewrite_sentence",
      "breakdown": {
        "learningNeed": 0.55,
        "productiveDifficulty": 0.93,
        "exploration": 0.71,
        "reliability": 0.2
      }
    }]
  }
}
```

如果 UI 只显示最终题型，开发者无法区分“策略有意探索”与“排序 bug”。

### 12.4 混合 session 多样性（sessionSlot / sessionSize）

单次 `recommend_next_action` 总是合理的“下一题”；但 **四次并行调用如果都只看 top-1 skill**，生成模型会反复围绕同一错误指纹出题（真实线上曾出现四道都是专有名词大小写）。

因此 policy 版本演化到带 session 意识的分支（代码里 `hybrid-need-effectiveness-progression-v3-session-diverse`）：

```text
并行题 i = 0..sessionSize-1
  skill   <- 高 need 池中按 slot 轮换（可 exclude 已选 skill）
  type    <- fix / fill / rewrite 轮换（若用户未指定）
  stage   <- replay / variation / transfer 轮换（受证据上限约束）
  fingerprint <- 仅 slot0+replay 保留；其它题强制换 surface
```

学习时建议对照：

1. `apps/web/app/practice/page.tsx` 如何给每次 generate 传 slot/size。
2. `decision_service._pick_session_skill` 与 `_session_progression`。
3. `practice` route 如何把 diversity note 拼进生成 prompt。

这是“排序策略 + 批处理上下文”的典型工程问题：排序正确 ≠ 一批结果多样。

## 13. 前端代码怎么读

### 13.1 JavaScript 和 TypeScript 的最小语法

浏览器执行 JavaScript；TypeScript 在 JavaScript 上增加静态类型，构建时会被转换成浏览器能执行的代码。
`.ts` 通常是不含 JSX 的 TypeScript，`.tsx` 允许写 React JSX。

变量和容器：

```ts
const language = "en"                 // 不重新赋值
let attemptCount = 0                  // 之后可以重新赋值
const skills = ["article", "tense"]   // array
const profile = { level: "B1", streak: 3 } // object

attemptCount += 1
```

优先用 `const`。它表示变量名不能重新指向另一个值，不代表 object 内部永远不可变：

```ts
const profile = { level: "B1" }
profile.level = "B2" // JavaScript 允许，但 React state 不应这样直接修改
```

函数、array 变换和类型：

```ts
type Skill = {
  code: string
  mastery: number
  status?: "active" | "resolved"
}

function weakSkills(skills: Skill[]): Skill[] {
  return skills
    .filter((skill) => skill.mastery < 60)
    .sort((a, b) => a.mastery - b.mastery)
}
```

- `status?` 表示属性可缺失。
- `"active" | "resolved"` 是 union，只允许两个字符串。
- `Skill[]` 是 Skill array。
- 箭头函数 `(skill) => ...` 是把一个元素变成判断/结果的小函数。
- `filter` 保留条件为 true 的项，`map` 把每项转换，`sort` 排序。

TypeScript 只在开发/构建时帮助发现错误，不能替代运行时验证。后端可能返回未知 JSON，所以边界仍需要可靠
API 合同和错误处理。

### 13.2 Promise、`async`、`await` 和 `fetch`

网络结果不会立刻出现。Promise 可以理解为“未来会成功得到一个值，或失败给出一个 error”的对象：

```ts
async function loadProfile() {
  // 这是兼容路径参数；真正身份来自 cookie，后端会忽略这个单词。
  const response = await fetch("http://localhost:8000/api/v1/profile/ignored-by-server", {
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`Profile failed (${response.status})`)
  }

  return response.json()
}
```

`await` 暂停当前 async function，浏览器仍能处理点击和绘制。`fetch` 遇到 404/500 通常不会自动 throw；
因此必须检查 `response.ok`。连接被拒绝、DNS 失败等网络层错误才会直接 reject。

项目不要在每个页面复制这段逻辑。`lib/api-client.ts` 的 `apiFetch` 统一处理 base URL、cookie、语言、模型
header、429 提示与 FastAPI error body。普通 API 默认总时限是 20 秒；Diagnose、Chat、Plan、Practice、
Import、Input 和 Coach 等模型操作显式使用 110 秒，低于 Nginx 的 120 秒 read timeout。这里的浏览器总时限
从请求开始一直覆盖到 JSON/音频正文读取完毕，不会因先收到 response headers 或 StreamingResponse 每
10 秒收到空白 keepalive 而提前清除/重置。

### 13.3 JSX、component、props 和 event

React component 是返回 UI 描述的函数，名字以大写开头：

```tsx
type ScoreProps = {
  value: number
  label: string
}

function Score({ value, label }: ScoreProps) {
  return <p>{label}: {value}</p>
}
```

`<p>` 看起来像 HTML，但这是 JSX。差别包括：

- JavaScript 表达式放在 `{}` 中。
- CSS class 写 `className`。
- event 传函数，如 `onClick={submit}`，不能写成 `onClick={submit()}`，否则 render 时就执行。
- component 用 `<Score value={88} label="Score" />`，输入叫 props。

列表需要稳定 key：

```tsx
{errors.map((item) => (
  <article key={item.errorId}>{item.explanation}</article>
))}
```

key 帮 React 在下一次 render 识别“哪一项还是同一项”。不要用每次 render 都变化的随机数。

### 13.4 state、render 和受控输入

普通局部变量变化不会通知 React 重画；state 会：

```tsx
const [text, setText] = useState("")
const [loading, setLoading] = useState(false)

return (
  <textarea
    value={text}
    onChange={(event) => setText(event.target.value)}
  />
)
```

`useState("")` 返回当前值和 setter。输入框的显示值来自 state，输入事件又更新 state，这叫**受控输入**。
setter 会安排下一次 render，不会立即改变当前函数中已经读取的变量。

更新 object/array state 时创建新值：

```ts
setProfile((current) => ({ ...current, level: "B2" }))
setMessages((current) => [...current, newMessage])
```

不要 `profile.level = "B2"; setProfile(profile)`。对象引用没变时，React 可能无法正确判断更新，而且旧 state
也被偷偷修改。

一个请求至少要区分四种 UI 状态：

```text
idle    尚未请求
loading 正在等待，按钮应防重复提交
success 有数据
error   请求失败，可读原因和 retry
```

“空数据”与“加载中”也不同。空白页面无法告诉用户是没有记录、仍在等，还是代码崩了。

### 13.5 effect：什么时候可以在 render 之外做事

effect 用来把组件与外部系统同步，例如初次加载 API、订阅事件或计时器：

```tsx
const [serverModels, setServerModels] = useState<ServerModel[]>([])
const [error, setError] = useState("")

useEffect(() => {
  let cancelled = false

  getServerLLMModels()
    .then((models) => {
      if (!cancelled) setServerModels(models)
    })
    .catch((value) => {
      if (!cancelled) setError(String(value))
    })

  return () => {
    cancelled = true
  }
}, [])
```

空依赖 array `[]` 表示挂载后运行一次；`[userId]` 表示 `userId` 改变时重跑。cleanup 在卸载或重跑前执行，
可取消 subscription/timer 或忽略晚到结果。缺少依赖会读到旧值；把每次 render 都新建的 object 放进依赖则
可能导致重复请求。

不是所有计算都需要 effect。`const total = items.length` 可以直接在 render 中计算；点击提交应放 event
handler，而不是“先改一个 flag，再用 effect 猜用户是不是点了按钮”。

### 13.6 Next.js App Router、Server 与 Client Component

`apps/web/app/<path>/page.tsx` 决定 URL。默认 component 可以在 Next.js server 侧 render；文件顶部写
`"use client"` 后，它进入客户端边界，才可使用 state、effect、event、localStorage、麦克风等浏览器 API。

`"use client"` 不表示整个文件只在浏览器下载前从不经过服务器 render，也不允许你把后端 secret 放进去。
所有进入 client bundle 的代码和 `NEXT_PUBLIC_` 配置都应视为公开。

当前页面地图：

| URL | 页面作用 | 主要后端/状态边界 |
| --- | --- | --- |
| `/` | 写作诊断入口 | diagnose → report → Session Win |
| `/dashboard` | Profile 与技能总览 | profile/skills |
| `/history` | 完整诊断历史与删除 | history pagination/delete |
| `/notebook` | 笔记筛选、导出、删除 | notes |
| `/plan` | 读取/生成 7 天计划 | plan |
| `/plan/practice` | 按计划任务练习 | URL task + practice |
| `/practice` | 自适应独立练习 | decision/generate/submit |
| `/chat` | 文字与 Realtime 对话 | chat sessions/messages/voice |
| `/coach` | 五类任务与 Today’s Mission | mission/diagnose/chat/TTS |
| `/vocabulary` | 情境词汇输入与复习 | provisional vocabulary evidence |
| `/memory` | 长期记忆管理与 recall trace | memory CRUD/retrieve/decision |
| `/input` | 输入材料学习 | input learning sources |
| `/input/experimental` | owner-only Input Lab 2 | owner session + browser speech |
| `/import` | ChatGPT 导出导入 | browser parse/chunk + import API |
| `/stats` | Daily Wins 统计 | timezone + daily stats |
| `/login` | GitHub/Google 登录入口 | OAuth redirect/callback cookie |
| `/admin` | owner 管理 access roles | owner authorization |

路由路径和后端 API path 不一定同名。例如 `/` 页面调用 `/api/v1/diagnose`；不要只凭 URL 猜数据链。

### 13.7 `components/`、`lib/` 和一次完整结束路径

- `components/`：可复用 UI 与业务组件，不拥有后端数据真相。
- `lib/api-client.ts`：浏览器统一后端入口，包含 practice 的 `sessionSlot/sessionSize`。
- `lib/types.ts`：浏览器侧合同；应与 Pydantic 保持一致。
- `lib/i18n.ts`：中英文文案。
- `lib/llm-settings.ts`：安全 server model 选择与浏览器 BYOK。
- `lib/session-win.ts`：从现有结果派生本地 Session Win/welcome-back。

读前端时选择一条纵向路径：

```text
DiagnosticInput onSubmit
  -> DiagnoseProvider / api-client.diagnose
  -> HTTP response
  -> DiagnosticReport
  -> sessionWinFromDiagnose(result)
  -> <SessionWin />
  -> markSessionWin("diagnose")
```

用编辑器的 “Go to definition / Find references” 从函数名跳转。先分清数据是在 props、state、context、
localStorage 还是后端数据库中；它们的生命周期完全不同。

### 13.8 环境变量何时生效

`NEXT_PUBLIC_API_BASE_URL` 会在 Next.js build 时编译进浏览器 bundle。修改 Vercel 环境变量后必须 redeploy。

任何 `NEXT_PUBLIC_` 变量都可被用户看到，所以绝不能放服务器 secret。特别是不要在 Vercel 设置 `NEXT_PUBLIC_OWNER_BYPASS_TOKEN`。

例如 bundle 在周一用 `NEXT_PUBLIC_API_BASE_URL=https://old-api.example` 构建，周二只修改 Vercel 环境变量
但不重新部署，浏览器仍请求旧地址。相反，后端容器读取 `.env` 是进程启动时行为；修改后需要重启容器，
不需要重新编译前端。

### 13.9 第一次前端修改实验

在 disposable branch 上按难度递增做四步：

1. 找到 `components/diagnostic-input.tsx` 的按钮文案，只改一个可见词。
2. 在 textarea 附近显示 `text.length`，观察每次输入触发 render。
3. 临时把本地 API base 指向 `http://localhost:8999`，提交后在 Network 观察
   `ERR_CONNECTION_REFUSED` 与 error UI。
4. 恢复 8000，故意提交过短输入，在 Network 区分前端按钮阻止与后端 422。

完成标准不是“页面能打开”，而是你能回答：

```text
哪一次变化只在浏览器？
哪一次真的发了 HTTP？
loading 由哪个 state 控制？
error 是网络异常、4xx 还是 5xx？
怎样从 git diff 确认只留下预期改动？
```

## 14. 推荐的本地学习环境

### 14.1 准备工具：先会检查，再谈安装

本章的命令以 macOS/Linux/WSL 的 shell 为例。Windows 初学者建议使用 WSL，避免同时学习 PowerShell、
CMD 和 POSIX 三套语法。先从仓库根目录运行：

```bash
pwd
git --version
node --version
pnpm --version
uv --version
```

本项目当前学习环境的可复现基线：

| 工具 | 项目需要 | 为什么 |
| --- | --- | --- |
| Git | 当前稳定版 | 取得代码、branch、diff、commit |
| Node.js | 24 LTS | 执行 Next.js 工具链 |
| pnpm | 9.6.0 | 与 `apps/web/package.json` 的 `packageManager` 一致 |
| uv | 当前稳定版 | 安装/运行 Python 3.11 后端 |
| 纯文本代码编辑器 | VS Code 等 | 打开项目文件夹、新建目录/文件、保存源码 |

`uv sync` 会根据 `apps/api/.python-version` 和 lockfile 管理 Python 3.11，所以不必另外用系统 `pip` 污染全局
环境。安装方法随平台变化，应使用官方页面：

- [Git downloads](https://git-scm.com/downloads/)
- [Node.js downloads](https://nodejs.org/en/download)
- [pnpm installation](https://pnpm.io/installation)
- [uv installation](https://docs.astral.sh/uv/getting-started/installation/)
- [Visual Studio Code download](https://code.visualstudio.com/download)（也可以使用你熟悉的其他纯文本编辑器）

在编辑器中选择 “Open Folder / 打开文件夹”，选仓库根目录；左侧文件树可以右键新建 folder 和 file。
编辑器不是 Word：源码必须保存为纯文本，文件名和扩展名（如 `page.tsx`、`models.py`）都要完全一致。

若已有 Node 24，可启用项目要求的 pnpm：

```bash
corepack enable
corepack prepare pnpm@9.6.0 --activate
pnpm --version
```

预期最后一行以 `9.6.0` 开头。若看到 `command not found`，说明 shell 在 `PATH` 中找不到工具；先完成对应
官方安装并重新打开终端，不要继续执行后面的项目命令。

### 14.2 取得代码、认识 Git，并建立安全练习 branch

还没有仓库时：

```bash
git clone https://github.com/jinyu-cai/weakspot-english-coach.git
cd weakspot-english-coach
```

已经在仓库里时不要重复 clone。用这三条确认位置和状态：

```bash
pwd
git status --short --branch
git remote -v
```

Git 的最小心智模型：

```text
working tree：电脑上正在编辑的文件
stage：明确选中准备放进下一次 commit 的变化
commit：有 ID、作者和说明的一次本地快照
branch：指向一串 commit 的可移动名字
push：把本地 branch 发送到远端
PR：让别人审查并决定是否 merge
```

如果 `git status --short` 没有文件行，建立练习 branch：

```bash
git switch -c learning/first-lab
```

如果已经显示 `M` 或 `??`，这些是现有未提交工作；不要为了跟教程运行 `reset --hard` 或随意 restore。先在
新 clone 中练习，或请项目维护者确认怎样保存。每次修改后：

```bash
git diff
git status --short
```

只添加自己确认的文件：

```bash
git add path/to/file
git diff --staged
git commit -m "docs: complete first learning lab"
```

本地学习不要求 push。只有测试通过且准备协作时才 push/开 PR；不要把 `.env`、key、下载数据或无关工作区
变化一起 stage。

### 14.3 第一次运行：后端不用任何真实 key

终端 A 从仓库根目录运行：

```bash
cd apps/api
uv sync
DYNAMODB_ENDPOINT_URL= OPENAI_API_KEY= QWEN_TTS_API_KEY= \
QWEN_MODEL_STUDIO_API_KEY= QWEN_EMBEDDING_API_KEY= \
uv run python -m scripts.dev_server
```

若本机已有真实 `.env`，上面的显式空值可避免这次学习误用 DynamoDB Local 地址或付费语音 key。脚本会：

- 用 moto 在进程内模拟 AWS。
- 自动创建 DynamoDB table。
- 使用 `fake_ai.py` 返回固定结构。
- 在 `127.0.0.1:8000` 启动 FastAPI。
- 进程停止后清空数据。

保持终端 A 运行。新开终端 B，再从仓库根目录运行：

```bash
cd apps/web
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev
```

看到 Ready 后打开：

```text
前端：http://localhost:3000
后端 health：http://localhost:8000/api/v1/health
Swagger：http://localhost:8000/docs
```

在首页输入至少 5 个单词，例如 `Yesterday I go to school today.`，点击 Analyze。完成标准：

```text
页面出现诊断结果
Network 中 POST /api/v1/diagnose 返回 200
终端 A 出现对应请求日志
刷新后端 health 仍为 200
```

若 `apps/web/.env.local` 指向生产 API，命令行值会覆盖它。只查看纯前端 mock 时用
`NEXT_PUBLIC_API_BASE_URL= pnpm dev`；Speech 不可用、Coach 使用浏览器语音回退是预期行为。

**不要把仓库里的 `.env.example` 原样当成可用 AWS 凭证。** 无效 access key 会让真实 boto3 客户端在诊断路径上 500。本地学习应优先 `scripts.dev_server`（moto + fake AI），它会在进程内模拟 DynamoDB，不依赖真实 AWS。若你自己起了 uvicorn 并加载了坏的 `.env`，现象往往是：前端输入框正常，一点 Analyze 就失败。

完成实验后在两个终端分别按 `Ctrl+C`。再次打开 health 应连接失败，这正好证明服务只是本地进程。依赖和
代码不会被删除；moto 的临时数据会清空。

### 14.4 用 Swagger 逐个实验

打开 `http://localhost:8000/docs`，建议按顺序：

1. `GET /api/v1/health`
2. `GET /api/v1/llm/models`
3. `POST /api/v1/diagnose`
4. `GET /api/v1/profile/{user_id}`
5. 展开但先不 Execute `POST /api/v1/memory`
6. 展开但先不 Execute `POST /api/v1/memory/retrieve`
7. 查看 `GET /api/v1/memory/traces` response schema
8. 查看 `GET /api/v1/memory/next-action` response schema
9. `POST /api/v1/coach/missions`，只 Execute 一种 `preferredType`

前四项和一种 Coach 可以 Execute；guest 对每个生成 feature 的日额度是 3，另外四种 Coach 合同用
`scripts.coach_contract_test` 一次性验证，不要在这里连续调用五次。Memory 的完整创建/检索留给 14.5.1，
因为它正好需要两次创建和一次检索。若这里先消耗额度，后面的教学闭环会提前得到 429。每看一步，回到
route 找 decorator，再顺着 import 跟到 service/repository。

`POST /api/v1/coach/speech` 返回二进制音频（当前 Qwen 通常返回 WAV），不是 JSON，而且配置真实 key 时会调用付费服务；先用 `coach_contract_test` 理解合同，再决定是否做 live probe。`/coach/input-lab-2/transcript-missions` 需要真实 owner session，Swagger 中伪造 `userId` 不会获得 owner 权限。

建议每一步都先写下预期，再点击 Execute：

| 实验 | 预期 |
| --- | --- |
| `GET /api/v1/health` | 200 且 `status="ok"` |
| diagnose 的 text 少于最小长度 | 422，模型不会被调用 |
| guest 超过额度 | 429 |
| 非 owner 调 Input Lab 2 | 403 |
| 未配置 Qwen TTS 调 speech | 503，并由前端回退 |

状态码与预期不同才开始查日志；只看页面 toast 会丢失最关键的边界信息。

### 14.5 用 curl 保持同一个 guest 身份

curl 不会像浏览器那样默认保存 cookie。用 cookie jar 让多次请求属于同一个 guest：

```bash
curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  http://localhost:8000/api/v1/auth/me
```

```bash
curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  -X POST http://localhost:8000/api/v1/diagnose \
  -H 'Content-Type: application/json' \
  -d '{
    "userId":"demo-user-001",
    "text":"Yesterday I go to the library and I meet my friend.",
    "diagnosisMode":"fast",
    "outputLanguage":"zh-CN"
  }'
```

`-i` 显示 status/headers，`-c` 保存响应 cookie，`-b` 发送已有 cookie。body 的 `userId` 仍是请求 schema 的
必填字段，但后端会用 cookie 解析出的真实 guest identity 覆盖它，防止冒充。

继续用同一 jar 查看这个 guest 的 profile；path 中的占位值也不会越过服务端身份：

```bash
curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  http://localhost:8000/api/v1/profile/ignored-by-server
```

删除 `/tmp/weakspot-cookie.txt` 会丢掉这个 curl guest 身份；moto 进程停止后数据也会清空。

生成一个指定类型的 Coach 任务：

```bash
curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  -X POST http://localhost:8000/api/v1/coach/missions \
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

#### 14.5.1 四条核心纵向实验：Memory、Plan、Practice、Chat

下面在 Swagger 中完成，浏览器会自动沿用同一个 `guest_id` cookie；若改用 curl，必须继续带前面的
`-c/-b /tmp/weakspot-cookie.txt`。每次先预测，再 Execute，并在 response 中复制下一步需要的 ID。
若你已经在 14.4 提前执行过 Memory 写入/检索，先在终端 A 按 `Ctrl+C`，重新运行
`uv run python -m scripts.dev_server` 取得一张全新的 moto 临时表，再开始本实验；curl cookie 与浏览器
cookie 是两个身份，不会互相消耗额度。

**Memory：创建 → 检索 → 决策**

`POST /api/v1/memory`：

```json
{
  "kind": "preference",
  "canonicalKey": "preference.feedback_style",
  "content": "The learner prefers concise feedback with one example.",
  "evidence": "Please keep feedback short and show one example.",
  "confidence": 0.95,
  "importance": 0.85,
  "pinned": false
}
```

预期 200，`memory.status="active"`、`memory.sourceType="manual"`，并得到 `memory.id`。再用同一 endpoint
创建一条主题不同的对照项：

```json
{
  "kind": "goal",
  "canonicalKey": "goal.ielts_speaking",
  "content": "The learner wants to improve IELTS speaking fluency.",
  "evidence": "I am preparing for IELTS speaking.",
  "confidence": 0.95,
  "importance": 0.9,
  "pinned": false
}
```

这两条让你能观察“数据库里有”与“这次 query 应选”不是一回事。接着
`POST /api/v1/memory/retrieve`：

```json
{"query":"How should feedback be formatted?","tokenBudget":700,"limit":6}
```

预期 feedback preference 的相关分数/排序高于无关 IELTS goal（goal 仍可能因 critical slot 被保留），且
`estimatedTokens <= effectiveTokenBudget <= tokenBudget`。在 `memoryPack.items` 与
`GET /api/v1/memory/traces` 对比两个 ID、最终排名、slot 和 score breakdown，不要只看自然语言结果；
`GET /api/v1/memory/next-action` 返回 `decision`。把
`tokenBudget` 改成 20 应在 service 前得到 422，因为合同最小值是 100。

**Plan：从已有 evidence 生成固定形状**

`POST /api/v1/plan`：

```json
{"userId":"ignored","errorScope":"weekly","outputLanguage":"zh-CN"}
```

预期 `plan.days` 恰好 7 天、每天 2 个 task、每个 task 3 道 exercise；`progress.totalTasks=14`，初始
`completedTasks=0`。把 `errorScope` 改成 `"forever"` 应得到 422。`"all"` 也不是无限 history，而是跨
全时间范围取最近的有界样本。

**Practice：生成 → 提交 → 观察 skill 副作用**

先调用 `POST /api/v1/practice/generate`：

```json
{
  "userId": "ignored",
  "targetSkillCode": "grammar.verb_tense",
  "practiceType": "fix_sentence",
  "outputLanguage": "zh-CN"
}
```

预期 `exercise.id`、`activityRunId`、`question`、`answer` 和 `targetSkillCode`。复制真实
`exercise.id`，再调用 `POST /api/v1/practice/submit`：

```json
{
  "userId": "ignored",
  "exerciseId": "把这里替换成上一步的 exercise.id",
  "userAnswer": "Yesterday I went to school.",
  "outputLanguage": "zh-CN",
  "clientAttemptId": "lab-attempt-0001"
}
```

预期 response 同时有 `grade`、`attempt`、`updatedSkill` 和 `learningEvidence`。重复完全相同的
`clientAttemptId + body` 应重放同一结果，不重复增加 mastery；同 ID 换答案应得到 409
`practice_attempt_conflict`。使用不存在的 `exerciseId` 应得到 404。

**Chat：创建 session → 发送一轮 → 读取持久化消息**

`POST /api/v1/chat/sessions`：

```json
{"userId":"ignored","topic":"Ordering coffee politely","textModelMode":"fast"}
```

复制 `session.id`，再调用 `POST /api/v1/chat/send`：

```json
{
  "userId": "ignored",
  "sessionId": "把这里替换成 session.id",
  "text": "Could I have a coffee, please?",
  "clientMessageId": "lab-message-0001"
}
```

预期同时返回 `userMessage`、`assistantMessage`、`memoryRecall` 和 `duplicate=false`；随后
`GET /api/v1/chat/sessions/{session_id}/messages` 应看到原子保存的一对消息。重新提交完全相同的 ID 与
text 会得到已保存的一轮且 `duplicate=true`。若 guest 配额让后续请求先返回 429，停止并重启 moto 学习
服务或清除 cookie 后只重做这一小实验，不要把 429 误判成 Chat 合同失败。

这四个实验分别证明：

```text
Memory   -> 手动事实、检索预算、trace
Plan     -> 有界历史进入固定 7×2×3 合同
Practice -> exercise、幂等 attempt、skill/evidence 副作用
Chat     -> session、原子双消息、clientMessageId 重放
```

### 14.6 系统调试顺序：先定位在哪一层

不要一看到失败就换网络、重装依赖或更换模型。按从近到远的顺序：

| 现象 | 先看 | 常见原因 | 最小验证 |
| --- | --- | --- | --- |
| `command not found` | 当前终端 | 工具没装/PATH 未刷新 | `tool --version` |
| `No such file` | `pwd`、`ls` | cwd 错了 | 回仓库根再 `cd` |
| `address already in use` | 启动日志 | 3000/8000 已有进程 | 打开对应 health/page |
| `ERR_CONNECTION_REFUSED` | Network URL | 服务没启动/端口错 | 直接打开 health |
| 浏览器 CORS error | Console + response headers | origin 未 allow | curl 成功不代表浏览器可读 |
| 422 | Network Response | 字段/类型/长度不符 | 对照 Swagger schema |
| 401/403 | cookie、身份 endpoint | 未登录/非 owner | `GET /auth/me` |
| 429 | response detail | guest quota/rate limit | 等待或合法登录，不盲重试 |
| 500 | 后端 traceback/request ID | 未处理异常 | 从 traceback 最底部异常开始 |
| 502/503/504 | 后端日志和 provider 时间 | 上游失败/未配置/超时 | fake 路径与 live probe 分开 |
| 页面白屏 | Console 第一条红错 | render/import/runtime error | 刷新并保留 Console |

Python traceback 从最底下一行先读异常类型和信息，再向上找第一个属于本仓库的文件/行；不要从框架最上层
开始猜。修复后重复完全相同的输入，确认错误真的消失，再加自动测试防止回归。

“请求在固定时间后失败”的具体排查：

```text
Network 没有 request         -> 前端 event/validation
立即 connection refused     -> 本地服务/URL/端口
有 4xx response             -> 合同、身份、额度
普通 API 约 20 秒 AbortError -> 默认浏览器总时限
模型 API 约 110 秒 AbortError -> LLM 浏览器总时限
后端更早返回 502/503/504    -> provider 配置、上游 timeout
后端完成但浏览器超时        -> 两侧 timeout budget 不一致
```

Diagnose 过去曾漏传模型时限而在 20 秒被浏览器终止；旧 helper 还曾在只收到 headers 时过早清 timer。
现在 Diagnose 与 Coach Speech 显式使用 `LLM_OPERATION_TIMEOUT_MS`，总 deadline 一直覆盖正文消费；
`pnpm test:timeouts` 用“headers 立即到、body 延迟”的假 response 防止两类回归。先记录 path、status、
耗时和 request ID，才有足够证据判断是否真是网络问题。

### 14.7 再切换到真实服务

只有理解 fake 路径后，才能把真实服务当作**单独的云运维实验**。下面命令不是“复制就安全”的教程：
`.env.example` 含占位值，`create_table` 可能访问当前 AWS 账户并产生资源/费用。执行前必须逐项确认：

```text
没有任何 your_* / placeholder 值
明确选择真实 AWS 或本地 DynamoDB，不能混用
知道当前 AWS account、region、table name 和 IAM 权限
provider key 已设置费用/额度限制且只存在后端
知道怎样删除测试资源或回滚配置
```

零基础阶段到此停止，继续使用 moto/fake 即可。准备真实部署时先读
`docs/ALIBABA_QWEN_DEPLOYMENT.md` 和 `apps/api/README.md`，由有权限的人确认账户后再运行：

```bash
cd apps/api
cp .env.example .env
# 先用编辑器逐项填写并完成上面的 preflight
uv run python -m scripts.create_table
uv run uvicorn app.main:app --reload --port 8000
```

不要提交 `.env`。

若只想在 moto/fake text AI 环境试听真实 TTS，可以保留 `USE_FAKE_AI=true`，只在后端进程环境中配置
`QWEN_TTS_API_KEY`；也可以按生产逻辑复用 `QWEN_MODEL_STUDIO_API_KEY` 或
`QWEN_EMBEDDING_API_KEY`。不要使用任何 `NEXT_PUBLIC_*_API_KEY`，也不要把 key 写进前端
`.env.local`。文字生成、Qwen TTS 和 OpenAI Realtime 是三条独立调用路径。

切换真实服务前先估计成本和失败半径，只做一条有界 probe；不要用完整 benchmark 或循环测试真实付费模型。
probe 后检查 key 没出现在 Network、日志、shell history 截图和 `git diff` 中。真实 provider 成功只能证明
那一次调用可用，不能代替 fake/moto 的确定性业务测试。

## 15. 测试应该怎样理解

测试不是“运行一下没有报错”，而是准备确定输入、执行一个边界、对可观察结果做断言。先分层：

| 层级 | 速度/范围 | 证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| unit | 最快，一个纯函数/小对象 | 公式、分支、边界 | HTTP、真实依赖 |
| contract | 一个上下游接口 | schema、长度、variant 一致 | 完整用户流程 |
| integration | 多层 + fake/moto | route/service/repository 副作用 | 真实 provider/公网 |
| end-to-end | 浏览器到已部署系统 | 用户关键路径 | 所有异常组合 |
| live probe | 一个真实外部依赖 | 当下 provider/配置可用 | 长期稳定和全部业务 |

- **fixture**：测试前准备的固定状态。
- **fake**：实现同一接口但返回确定数据的替身。
- **mock**：记录调用或按测试指定返回的可控替身。
- **moto**：在测试进程中模拟 AWS/DynamoDB 行为的库。

下面只是说明 Arrange / Act / Assert 的**概念片段**，`client` 和 fake/moto fixture 由真实测试模块创建，不能
单独复制运行：

```py
# Arrange：准备一个短文本和 fake/moto 状态
payload = {
    "userId": "demo-user-001",
    "text": "Yesterday I go to school.",
    "outputLanguage": "en",
}

# Act：调用真正的 HTTP 边界
response = client.post("/api/v1/diagnose", json=payload)

# Assert：成功结果与持久化副作用都符合合同
assert response.status_code == 200
assert response.json()["diagnostic"]["errors"][0]["code"] == "grammar.verb_tense"
```

只断言 status 200 不足以证明业务正确；只调用 service 也不足以证明 route、身份和 JSON 合同正确。
真实 `DiagnoseRequest` 的 `userId` 是必填字段，尽管 route 最终会用服务端 identity 覆盖它；若示例漏掉，
Pydantic 应正确返回 422。

| 命令 | 证明什么 |
| --- | --- |
| `uv run python -m scripts.smoke_test` | import、route、schema 和基础规则没有坏 |
| `uv run python -m scripts.integration_test` | diagnose → profile → plan → practice → auth/chat 的完整环 |
| `uv run python -m scripts.coach_contract_test` | 五类 mission schema、场景去重、context 证据边界、TTS 合同和 owner 403 |
| `uv run python -m scripts.contract_boundary_test` | 上下游长度差异、确定性裁剪和跨层合同 |
| `uv run python -m scripts.storage_contract_test` | DynamoDB item 大小、存储错误映射和分页边界 |
| `uv run python -m scripts.dedup_test` | 同文本/同 context 去重、不同 context 可记录迁移、History 手动删除回滚 |
| `uv run python -m scripts.diagnosis_claim_test` | 并发/重试 Diagnose 只能完成一次副作用 |
| `uv run python -m scripts.single_sentence_evidence_test` | grounded quote、显式 success、verification 状态和最近窗口 |
| `uv run python -m scripts.learning_loop_test` | evidence 更新、掌握度与学习状态迁移 |
| `uv run python -m scripts.plan_lifecycle_test` | 计划生成、任务状态和固定数量/长度边界 |
| `uv run python -m scripts.memory_agent_test` | merge、conflict、expiry、API、decision 和来源撤销 |
| `uv run python -m scripts.stealth_input_test` | 隐式练习 opportunity gate、并发/幂等、Input Learning 200+ cursor 历史 |
| `uv run python -m scripts.input_output_test` | retell、必要复用、延迟检索和重试去重 |
| `uv run python -m scripts.memory_benchmark` | Recall@6、陈旧抑制、token budget 和上下文缩减 |
| `pnpm lint` | React/TypeScript 常见代码问题 |
| `pnpm exec tsc --noEmit` | 独立 TypeScript 类型检查 |
| `pnpm test:chat-import` | Chat Import 保序分段并满足 120 条消息、20 个会话和 UTF-8 字节上限 |
| `pnpm test:timeouts` | 普通/模型调用点保持 20/110 秒，且 headers 后的慢正文仍受总 deadline 约束 |
| `pnpm build` | Next.js 生产构建和所有 route 生成 |

后端测试通常用 moto + fake AI，所以不等于“真实 Qwen 一定可用”；生产还需要少量 live probe。

完整 integration fixture 会创建 26 条 History submission 和 57 条 Notebook note，专门防止旧的 20/50 显示上限回归。这里验证的是“repository 读完所有 DynamoDB 页 + API 返回完整集合”，不是一次请求向数据库索取无限大单页。

`next.config.mjs` 当前允许 build 跳过 TypeScript error，因此不能只看 `pnpm build`，必须独立运行 `pnpm exec tsc --noEmit`。
当前前端没有 Vitest/Jest/Playwright 浏览器测试；lint、type check、Import/timeout 回归和 build 不能证明
真实点击、hook 生命周期、localStorage 恢复、键盘/屏幕阅读器或 Network 行为。第 13.9 节的人工实验因此
仍是发布前必需验证，不应把“build 绿了”写成“UI 全部正确”。

### 15.1 怎样运行最小测试，而不是一上来跑全部

先确定 cwd：

```bash
cd apps/api
uv run python -m scripts.smoke_test
```

成功应以脚本自己的 passed/OK 信息和 exit code 0 结束。再运行与改动最接近的合同测试，最后才跑 integration。
前端从 `apps/web`：

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test:chat-import
pnpm test:timeouts
pnpm build
```

没有文字输出不一定失败；shell exit code 0 才表示命令成功。前一个命令失败时不要继续用后一个 build 的结果
覆盖它。

### 15.2 怎样读一次失败

典型 pytest/assertion failure：

```text
E   AssertionError: assert 422 == 200
E    +  where 422 = response.status_code
apps/api/test_api.py:18: AssertionError
```

阅读顺序：

1. 最下面找本仓库文件和行号：`test_api.py:18`。
2. 看期望 `200` 与实际 `422`，不要只看 `AssertionError`。
3. 打印/检查 `response.json()`，422 的 `detail` 会指出缺哪个字段或长度错误。
4. 判断测试输入错了，还是产品合同变了；不能为了“绿”就把期望随意改成 422。
5. 用最小修复重复同一测试，再跑相邻测试。

### 15.3 Red → Green → Refactor 小练习

以第 23 章的 `status_for(score)` 或最小 diagnose 为例：

```text
Red：先写“短文本返回 422”的测试，确认它在没有约束时失败
Green：加入 Field/validator，让测试通过
Refactor：只整理重复代码，不改变行为
```

每一步都看 diff。若测试从来没红过，它可能没有覆盖你以为的代码；若 refactor 后只跑成功路径，失败边界
可能已经悄悄损坏。测试的价值是提供可重复证据，不是追求一个漂亮的绿色数字。

## 16. 部署架构和工程含义

### 16.1 先理解 build、image、container、proxy、DNS 和 TLS

本地 `pnpm dev`/Uvicorn 适合开发；部署是把可复现产物放到持续运行的环境并让公网安全访问。

| 术语 | 普通语言 |
| --- | --- |
| build | 把源码和依赖转换成可运行产物 |
| Docker image | 只读的应用文件系统/启动说明模板 |
| container | image 的一次运行实例 |
| volume | 独立于 container 生命周期的持久数据 |
| Compose | 用配置协调 image、container、port、env |
| reverse proxy | Nginx 接公网请求，再转发给本机 FastAPI |
| DNS | 把域名指向入口地址 |
| TLS/HTTPS | 加密并验证客户端到域名的连接 |
| Cloudflare origin | 稳定域名背后当前实际接流量的源站 |
| Git SHA | 精确标识部署了哪次 commit |
| rollback | 新版有问题时恢复已知可用版本 |

生产中 FastAPI 只绑定 `127.0.0.1:8000`，让 Nginx 负责公网 443、TLS 和转发。这样数据库/API key 不因
容器端口直接暴露而失去边界。

一个安全的本地 Docker 学习实验只用示例配置：

```bash
cd apps/api
docker compose config
```

它先展开配置供检查；不要在不理解 `.env`、volume 和目标主机时直接复制生产部署命令。查看 container
日志与 health 是验证，日志中也不能打印 secret。

### 16.2 前端

- Vercel Root Directory 是 `apps/web`。
- `main` 更新触发生产部署。
- `NEXT_PUBLIC_API_BASE_URL` 在 build 时固定。

例如合并 `main@48c322b` 后，Vercel 构建产物应能追溯到同一 commit。若域名返回 200 但 deployment
仍指向旧 SHA，只能证明旧页面存活，不能证明新功能已经上线。

### 16.3 后端

- FastAPI 在 Docker 中运行。
- 端口 8000 只绑定本机。
- Nginx 提供公网 443/TLS 并反向代理。
- `deploy/start_backend.sh` build image、幂等建表/启用 TTL、重建容器并健康检查。
- `OPENAI_API_KEY` 可供 OpenAI Realtime 使用，也可作为自适应规划器专用 key 未设置时的后备。
- Coach Speech 使用 Qwen key；TTS 的 base URL、model、voice 和 language 可以独立覆盖。

一次可回滚部署的最小证据链是：

```text
记录目标 Git SHA
  -> 备份现有代码（不打印 .env）
  -> 部署同一 SHA
  -> 重建容器和幂等建表
  -> /api/v1/health = 200
  -> 安全模型目录符合预期
  -> 一次有界功能 probe
  -> 保留回滚包
```

只看到 `docker compose up` 没报错不够；容器可能正在重启，Nginx 也可能仍代理旧进程。

### 16.4 当前双后端

- Oracle Cloud：日常生产源站；安全模型目录当前提供 DeepSeek deep/fast，语义检索使用 Qwen
  `text-embedding-v4`，Coach Speech 使用 Qwen3-TTS-Flash。embedding 不可用时才退化为 lexical
  similarity。
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
| 修改混合练习多样性 | `decision_service.py`（slot/size）、`routes/practice.py`、`practice/page.tsx`、`api-client.ts` |
| 修改 DynamoDB 查询 | `db/keys.py`、`db/repositories.py` |
| 修改 mastery | `core/mastery.py` |
| 修改前端 API | `apps/web/lib/api-client.ts`、`types.ts` |
| 修改页面 | `apps/web/app/.../page.tsx` 和相关 component |
| 修改 Session Win / welcome-back | `lib/session-win.ts`、`components/session-win.tsx`、各闭环 page、`i18n.ts` |
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

例如两个请求都读到 `observationCount=4`，各自计算并写入 5，最终应有的 6 被覆盖成 5。这叫 lost
update；条件写可以要求“只有数据库仍是 4 时才成功”，失败方重新读取再重试。

### 18.2 Token 是估算值

Memory Pack 使用轻量字符估算器，不是 Qwen 官方 tokenizer。它适合控制上界和回归测试，但 benchmark 不应被描述成大规模精确 token 研究。

例如估算器报告 680 tokens 不代表 provider 一定也计算为 680；安全比例 0.85 的目的，就是给 tokenizer
差异留下余量，而不是宣称估算完全精确。

### 18.3 Benchmark 数据量较小

当前 secret-free lexical fixture 的 Recall@6 是 0.80（5 个 case 命中 4 个），适合做最低防回归线，
不等于真实用户大样本评估。它会明确打印没有命中的 article weakness 和实际选择项；进一步应加入匿名真实
query、人工 relevance label、live embedding 对照和线上指标。

反例：即使少量人工 fixture 全部命中得到 1.00，也不能推出 10,000 个真实用户 query 有 100% recall。

### 18.4 忘记是业务立即、物理稍后

API forget 后不会再召回，但 DynamoDB 行通过 TTL 稍后物理删除。产品隐私文案需要准确说明这一点。

例如验证 forget 时，应先调用 retrieve 证明该项立即消失，再把控制台物理删除看作异步清理；两者顺序不能反过来。

### 18.5 同步 SDK 和 async server

项目通过线程池隔离部分阻塞工作。进一步可以学习 async HTTP client、aioboto3 的收益与复杂度，不要为了“全 async”盲目改写。

例如单个 boto3 调用只要 20 ms，改写整层的收益可能很小；如果外部模型调用持续 60 秒且占满线程池，
才需要用延迟、并发数和线程数数据评估 async client 或队列。

### 18.6 Coach P0 仍有意保留的边界

- 普通 Coach mission scaffold 不持久化；真正的诊断和 Chat 证据会持久化。
- picture story 只诊断用户英文，不根据图片事实自动判定内容正确性；未来需要版本化 fact pack 和置信度策略。
- guided scene 的 `hintLevel` 会进入 session analysis；非场景 free response 当前只在 UI 显示 assisted，Diagnose persistence 尚未保存提示强度。
- Input Lab 2.0 当前不抓 URL、不保存 transcript capture，并使用浏览器语音；它仍是 owner pilot，不应写成已完成的公共内容平台。
- 单次 `vocab.word_choice` 只是 provisional observation；更可靠的弱点结论需要多情境、可复查证据。

例如 picture story 中用户写 “A dog is under the table.”，当前系统可以诊断冠词和介词是否自然，
却不能宣称图片里确实有一只狗，除非未来增加版本化视觉事实包和相应证据合同。

### 18.7 Session Win 有意做成纯前端

- 第一版只解决“这一次结束后的即时动机”，不引入新表、新 API、新限流。
- welcome-back 依赖浏览器 localStorage，**不跨设备、不跨浏览器**，清站点数据会丢失。
- 若以后要做跨设备 “上次有效练习”，应落到服务端事件（例如 stats / memory episode），而不是把 localStorage 当成真相源。
- 计时器与反馈的冲突属于 UI 状态机问题：后端 duration 只是 mission 估计，真正是否 dismiss 屏幕由前端状态决定。

这些是准确的产品/证据边界，不是可以靠改一行 prompt 隐藏的问题。

### 18.8 History 删除与统一 Evidence 仍需同源撤销

当前 History 删除会处理旧 Skill、Error、Note、Memory source 和 Profile 计数，但统一学习系统是后来新增的
另一套投影。完整方案不能只删除 `EVIDENCE#`：

```text
按 sourceId 找 canonical + timeline evidence
  -> 在同用户写 lease/transaction 下撤销
  -> 从剩余事件重建受影响 LEARNING# skill state
  -> 删除/标记对应 RUN# 与 RUN_TIME#
  -> 并发新 evidence 时检测 version 冲突并重试
```

若直接先删 state 再逐条重放，期间并发请求可能看见空状态或覆盖新证据；若只做减法，又很难正确还原 Beta
参数、最近 20 条窗口、retention dueAt 和模态统计。因此当前选择是明确暴露限制，而不是实现一个看似完整但
会静默丢数据的非原子修补。

### 18.9 “可重试”必须区分串行去重和并发幂等

不同 endpoint 的保护强度不同：

| 操作 | 幂等标识 | 同标识正在处理 | 完成后重放 | 真并发保护 |
| --- | --- | --- | --- | --- |
| Diagnose | 规范化内容 hash | 409 `diagnosis_in_progress` | 旧 response，`duplicate=true` | 条件 claim |
| Practice submit/grade | `clientAttemptId` | 409 `practice_attempt_in_progress` | immutable draft/result | 条件 claim |
| Chat send/analyze | turn/analysis claim | 409 对应 in-progress code | 已保存 turn/analysis | 条件 claim |
| Input source analysis | source claim | 409 `input_learning_in_progress` | complete source | 条件 claim |
| Input production attempt | `clientAttemptId` in source list + evidence ID | **没有独立 attempt claim** | 串行重试去重 | ActivityRun 仍可能并发重复 |

因此前端不能对所有 409/timeout 采用同一个“立即自动重试”策略。特别是 Input production attempt：当前
`clientEventId` 会让 Evidence 去重，但两个完全同时到达的请求可能各自创建 ActivityRun。发布说明和测试只能
承诺串行 retry dedupe；要承诺真并发幂等，应像 Practice 一样增加条件 claim、busy 409、完成结果重放和
failed/stale takeover。

## 19. 给零基础学习者的八阶段路线

“一周”只是建议节奏，每阶段约 4–8 小时；课程多时可以两周完成一阶段。不要因为日历到了就跳过验收。

### 第 1 阶段：电脑、终端、Git 和 HTTP

前置：无。学习第 0–3 章和 14.1–14.2。

完成任务：

1. 能用 `pwd/ls/cd` 找到仓库根、`apps/api`、`apps/web`。
2. 能解释 localhost、3000/8000、URL 和 200/422/500。
3. 在练习 branch 改一行 Markdown，用 `git diff` 看见它，再提交或在新 clone 中丢弃。

验收：不看本文也能画出 browser → frontend → backend → provider/database，并说出 secret 为什么不能进
`NEXT_PUBLIC_`。

### 第 2 阶段：无密钥跑通第一个闭环

前置：第 1 阶段。学习 14.3–14.6。

完成任务：

1. 用两个终端启动 fake/moto 后端和前端。
2. 完成一次 diagnose，在 Network 找到 method、status、payload、response。
3. 用 cookie jar 连续请求 diagnose 与 profile。
4. 分别制造 connection refused 和 422，再恢复。

验收：能根据“有没有 request、status、耗时、后端日志”判断失败在哪一层。

### 第 3 阶段：Python、Pydantic 和 FastAPI

前置：能运行项目。学习第 4–6 章。

完成任务：把 4.3 的容器例子保存成独立 `.py`，加入一次循环、函数、异常和 type hint；再跟读 health route。

小改动：新增临时 `GET /api/v1/debug/hello`。先预测未注册 router 的 404，再注册得到 200，最后在练习 branch
中移除或单独提交。

验收：能解释 model、route、service、repository 各自不该做什么，并为 422 写出一个具体输入。

### 第 4 阶段：Diagnose、repository 和数据库

前置：第 3 阶段。学习第 7、9、10 章。

完成任务：

1. 跟一次 Diagnose，从 request 到 response，并记录写入哪些 item。
2. 在纸上计算一次 mastery 变化。
3. 用五条 PK/SK 数据预测 `begins_with` Query。
4. 运行 `DYNAMODB_ENDPOINT_URL= uv run python -m scripts.diagnosis_claim_test`，观察受控并发产生
   `[200, 409]`；再串行重复已完成输入，观察 `duplicate=true` 的结果复用。普通连续点击不一定能制造
   请求重叠，所以不能把“没有看到 409”当成实现失败。

验收：能说清“用户视图读完分页”和“模型 context 有界”为什么不能共用一个隐式 limit。

### 第 5 阶段：TypeScript、React 和前后端连接

前置：第 2 阶段。学习第 13 章。

完成任务：

1. 跟 `DiagnosticInput` click → state → api-client → response → report。
2. 改按钮文案和字符计数。
3. 模拟 loading、empty、success、error。
4. 用 `pnpm lint`、`tsc` 和 build 验证。

验收：能解释 props/state/effect 的差别，且能从 Network response 而不是 toast 找到 API error。

### 第 6 阶段：AI、Memory 和自适应决策

前置：理解基本数据流。学习第 8、11、12 章。

完成任务：

1. 解释 provider/model/API/SDK 与 structured output/grounding 的差别。
2. 创建两条 Memory，调用 retrieve，手算 score component。
3. 查看 recall trace，并说明 embedding 失败为何还能 lexical fallback。
4. 跟 `CoachMissionAI` union，解释 task context 为什么不是 learner evidence。

验收：只改一个 retrieval weight，在 disposable branch 跑 benchmark、观察排序，再用 diff 确认恢复；不能把
当前 5-case Recall@6=0.80 或未来可能出现的 1.00 描述成真实用户总体质量。

### 第 7 阶段：测试、调试与安全修改

前置：已完成一个前后端小改动。学习第 15、17、18 章。

完成任务：选择一个边界，先写失败测试，再修复，再 refactor；运行最小相关脚本和完整检查。

验收记录必须包含：

```text
改了什么文件
成功输入与失败输入
运行了什么命令
预期与实际输出
还有什么不能由该测试证明
```

### 第 8 阶段：部署概念与 capstone

前置：前七阶段。学习第 16、22–24 章。

完成任务：

1. 从空目录完成第 23 章，得到 `2 passed`、浏览器 200 和故意的 422。
2. 解释 image/container、Nginx、TLS、DNS、Git SHA 和 rollback。
3. 写一份只读生产验证清单；没有明确授权和 secret 管理能力时不操作真实源站。

最终验收：不用查看答案，向同学演示“运行 → 修改 → 制造错误 → 定位 → 修复 → 测试 → 解释完整链路”。
做到这一点才叫能够应用，而不是读过所有高级名词。

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
- “四道混合练习各自选 top-1 skill 就够了。”——并行时必须带 session 上下文，否则 surface form 会塌缩成同一错误。
- “计时结束就应该关掉反馈页。”——用户主动完成的结果必须保留；timer 只能限制输入窗口，不能吞掉学习反馈。
- “Session Win 存在 localStorage 就等于用户进度云同步了。”——没有；那只是本机欢迎回来提示。

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
| sessionSlot / sessionSize | 混合练习里“第几题 / 一共几题”，用于分散技能与表面形式 |
| Surface form | 同一技能下的具体句子外壳（人名、场景、措辞），应与底层错误模式区分 |
| Session Win | 单次闭环结束时的前端小胜利卡片与下一步 CTA |
| Welcome-back | 基于上次 Session Win 本地时间戳的隔日回访提示 |

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
9. 若改了“练习结束 / 对话结束”体验，是否同步 Session Win 构造函数、挂载点、i18n 和 localStorage 语义。
10. 若改了并行出题，是否仍传入并处理 `sessionSlot` / `sessionSize`，避免 diversity 回退。

学习项目时不要试图一次读完所有文件。选择一条用户行为，从前端按钮一路跟到 DynamoDB，再跟着 response 回到页面；这是从“会写代码”走向“理解工程”的最快方法。

## 23. 从空目录重建一个最小版 WeakSpot

这一章是一项 capstone：不复制生产项目，而是把最重要的结构缩成一个真正可运行的小项目。代码块分两类：

- 标明具体文件路径的代码是完整文件，可直接保存。
- 明确写着“概念片段”的代码不能单独运行，只解释未来扩展。

完成后你会拥有：

- 一个 React/Next.js 输入页面。
- 一个 FastAPI `/diagnose` endpoint。
- Pydantic 请求/响应验证。
- 一个可替换的 AI service。
- 一个内存 repository（之后再换 DynamoDB）。
- 两个自动测试和明确预期输出。
- 一次从浏览器按钮到内存存储的完整纵向链。

### 23.1 初始化后端和前端脚手架

前置检查：

```bash
git --version
node --version
pnpm --version
uv --version
```

在一个不属于当前仓库的学习目录中执行。`pnpm create` 需要网络下载脚手架，其余依赖首次安装也需要网络：

```bash
mkdir mini-english-coach
cd mini-english-coach
git init
mkdir -p api/app
cd api
uv init --bare --python 3.11
uv add fastapi "uvicorn[standard]" pydantic
uv add --dev pytest httpx
cd ..
pnpm create next-app@16.2.6 web --ts --eslint --tailwind --app --use-pnpm \
  --no-src-dir --import-alias "@/*" --disable-git --yes
mkdir -p web/lib
touch .gitignore
pwd
git status --short
```

记下 `pwd` 输出的完整路径，23.9 的新终端会用到它。`git status --short` 应把 `api/` 与 `web/` 都显示为
根仓库中的未跟踪内容，而不是只看见 Web。用编辑器打开这个 `mini-english-coach` 文件夹，在 `api/app/`
创建一个空的 `__init__.py`；它明确表示 `app` 是 Python package。把根目录 `.gitignore` 保存为下面这个
完整文件，避免把虚拟环境、依赖、缓存或密钥加入 Git：

```gitignore
api/.venv/
**/__pycache__/
**/.pytest_cache/
*.py[cod]
.coverage
htmlcov/

web/node_modules/
web/.next/

.env
.env.local
.env.*.local
.DS_Store
```

再运行 `git status --short --ignored`，确认 `.venv`、`node_modules`、`.next` 等以 `!!` 显示为 ignored，
而源码仍是 `??`。最终会有：

```text
mini-english-coach/
├── .gitignore
├── api/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── service.py
│   │   └── repository.py
│   └── test_api.py
└── web/
    ├── package.json
    ├── pnpm-lock.yaml
    ├── app/layout.tsx
    ├── app/page.tsx
    └── lib/api.ts
```

`uv init --bare` 只创建项目配置，避免生成另一个容易与 `app/main.py` 混淆的示例 `main.py`。先只实现一条
纵向功能；不要同时建立十张表和二十个页面。根目录 `git init` 让 API 与 Web 属于同一仓库；
`--disable-git` 阻止脚手架在 `web/` 内再嵌套一个 `.git`。

### 23.2 定义数据合同

`api/app/models.py`：

```py
from typing import Literal
from pydantic import BaseModel, Field


class DiagnoseRequest(BaseModel):
    text: str = Field(min_length=10, max_length=5000)
    outputLanguage: Literal["en", "zh-CN"] = "en"


class ErrorItem(BaseModel):
    code: Literal["grammar.verb_tense", "grammar.article", "clarity.expression"]
    original: str
    corrected: str
    explanation: str


class DiagnoseResponse(BaseModel):
    submissionId: str
    score: int = Field(ge=0, le=100)
    correctedText: str
    errors: list[ErrorItem]
```

先写 model 的原因是：浏览器、route、service 和测试都需要共同回答“什么输入才合法、什么输出才完整”。`Literal` 能防止 AI 自行发明无限分类。

### 23.3 用 repository 隔离存储

`api/app/repository.py`：

```py
from copy import deepcopy

_submissions: dict[str, dict] = {}


def save_submission(item: dict) -> None:
    _submissions[item["submissionId"]] = deepcopy(item)


def get_submission(submission_id: str) -> dict | None:
    item = _submissions.get(submission_id)
    return deepcopy(item) if item else None
```

这还不是生产数据库，但 route 不需要知道数据存在 dict 还是 DynamoDB。下面只是**概念片段**：
`table` 与 `to_dynamo` 没有在 mini 项目中定义，用来展示未来只替换 repository 的方向：

```py
def save_submission(item: dict) -> None:
    table.put_item(Item=to_dynamo(item))
```

真实项目的 `apps/api/app/db/repositories.py` 就是这个思想的大型版本。

### 23.4 写一个可替换的 service

`api/app/service.py`：

```py
from app.models import DiagnoseResponse, ErrorItem


def diagnose_text(text: str) -> DiagnoseResponse:
    errors: list[ErrorItem] = []
    corrected = text

    # 学习阶段先用确定性规则；以后把函数内部换成结构化 AI。
    if "Yesterday I go" in text:
        corrected = text.replace("Yesterday I go", "Yesterday I went")
        errors.append(ErrorItem(
            code="grammar.verb_tense",
            original="Yesterday I go",
            corrected="Yesterday I went",
            explanation="A finished past event needs the past-tense verb.",
        ))

    return DiagnoseResponse(
        submissionId="",  # route 负责生成系统 ID
        score=max(0, 100 - len(errors) * 12),
        correctedText=corrected,
        errors=errors,
    )
```

Service 只处理“怎样诊断”，不读取 HTTP cookie，也不渲染按钮。以后接 AI 时仍返回同一个 `DiagnoseResponse`：

下面是**概念片段**，因为 `client`、`messages`、key、timeout 和 provider adapter 尚未定义：

```py
result = client.chat.completions.parse(
    model="your-model",
    messages=messages,
    response_format=DiagnoseResponse,
)
return result.choices[0].message.parsed
```

生产项目还会在 AI 输出后重新验证 evidence quote、taxonomy 和长度，因为“结构正确”不等于“事实有依据”。

### 23.5 把它挂成 FastAPI route

`api/app/main.py`：

```py
from uuid import uuid4
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import DiagnoseRequest, DiagnoseResponse
from app.repository import save_submission
from app.service import diagnose_text

app = FastAPI(title="Mini English Coach")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/diagnose", response_model=DiagnoseResponse)
def diagnose(request: DiagnoseRequest) -> DiagnoseResponse:
    result = diagnose_text(request.text)
    result.submissionId = f"sub_{uuid4().hex[:12]}"
    save_submission(result.model_dump())
    return result
```

暂时不要启动；先完成测试和前端。打开 Swagger 的运行命令在 23.9 节。

### 23.6 写前端请求层

不要直接在每个按钮里复制 `fetch`。把下面完整内容保存为 `web/lib/api.ts`：

```ts
export type ErrorItem = {
  code: string
  original: string
  corrected: string
  explanation: string
}

export type DiagnoseResponse = {
  submissionId: string
  score: number
  correctedText: string
  errors: ErrorItem[]
}

export async function diagnose(text: string): Promise<DiagnoseResponse> {
  const response = await fetch("http://localhost:8000/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, outputLanguage: "en" }),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Diagnose failed (${response.status}): ${message}`)
  }
  return response.json()
}
```

真实项目的 `apiFetch` 进一步统一处理 base URL、cookie、语言、模型 headers、timeout 和结构化错误。

### 23.7 写最小 React 页面

Next.js 默认 layout 可能通过 Google Fonts 下载字体；这会让第一次离线 build 因字体网络失败。先把
`web/app/layout.tsx` 完整替换为不依赖远程字体的版本：

```tsx
import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mini English Coach",
  description: "A from-zero full-stack learning project",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`web/app/page.tsx`：

```tsx
"use client"

import { useState } from "react"
import { diagnose, type DiagnoseResponse } from "@/lib/api"

export default function HomePage() {
  const [text, setText] = useState("")
  const [result, setResult] = useState<DiagnoseResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setLoading(true)
    setError("")
    try {
      setResult(await diagnose(text))
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1>Mini English Coach</h1>
      <textarea
        aria-label="English text"
        rows={6}
        style={{ display: "block", width: "100%", marginBlock: 16 }}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p>{text.length} characters</p>
      <button
        disabled={loading || text.trim().length < 10}
        onClick={submit}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {result ? (
        <section>
          <h2>Score: {result.score}</h2>
          <p>{result.correctedText}</p>
          {result.errors.map((item) => (
            <article key={`${item.code}-${item.original}`}>
              <strong>{item.original} → {item.corrected}</strong>
              <p>{item.explanation}</p>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  )
}
```

这个组件已经包含一个完整异步状态机：idle、loading、success、error。生产项目只是在此基础上增加页面导航、缓存、恢复、国际化和更多结果组件。

### 23.8 写第一个自动测试

`api/test_api.py`：

```py
from fastapi.testclient import TestClient
from app.main import app
from app.repository import get_submission

client = TestClient(app)


def test_diagnose_past_tense() -> None:
    response = client.post(
        "/diagnose",
        json={"text": "Yesterday I go to school.", "outputLanguage": "en"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["correctedText"] == "Yesterday I went to school."
    assert payload["errors"][0]["code"] == "grammar.verb_tense"
    assert get_submission(payload["submissionId"]) == payload


def test_rejects_short_text() -> None:
    response = client.post("/diagnose", json={"text": "Hi"})
    assert response.status_code == 422
```

从 `mini-english-coach/api` 运行：

```bash
uv run pytest -q
```

预期核心输出：

```text
2 passed
```

第一个测试同时证明 response 和 repository 副作用；第二个测试证明短文本在 service 之前被 Pydantic 拒绝。
若看到 import error，先运行 `pwd`，确认当前目录以 `/mini-english-coach/api` 结尾。

以后每增加一层，就增加对应测试：

```text
加入身份 -> 测试 body userId 不能冒充别人
加入 AI -> fake AI 合同测试 + malformed JSON 测试
加入 DynamoDB -> moto repository/integration 测试
加入幂等 -> 同 clientAttemptId 重试不重复写
加入分页 -> fixture 超过一页仍完整返回
```

### 23.9 用两个终端运行，并验证成功与失败

终端 A：

```bash
cd /把这里替换为-23.1-pwd-显示的完整路径/api
uv run uvicorn app.main:app --reload --port 8000
```

先打开 `http://localhost:8000/docs`，再验证：

```bash
curl -i http://localhost:8000/health
curl -i -X POST http://localhost:8000/diagnose \
  -H 'Content-Type: application/json' \
  -d '{"text":"Yesterday I go to school.","outputLanguage":"en"}'
```

预期分别是 200 `{"ok":true}`，以及包含 `score: 88`、`Yesterday I went` 和一条
`grammar.verb_tense` error 的 200 response。

故意验证边界：

```bash
curl -i -X POST http://localhost:8000/diagnose \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hi","outputLanguage":"en"}'
```

预期是 422，且 response `detail` 指向 text 长度；这不是服务器崩溃。

终端 B：

```bash
cd /把这里替换为-23.1-pwd-显示的完整路径/web
pnpm dev --port 3000
```

`api/app/main.py` 的教学配置只允许 `http://localhost:3000`。确认启动日志也显示 3000；若 3000 已被占用，
先在原终端停止旧前端，不要顺手改用 3001，否则浏览器会因 origin 不同而被 CORS 拦截。如果你有意改端口，
必须同时修改后端 `allow_origins` 并重新启动后端。

打开 `http://localhost:3000`，输入同一句话。Network 中应看到 `/diagnose` 200；页面显示 score、改写和
error。然后在终端 A 按 `Ctrl+C`，再次点击会显示连接错误。重启后端即可恢复。

最后在 `web` 运行：

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

全部成功后，你已经证明开发模式和生产构建都能理解这份代码。分别在两个终端按 `Ctrl+C` 停止。保留目录继续
练习，或用文件管理器移动到废纸篓；不要在路径不确定时使用递归删除命令。

### 23.10 按阶段扩展，而不是一次复制整个项目

推荐顺序：

1. Diagnose + 内存 repository。
2. 换 DynamoDB，并学习 PK/SK。
3. 加 profile 和 skill mastery。
4. 加 practice generate/submit，使用 `clientAttemptId` 保证重试幂等。
5. 加 text chat，保存 session/message，并限制最近上下文。
6. 加 OAuth cookie 身份和 rate limit。
7. 加 Memory retrieval，并把 context 限制在固定条数/token budget。
8. 加 Coach mission scheduler，再接结构化生成模型。
9. 最后才加 Realtime/TTS、云部署和多 provider。

每一阶段都要满足四个完成条件：

```text
Swagger/curl 能调用
浏览器能显示 loading/success/error
自动测试覆盖成功与至少一个失败边界
secret 不进入浏览器或 Git
```

做到这里，你已经不只是“看懂 WeakSpot”，而是理解了如何把一个产品需求分成合同、业务逻辑、存储、UI 和验证，并能逐步建立自己的同类项目。

## 24. 知识点自测与答案

这一章不是考试，而是检查前 23 章是否真的形成了可迁移理解。建议先遮住答案，只写自己的预测。
一个知识点达到“会用”的标准是：

```text
能用普通语言解释
+ 能找到当前代码入口
+ 能预测一个成功例子和一个失败边界
+ 能说出用哪个测试、status code 或 trace 验证
```

### 24.1 自测题

练习方式：每题先写“预测 → 理由 → 代码入口 → 验证方法”，再查看下一节答案。

1. `POST /api/v1/diagnose` 的 body 少了必填 text，应该返回 400、401、422 还是 500？模型会被调用吗？
2. `nickname: str | None` 是否代表调用函数时可以完全省略 `nickname`？怎样才可以省略？
3. 新增了 `routes/debug.py` 和 decorator，却没有 `include_router`。请求会发生什么？
4. guest 把 body 的 `userId` 改成 owner，会以谁的身份写 DynamoDB？
5. 同一用户并发重试同一 Diagnose，请求怎样避免模型收费和 mastery 更新两次？
6. AI 返回合法 JSON，但 error 的 `originalText` 不在 learner text 中。Pydantic 会不会发现？系统最终应该怎样处理？
7. 一次 grounded article error 会让 weakness 直接 `confirmed` 吗？两次同一天和三次跨两天分别是什么状态？
8. 模型没有报告 preposition error，能否自动记录一次 preposition success？
9. 文字 Chat、OpenAI Realtime、Qwen TTS 和浏览器 ASR 分别接收/产生什么？
10. 为什么 DynamoDB 写入前要把 `73.5` 转成 `Decimal("73.5")`？TTL 到点后业务应该等物理删除吗？
11. 历史有 25 次机会、5 次 failure；最近 20 次有 4 次 failure。累计与最近 error rate 应怎样表达？
12. Memory 分量 `.80/.50/.90/.70/.20/1.0` 按第 11.6 节权重计算是多少？pin 后是多少？
13. 四道 mixed practice 都不传 `sessionSlot/sessionSize`，即使每次 top-1 排序正确，为什么整体仍可能很差？
14. Vercel 环境变量改了但没有 redeploy，浏览器为什么还请求旧 API？
15. 公网 health 返回 200 是否足以证明新版本已上线？最少还要核对什么？
16. 你在一个陌生终端输入 `cd apps/api` 得到 “No such file or directory”。下一步应先运行什么，怎样找到仓库？
17. 创建练习 branch 前，`git status --short` 已显示别人的 `M` 和 `??`。为什么不能直接 reset/restore？安全做法是什么？
18. 第 23 章 React 页面点击 Analyze 后，`loading/result/error` 应怎样经历 idle、loading、success 或 error？
19. 点击按钮后 Network 完全没有 request，与看到 422 response，分别先查前端还是后端合同？你需要记录哪些证据？
20. 普通 API 是 20 秒、模型操作是 110 秒。为什么只在 `fetch()` 返回 headers 时清 timer 仍是 bug？哪个测试证明正文也受 deadline 约束？
21. Evidence body 写 `outcome="success"`、`supportLevel=2`。最终 event 应是什么？完全重试同一
    `clientEventId` 后 state 为什么不能再增加？
22. 第 23 章前端意外启动在 3001，后端 health 和 curl 都正常，但页面报 CORS。为什么？最小修复是什么？
23. 第 23 章得到 `2 passed`、lint、tsc、build 和浏览器 200/422 后，已经证明了什么？仍没有证明什么？

### 24.2 答案与验证入口

下面的答案都给出可观察边界；不要只记最后一个名词或数字。

1. **422**。Pydantic 在 route 业务逻辑前拒绝，请求不应调用模型。用 Swagger 提交空 body 验证。
2. 不能；它只允许值为 `None`。写成 `nickname: str | None = None` 才能省略。
3. 返回 **404**。模块存在不等于 router 已注册；检查 `app/main.py`。
4. 以服务端从 cookie/header 解析出的 guest 身份写入；route 会覆盖 body `userId`。
5. 规范化输入 hash + conditional claim 防重复副作用。第一条正在处理时，并发同文请求返回
   `409 diagnosis_in_progress`；完成后的重试返回既有结果且 `duplicate=true`；failed/stale claim 才允许
   新请求接管，并可复用已经保存的 diagnostic draft。看 `scripts.diagnosis_claim_test`。
6. Pydantic 只知道结构合法，通常发现不了“quote 不在原文”。grounding gate 必须丢弃它；看
   `scripts.single_sentence_evidence_test`。
7. 一次是 `candidate`；两个独立来源且 confidence 足够是 `observed`；至少三个来源、至少两天才
   `confirmed`。同一 source 重复不增加独立来源数。
8. 不能。缺少 error 不是显式成功证据；必须有 opportunity、`outcome=success`、足够 confidence 和
   grounded quote。
9. 文字路径收发 JSON；Realtime 持续交换音频并产生 transcript；TTS 把现成 text 变成完整音频；
   ASR 把用户声音变成可编辑文字。
10. boto3 的 DynamoDB 数字合同使用 Decimal。业务在过期时立即过滤，TTL 只负责稍后物理清理。
11. 累计是 `failureCount=5 / opportunityCount=25`；当前窗口是
    `recentFailureCount=4 / recentOpportunityCount=20 = 0.20`。二者不能互相覆盖。
12. `.50*.80 + .15*.50 + .15*.90 + .10*.70 + .05*.20 + .05*1 = .74`；pin 后 `.89`，
    之后还可能应用 verification factor。
13. 四次都可能选择相同 skill、stage 和 error fingerprint，造成重复 surface form。slot/size 给
    policy 批次位置，才能轮换 skill、题型和 replay/variation/transfer。
14. `NEXT_PUBLIC_*` 在 build 时写入 bundle；改变配置必须重新构建/部署。
15. 不足。还要核对 deployment Git SHA、容器 health、公开安全模型目录、关键文件/镜像版本和至少一个
    有界功能 probe，并确认有回滚包。
16. 先用 `pwd` 看当前位置、`ls` 看子目录；找到含 `apps/api`、`apps/web` 和根 `README.md` 的仓库根后再
    `cd apps/api`。不要凭感觉反复拼路径。
17. `M` 是已修改、`??` 是未跟踪，它们可能是他人的工作。先记录并保留；在干净时才创建练习 branch，
    否则用新的 clone 做实验。只 stage 明确文件，不用 destructive reset 替自己“清场”。
18. idle 时 `loading=false`；点击后清旧 error 并设 `loading=true`；成功写 `result`，失败写 `error`；
    `finally` 无论成功失败都恢复 `loading=false`。若没有 finally，异常后按钮可能永远显示 Analyzing。
19. 没有 request 先查 click handler、disabled 条件和浏览器 Console；422 表示请求已到 FastAPI，
    应查看 request body 与 response `detail`。共同证据是 method/path、status、duration、payload、
    response 和后端是否有日志。
20. 原生 `fetch()` 收到 headers 就 resolve，JSON/音频正文仍可能继续流动；提前清 timer 会无限等正文。
    `pnpm test:timeouts` 的运行时 fake stream 会先给 headers、延迟 body，证明 20/110 秒是完整 response
    deadline，并同时检查 Diagnose/Speech 的调用点。
21. service 会规范化为 `hinted_success`。event ID 来自 `userId + clientEventId`；完全重试返回原 event、
    `duplicate=true`，条件事务不会再更新 `alpha/beta`、计数或 version。
22. origin 包含 scheme、host、port，所以 3000 与 3001 不同；curl 又不执行浏览器 CORS。停止占用 3000
    的旧进程并固定在 3000，或有意同步修改 `allow_origins` 后重启 API。
23. 它证明最小合同、service、内存 repository、React 状态、类型/静态规则和本机纵向链在这些输入下成立。
    它没有证明 OAuth、DynamoDB、真实 AI、并发/分页、可访问性、生产网络或所有浏览器；扩展每一层时必须
    再加相应合同与失败测试。

如果某题只能背出答案却找不到代码或验证入口，就回到对应章节再跟读一遍；如果答案与代码冲突，以当前
代码和合同测试为准，并更新本文。
