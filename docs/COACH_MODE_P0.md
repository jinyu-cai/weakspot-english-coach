# Coach Mode / Input Lab 2.0 P0 说明

> 当前状态：owner 已于 2026-07-13 完成本地交互验收并决定采用本版 P0，批准合并到 `main`，按日常发布路径部署到 Oracle 与 Vercel。Alibaba Cloud 仍只保留为最终展示环境，本次发布不切换 Cloudflare，也不改动 Alibaba Cloud。

## 1. 要解决的用户问题

WeakSpot 已经可以诊断用户粘贴的英文、进行聊天并从真实输入中学习，但新用户仍然需要先回答三个难题：

- “我今天应该练什么？”
- “我没有现成文章、字幕或写作内容，可以从哪里开始？”
- “固定场景练过一次后，下一次还可以练什么？”

这会让最需要引导的用户停在空白输入框前。P0 增加 **Today's Mission / Coach Mode**：用户只选择可投入时间、回答方式和当前精力，系统负责给出一个需要主动表达的短任务。它不是把普通选择题换一层包装，而是让用户在有目标的情境中描述、复述、推断、解释和协商，再从实际产出的英语中寻找弱点。

本轮遵守以下边界：

- 不减少现有诊断、Chat、Practice、Input Lab、Notebook、History 或 Memory 功能。
- 现有 **Input Lab 1.0 (`/input`) 不隐藏**，继续按原有权限和流程使用。
- 只有新增的 **Input Lab 2.0 字幕实验 (`/input/experimental`) 是 owner-only**。
- 不声称当前文本模型具有看图或看视频能力。
- 不在用户确认原型前部署或切换任何生产流量。

## 2. P0 交互流程

Coach Mode 使用一个短而明确的四状态流程：

| 状态 | 用户看到什么 | 主要动作 | 系统行为 |
| --- | --- | --- | --- |
| Setup | 5 / 10 / 15 分钟、文字 / 语音、轻松 / 正常 / 挑战 | “安排今天的任务”；也可以展开指定任务类型 | 结合偏好和最低的若干技能状态生成一个任务；没有可靠历史时选择广泛诊断型目标，不虚构弱点 |
| Briefing | 标题、预计时间、难度、任务说明、可见成功条件；场景任务还显示双方角色和目标 | 开始任务或换一个 | 给用户先建立上下文，不要求用户自己想话题 |
| Active | 场景对话、内置插图或听力播放器；回答区和渐进提示 | 输入、语音转写后编辑、播放听力、逐级请求提示 | 收集用户自己的英语产出；动态场景由 AI 先开口并保持角色 |
| Feedback | 本次任务自检、是否使用提示、语言诊断或对话总结 | 重试、同类型变体、查看弱点模型 | 内容完成度与语言弱点分开呈现；仅将实际语言证据送入既有诊断/会话分析流程 |

用户可以让系统自动选择任务，也可以指定下面五种类型。自动选择不是永久课程决定，每次都可以换一个变体。

## 3. 五种生产型任务

### 3.1 `guided_scene`：动态情境任务

系统生成新的 `setting`、`userRole`、`aiRole`、`goal`、`scenarioPrompt` 和 `starterMessage`。任务必须有实际交流目标，并包含一个温和变化或小冲突，例如澄清座位、调整计划、解释证据或礼貌协商。

- AI 先用 `starterMessage` 入戏，用户不必从空白对话开始。
- `scenarioPrompt` 随会话保存，并优先于普通 `topic` 作为回复、表达预测、Memory 检索和会话结束分析的上下文。
- AI 在任务进行中保持角色并推动情境，不在每句话中打断纠错；结束后统一分析。
- 原有 Chat 固定场景继续保留。Coach Mode 增加的是动态入口，不是删除旧入口。
- 每个动态场景带 `scenarioFamily` 与唯一 `scenarioKey`。服务会读取最近 20 个 Chat 会话，并优先从最近未使用的 12 个场景家族中选择，例如服务补救、职场协调、行程变化、邻里沟通、住房问题、技术支持或社交边界。
- 同一家族耗尽后允许再次使用，但角色、目标、关系、语气、小冲突与 `scenarioKey` 仍重新生成。因此目标是显著降低连续重复，不承诺数学意义上的内容永不相似。
- Chat 首页的“让 AI 给我一个新场景”现在会直接生成 `guided_scene`、创建会话并显示 AI 开场白，不再只是跳转到 Coach 设置页。动态会话中的“新建/继续”也会生成另一个场景。

### 3.2 `picture_story`：看图描述、推断与叙事

前端根据服务端返回的 allowlisted `assetKey` 渲染项目自有的内联 SVG。目前 P0 资产键为：

- `market_morning`
- `rainy_bus_stop`
- `kitchen_surprise`

任务引导用户区分“我看见的事实”和“我的合理推断”，并用自己的语言组织一个短描述或 before-now-next 故事。SVG 是系统提供的学习刺激，不需要文本模型读取像素。

P0 **不会自动判断图片内容是否描述正确**。任务完成后显示的 `successCriteria` 是用户可见、自行勾选的完成清单，不是隐藏答案，也不是机器视觉评分。自动分析只评价用户提交文本中有证据支持的语法、词汇、结构、连贯性与表达问题。

### 3.3 `listen_retell`：听后复述、推断与迁移

普通 Coach 任务使用 AI 生成的原创英文短脚本；owner-only Input Lab 2.0 则使用 owner 明确提供的字幕片段。前端优先调用服务端 `POST /coach/speech`，由后端使用 OpenAI Speech API 生成 MP3，并遵守任务返回的 `playLimit`（合同范围 1–3 次，默认通常为 2 次）。OpenAI key 始终留在后端；UI 明确标注声音由 AI 生成。

同一端点也用于 Coach 的 `guided_scene` 语音回答模式：AI 角色的新回复会自动播放，每条 AI 消息都可重播；文字回答模式不会自动发声。现有 `/chat` Realtime voice 继续使用 OpenAI Realtime API，不经过本端点。

默认模型为仍受支持、偏高质量的 `tts-1-hd`，默认 voice 为 `marin`，都可通过服务器环境变量调整。若 OpenAI 未配置、调用失败或浏览器无法播放返回的 MP3，前端才回退到 Web Speech API `speechSynthesis` 并向用户说明；回退声音的语速和断句仍可能随浏览器变化。生成的 Blob 只在当前任务页面缓存，并设置服务端 `private, no-store`，不写入数据库。

实现依据是 OpenAI 官方 [Audio API create speech reference](https://platform.openai.com/docs/api-reference/audio/createSpeech) 与 [`tts-1-hd` model page](https://developers.openai.com/api/docs/models/tts-1-hd)。当前模型目录已把 `gpt-4o-mini-tts` 标为 deprecated，因此原型不把它设为默认；如供应商以后调整推荐模型，可通过环境变量迁移并重新做声音 QA。

用户看不到自动展示的脚本文本，而是复述主旨、推断意图、重新组织信息或将信息用于新情境。AI TTS 改善了自然度，但动态生成语音仍不是版本固定的听力测验基准；可重复比较的版本化音频仍属于后续工作。

### 3.4 `decision_response`：情境决策与解释

系统给出一个没有唯一标准答案的现实决定，要求用户权衡 2–4 个限制条件、做出选择，并向具体对象解释原因或下一步。例如协调不同时间、处理资源冲突、决定服务补救方式或调整活动计划。

- 重点不是“选对答案”，而是能否清楚表达决定、理由、取舍与行动。
- 任务可以暴露因果连接、语气、结构、澄清和精确表达问题。
- 限制条件在作答前可见，不作为隐藏评分答案；没有完成某个业务条件不能被直接写成语法错误。

### 3.5 `vocabulary_in_action`：语境词汇应用

独立 `/vocabulary` 入口和 Coach 类型都使用真实消息任务来观察词义、搭配、精确度与语域。系统先给出情境、沟通对象、语气和“需要表达的意思”，但不会先展示正确词表或多项选择答案；用户必须用自己的英文完成邮件、更新、请求、解释或回应。

- 任务目标上下文会作为不可信 JSON 字符串送入诊断，仅用于理解用户想表达的含义与语气。
- 所有 `vocab.word_choice` 的 `originalText`、弱点证据和 Memory candidate 仍必须来自用户实际答案，任务说明不能冒充用户语言证据或被记成用户偏好。
- 同一文本在不同任务上下文中使用不同去重 hash，避免第一次诊断错误地遮蔽真正的跨语境复测。
- 一次错误用词在 UI 上显示为“本次观察、需要在另一个语境确认”：它可能说明用户不熟悉该词，或知道词义但还不会在当前搭配/语域中应用。
- 错误仍保存到既有 History、Notebook、skill 与 Memory 证据链；长期稳定结论应参考 `observationCount`、不同来源/场景和后续迁移，而不是把单次错误描述成永久能力标签。

## 4. 无视觉模型时的正确边界

当前文本模型可以分析“用户写了什么”，但不能确认任意图片或视频里“实际发生了什么”。P0 采用下面的边界，避免制造虚假的视觉能力：

1. 图片只使用项目自有、键名受限的 SVG，不接收任意用户图片 URL 或上传文件。
2. 模型根据资产的文字 brief 设计任务，但不声称自己读取了 SVG 像素。
3. 任务成功条件在作答前可见，作答后由用户自行勾选完成度。
4. `/diagnose` 或 Chat 会话分析只从用户的英文产出推断语言弱点。
5. P0 不对视频做视觉理解，也不通过 URL 抓取视频、音轨或字幕。

因此，P0 可以可靠回答“这段英语暴露了哪些语言问题”，但不能可靠回答“用户是否发现了画面里的每一个事实”。如果未来加入视觉模型，也必须单独展示内容判断置信度，不能把不确定的内容判断写成确定的语言弱点。

## 5. 内容完成度与语言弱点必须分离

| 维度 | P0 依据 | P0 输出 | 是否进入长期弱点模型 |
| --- | --- | --- | --- |
| 任务完成度 | 用户对可见 `successCriteria` 的自检；场景中是否实际完成沟通目标由会话上下文辅助理解 | 清单状态和本次任务反馈 | 自检本身不作为掌握证据 |
| 语言弱点 | 用户实际提交的英文文本或会话消息 | 语法、词汇、句子结构、连贯性、风格、清晰度等诊断/会话总结 | 走既有 `/diagnose` 或会话结束分析后，按原有证据规则更新 |
| 图片/视频内容准确性 | P0 没有机器视觉证据 | 不给自动正确/错误分数 | 不进入 |
| 发音准确性 | 浏览器 ASR 只有转写文本，不是音素评分 | 不给发音分数 | 不进入 |

这个分离很重要：一句英语可能语言正确但没有完成任务，也可能完成了沟通目标但暴露多个语言弱点。UI 不应把两者压成一个模糊总分。

## 6. 提示级别与“独立掌握”边界

每个任务返回 2–4 条渐进提示。理想顺序是：

1. 澄清表达意图或思路；
2. 提供少量可用词语或句型；
3. 必要时提供句子开头，但不直接给完整答案。

前端只在用户主动点击后逐条显示，并记录本次页面状态中的 `hintLevel`：

- `hintLevel = 0`：UI 标记为“本次独立完成”；
- `hintLevel > 0`：UI 标记为“本次在提示帮助下完成”。

这些标签只描述**当前一次尝试**。对于 `guided_scene`，前端会在结束分析请求中提交最高 `hintLevel`；服务端取 AI 判断和客户端报告的较大值，并把任何带提示的 `success` 强制降为 `hinted_success` 后才写入 retention。图片与听后复述目前复用 `/diagnose`，只写实际出现的语言错误，不把一次正确回答写成独立掌握证据。即使 `hintLevel = 0`，“本次独立”也绝不等于长期掌握；长期结论仍需要跨时间复测、不同情境迁移和既有 mastery/复发规则共同判断。

## 7. 语音输入、ASR 与用户确认

选择“语音回答”时，P0 尝试使用浏览器的 `SpeechRecognition` / `webkitSpeechRecognition`，语言为 `en-US`。它只是帮助把口语转成可编辑文本：

- 浏览器或操作系统可能不支持，也可能依赖供应商的云服务；P0 不承诺离线转写。
- 临时识别结果可能被改写、重复或漏词，口音和噪声会影响结果。
- 转写只填入 textarea，**不会自动提交**。用户必须阅读、修改并主动确认发送。
- 不支持时继续保留文字输入路径，任务不应因此不可完成。
- 当前诊断分析的是用户确认后的转写文本，不是原始音频，不能据此给发音、流利度或口音分数。

上线前还应在隐私说明中确认目标浏览器的语音服务数据流；不能把浏览器 ASR 当作本项目自行托管的音频处理。

## 8. Input Lab 1.0 与 2.0 的权限边界

### Input Lab 1.0 保持原样

`/input` 继续面向普通用户，保留“收集真实输入”和“注意力任务”、来源类型、用户粘贴内容、学习包、历史和删除等现有能力。本轮不把它改成 owner-only，也不因为 2.0 的版权实验而隐藏它。

### 只有 Input Lab 2.0 是 owner-only

`/input/experimental` 是一个字幕到听后复述任务的受控实验：

- 导航项带 `ownerOnly: true`，前端根据 `/auth/me` 返回的 `isOwner` 隐藏非 owner 入口。
- 直接访问页面时，非 owner 看到无权限状态，而不是实验表单。
- 前端隐藏只是体验边界；真正安全边界在后端。
- `POST /api/v1/coach/input-lab-2/transcript-missions` 使用 `require_owner`，非 owner 即使直接构造请求也得到 HTTP 403。

公开浏览器环境**绝不允许配置 `NEXT_PUBLIC_OWNER_BYPASS_TOKEN`**，也不得把 `OWNER_BYPASS_TOKEN` 或 `x-owner-token` 放进前端 bundle、Local Storage、公开预览环境或客户端请求。任何 `NEXT_PUBLIC_*` 变量都会暴露给浏览器。浏览器 owner 身份应来自 OAuth 会话和服务端配置的 owner login/email；服务端 `OWNER_BYPASS_TOKEN` 只可用于明确隔离的本地/自动化测试，并且不能下发给浏览器。

## 9. 字幕与版权策略

Input Lab 2.0 P0 采用“owner 明确供料、无远程抓取”的最小范围：

- 请求只接受 `title`、`transcript`、`rightsBasis`、任务配置和输出语言；模型配置禁止额外字段。
- 合同没有 URL 字段，不下载视频、不抓取字幕、不绕过平台限制。传入 `sourceUrl` 等额外字段会被拒绝。
- 只应使用 owner 自创、明确获授权、许可兼容或公有领域的字幕/脚本。不要仅因为字幕可以在网络上找到，就推定有权复制和处理。
- `rightsBasis` 是 owner 的来源/权利声明，不是系统完成的版权核验，也不是法律意见。P0 要求填写它，但当前没有建立可审计的权利台账。
- 原始 transcript 接受 40–12,000 个规范化字符。为了单次任务最小化使用量，服务按 5 / 10 / 15 分钟分别截取最多约 900 / 1,500 / 2,200 个字符，并尽量在句末截断。
- 这个有界片段会作为任务设计上下文发送给当前配置的 LLM provider，并作为听力 `script` 返回浏览器播放；上线前必须让 owner 清楚这一数据路径。
- 当前生成接口没有主动把 title、rightsBasis 或 transcript 写入项目数据库，但基础设施日志、供应商保留策略和未来持久化仍需在上线前单独审计。
- 系统提示要求模型不要在标题、说明、条件或提示中复刻字幕；这能减少无关复制，但不能替代权利授权和供应商数据政策。

P0 页面只验证“提供字幕 → 生成任务 → 限次播放”的实验链路，不应被描述成完整的视频平台或版权清算系统。

## 10. API 合同

所有路径都位于 `/api/v1`。浏览器使用带凭据 cookie 的请求；请求中的 `userId` 不能代替服务端身份解析。

### 10.1 生成普通 Coach 任务

`POST /coach/missions`

```json
{
  "durationMinutes": 10,
  "modality": "text",
  "energy": "normal",
  "preferredType": "picture_story",
  "outputLanguage": "zh-CN"
}
```

| 字段 | 合同 |
| --- | --- |
| `durationMinutes` | `5 \| 10 \| 15`，默认 10 |
| `modality` | `text \| voice`，默认 `text` |
| `energy` | `light \| normal \| challenge`，默认 `normal` |
| `preferredType` | 可选：`guided_scene \| picture_story \| listen_retell \| decision_response \| vocabulary_in_action`；省略时由系统选择 |
| `outputLanguage` | `en \| zh-CN`；控制外围说明语言，听力脚本仍为英文 |

该接口使用 `rate_limited("coach")` 身份/配额策略，并最多读取 mastery 较低的五个技能作为个性化上下文。读取失败时仍可为新用户生成任务，但不伪造历史弱点。

成功响应为 `{ "mission": ... }`，公共字段包括：

```json
{
  "id": "mission_...",
  "type": "guided_scene | picture_story | listen_retell | decision_response | vocabulary_in_action",
  "title": "...",
  "eyebrow": "...",
  "briefing": "...",
  "estimatedMinutes": 10,
  "difficulty": "normal",
  "targetSkills": ["discourse.coherence"],
  "taskPrompt": "...",
  "successCriteria": ["...", "..."],
  "hints": ["...", "..."]
}
```

类型专属字段：

- `guided_scene.scene`：`setting`、`userRole`、`aiRole`、`goal`、`scenarioPrompt`、`starterMessage`、`scenarioFamily`、`scenarioKey`。
- `picture_story.picture.assetKey`：仅允许三个项目内置键之一。
- `listen_retell.listening`：英文 `script` 和 1–3 的 `playLimit`。
- `decision_response.decision`：`situation`、`userRole`、`audience`、`decisionGoal` 和 2–4 条 `constraints`。
- `vocabulary_in_action.vocabulary`：`situation`、`communicativeGoal`、`audience`、`tone` 和 2–5 个 `conceptsToExpress`；服务端确保 `targetSkills` 包含 `vocab.word_choice`。

`targetSkills` 只能来自服务端 allowlist，长度 1–4；`successCriteria` 为 2–5 条；`hints` 为 2–4 条。常见失败为 422 请求/模型结构校验、429 配额、502 AI 生成失败和 500 服务异常。

### 10.2 owner-only 字幕任务

`POST /coach/input-lab-2/transcript-missions`

```json
{
  "title": "Owner-created interview excerpt",
  "transcript": "A sufficiently long owner-supplied English transcript...",
  "rightsBasis": "Created by the product owner",
  "durationMinutes": 5,
  "modality": "voice",
  "energy": "light",
  "outputLanguage": "zh-CN"
}
```

- `title`：1–240 字符。
- `transcript`：去除多余空白后 40–12,000 字符。
- `rightsBasis`：3–500 字符。
- 禁止额外字段，没有 `sourceUrl`。
- 非 owner 返回 403。
- 成功响应始终是 `listen_retell` mission；`listening.script` 是服务端截取的 owner 片段。

### 10.3 OpenAI AI 语音

`POST /coach/speech`

```json
{
  "text": "A bounded English listening script...",
  "style": "natural"
}
```

- `text`：规范化后 1–4,096 字符，禁止额外字段。
- `style`：`gentle | natural | challenge`，只映射到受限语速；客户端不能提交任意声音指令、模型或 voice。
- 使用 `rate_limited("coach_speech")`；OpenAI key、base URL、model 和 voice 均来自服务器环境。
- 成功返回 `audio/mpeg`，并带 `Cache-Control: private, no-store`。
- 未配置返回 503 `tts_not_configured`；供应商失败返回 502 `tts_provider_error`。两种情况前端都可回退到浏览器语音。
- 环境变量：`OPENAI_API_KEY`、`OPENAI_TTS_BASE_URL`、`OPENAI_TTS_MODEL`、`OPENAI_TTS_VOICE`。默认分别复用服务端 OpenAI key、官方 `/v1` base URL、`tts-1-hd` 和 `marin`。

### 10.4 动态场景与 Chat 的衔接

Coach 前端用下面两个新字段创建既有文本 Chat 会话：

```json
{
  "topic": "mission title",
  "scenarioPrompt": "dynamic roleplay context",
  "starterMessage": "first in-character line",
  "scenarioFamily": "delivery_problem",
  "scenarioKey": "delivery_problem:unique-id"
}
```

服务端保存这两个字段，在 AI 会话历史前补入可见的 starter message，并让 `scenarioPrompt` 优先成为回复、预测和结束分析上下文。starter 不伪装成用户消息；只有真实用户消息形成用户语言证据。

Coach 场景结束时沿用现有分析路径，并增加保守提示字段：

```json
{
  "outputLanguage": "zh-CN",
  "hintLevel": 2
}
```

`hintLevel` 允许 0–4。大于 0 时，后端不能把目标用法记作无提示独立成功。

### 10.5 带任务语境的词汇诊断

既有 `POST /diagnose` 增加可选 `analysisContext`（最多 2,400 字符）。普通 Diagnose 调用保持不变；情境决策和词汇应用会传入任务情境、目标、对象、语气与概念。服务端把它作为明确标记的 untrusted task context 放在 user message 内，不放入 system prompt。模型可以用它判断 `vocab.word_choice` 和 `style.register` 是否符合意图，但任何错误 span 仍必须出自 `text`。保存 submission 时同时保留 `analysisContext` 以便审计；去重 hash 也包含上下文 hash。

## 11. 测试与预览分支状态

### 自动合同检查

离线脚本 `apps/api/scripts/coach_contract_test.py` 不访问网络、DynamoDB 或真实模型，覆盖：

- OpenAPI 中存在普通任务、owner 字幕和 AI 语音三个 Coach 路由；
- fake AI 能返回五种结构合法的任务；
- 动态场景包含受限 family 与唯一 key，并在仍有未使用 family 时避开最近 family；
- 词汇任务强制包含 `vocab.word_choice`，带任务语境的诊断把上下文标成不可信数据，并让不同上下文产生不同去重 hash；
- TTS 合同拒绝空白文本，离线 fake OpenAI client 验证 `tts-1-hd`、`marin`、MP3 和受限语速参数，不访问真实 API；
- owner 字幕片段按 `listen_retell` 合同返回；
- `require_owner` 拒绝非 owner；
- 字幕请求拒绝 `sourceUrl`；
- 动态 Chat 优先使用 `scenarioPrompt`，并把 `starterMessage` 加入 AI 上下文。
- 会话分析会用真实 `hintLevel` 把提示后的 `success` 校正为 `hinted_success`。

运行方式：

```bash
cd apps/api
UV_CACHE_DIR=.uv-cache uv run python -m scripts.coach_contract_test
```

### 合并前检查

```bash
cd apps/web
pnpm exec tsc --noEmit
pnpm build
```

2026-07-13 对当时工作树的验证快照：

| 检查 | 结果 |
| --- | --- |
| `UV_CACHE_DIR=.uv-cache uv run python -m scripts.coach_contract_test` | 通过，输出 `COACH CONTRACT CHECKS PASSED` |
| `UV_CACHE_DIR=.uv-cache uv run python -m scripts.smoke_test` | 通过，输出 `ALL SMOKE CHECKS PASSED` |
| `env DYNAMODB_ENDPOINT_URL= UV_CACHE_DIR=.uv-cache uv run python -m scripts.dedup_test` | 通过；相同文本+相同上下文去重，不同上下文会保存为新的迁移观察；手动删除回滚仍通过 |
| `env DYNAMODB_ENDPOINT_URL= UV_CACHE_DIR=.uv-cache uv run python -m scripts.integration_test` | 通过，完整 moto + fake AI 学习闭环通过；History 26 条、Notebook 57 条的无 20/50 上限回归仍通过。显式空值只用于覆盖本机 `.env` 的 DynamoDB Local 地址，测试未连接真实 AWS |
| `pnpm lint` | 通过 |
| `pnpm exec tsc --noEmit` | 通过 |
| `pnpm build` | 通过；构建产物包含 `/coach`、`/vocabulary`、`/chat` 和 `/input/experimental` 路由。受限沙箱首次无法访问 Google Fonts，允许构建读取字体后通过；这不是应用代码错误 |
| `git diff --check` | 通过 |
| 内置浏览器交互截图 | 当前会话没有可用浏览器实例，因此未执行；没有用设计稿或其他工具冒充实际运行截图 |

这些结果只对应验证时的工作树；如果之后继续修改 Coach、Chat、Auth 或 API 合同，交付前必须重新运行。浏览器交互与权限人工检查仍不能由构建结果代替。

还需要人工检查：

- 非 owner 看不到 Input Lab 2.0 导航，直接访问只显示拒绝状态，直接请求后端得到 403；Input Lab 1.0 仍可正常进入。
- owner 可以粘贴符合长度的字幕和权利说明，生成并播放限次听力任务。
- 五种 Coach 任务均可从 Setup 进入 Briefing、Active 和 Feedback。
- Chat 动态卡片直接进入带 AI 开场白的新场景；连续生成时尽量不重复最近的场景家族。
- `/vocabulary` 可生成语境任务，传入受限分析上下文，并将单次 `vocab.word_choice` 显示为待确认证据。
- OpenAI TTS 配置时优先播放 AI MP3；未配置/失败时显示回退说明并播放浏览器语音；UI 始终显示 AI voice disclosure。
- 语音转写不可用时有文字回退；转写不会自动提交。
- 图片页没有视觉模型评分承诺；内容自检与语言诊断分栏显示。
- 使用提示后显示 assisted；不使用提示只写“本次独立”，不宣称长期掌握。
- 360px 左右窄屏没有横向裁切，任务名、模型名、按钮和反馈完整可见。

### 当前发布状态

- 发布来源：`prototype/coach-mode-p0`，owner 已完成本地验收。
- 数据迁移：无；发布会对现有 DynamoDB 表执行幂等建表/TTL 检查。
- `main` 合并：已批准。
- 日常后端：批准部署到 Oracle，Cloudflare 保持 Oracle origin。
- 前端：批准由 `main` 触发 Vercel Production 部署。
- Alibaba Cloud：本次不部署、不重启、不切流量，留到最终展示前同步同一 release commit。

自动检查和人工检查的实际结果同时记录在本文件测试表与
[`change-log.md`](change-log.md)；后续修改 Coach、Chat、Auth 或 API 合同时仍需重新运行发布门禁。

## 12. P1 后续

### 12.1 服务端 facts 与内容评估

为每个内置图片/故事资产建立版本化、只在服务端保存的 fact pack，例如明确对象、动作、位置关系、可接受推断和歧义。提交后再进行“用户表达 vs facts”的受约束比较，并返回：

- 发现了哪些已知事实；
- 哪些是合理推断；
- 哪些结论缺少证据或存在歧义；
- 内容完成度置信度及依据。

facts 不能在作答前下发成隐藏答案，也不能把内容遗漏直接变成语法弱点。评估服务应保存 asset version、rubric version、模型版本和置信度，低置信度只给建议，不给确定错误。

### 12.2 提示强度进入学习证据

服务端保存 `missionId`、任务版本、`hintLevel`、播放次数、回答方式和重试关系。mastery 更新按无提示、轻提示、强提示分权重，并要求间隔复测和跨情境迁移后才判定独立掌握。

### 12.3 版本化基准音频

当前 OpenAI TTS 已替换浏览器声音作为主路径，但同一脚本重新生成的韵律仍可能不同。若要做严格可比的听力测试，应补充项目自制/明确授权、版本化的固定音频：保存 transcript hash、voice、model、语速、音频时长、授权来源和 asset version。这样才能稳定比较不同用户与不同时间的听力难度，同时保留完成后可访问的文字稿。

### 12.4 Micro-video

先从项目自制或明确授权的 10–30 秒短片开始，不抓取第三方视频。每个短片携带授权元数据、字幕、结构化事件 facts 和版本号；即使仍使用文本模型，也可以基于服务端 facts 设计观察、复述和推断任务。未来如接入视觉模型，应明确标识其参与、保留不确定性，并继续把内容判断与语言诊断分开。

### 12.5 Input Lab 2.0 完整闭环

在版权、隐私和稳定音频验证后，再补充 owner 素材库、来源/权利审计、删除和保留规则、回答提交、反馈、历史、重练与撤销证据。完成这些之前，2.0 应继续保持 owner-only 实验状态。
