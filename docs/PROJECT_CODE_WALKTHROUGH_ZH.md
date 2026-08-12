# WeakSpot English Coach：完整项目与源码讲解

> 面向第一次接触完整 Web 项目的开发者。本文按仓库当前实现讲解，不把早期产品设想当作已经存在的功能。
>
> 最后核对：2026-07-30。
>
> 阅读顺序：先读「1–5」理解系统，再按「6–11」追踪一个功能，最后用「12–15」查每个函数所属模块。本文按模块覆盖**主要项目自定义业务函数、路由函数、数据函数、前端 API/工具函数和页面组件**；高重复、只服务局部渲染的 helper 以所属模块归类，不宣称逐行穷举。`components/ui/` 内的函数是 shadcn/Radix 的薄样式包装器，统一在第 9 节说明，避免对相同的 `className + ...props` 转发重复几十次。
>
> 本文是“源码索引”：回答“函数在哪里、负责什么”。概念原理、数值演算、成功/失败示例和可运行实验
> 以 [`../development.md`](../development.md) 为主；英文对照见
> [`../development.en.md`](../development.en.md)。阅读函数条目时统一追问：输入是什么、调用谁、写了
> 什么、返回什么、失败时怎样验证。第 15 节给出一个完整示范。

## 1. 一句话理解产品

WeakSpot 是一个跨会话英语教练。它不只回答一次问题，而是把写作、聊天、练习、导入材料和语音对话变成可追踪的学习证据，然后用有限、可解释的长期记忆来影响下一次教学。

```text
写作 / 文本聊天 / 语音 / 导入 / 练习 / 真实材料
  -> 结构化 AI 结果
  -> 保存 submission、error、skill、note、memory、attempt
  -> 召回少量相关记忆
  -> 生成下一次反馈、计划、练习或 Coach Mission
```

它的关键区别不是「接入了 LLM」，而是以下四件事同时成立：

1. 每个模型输出都有 Pydantic schema 和大小限制。
2. 学习状态在 DynamoDB 中跨会话保存。
3. 长期记忆可合并、冲突替换、过期、固定、删除和审计。
4. 下一道练习根据错误、掌握度、间隔和历史效果选择，而非随机出题。

## 2. 如果从零开发，应该按什么顺序做

不要先做语音、记忆或多模型选择。推荐的开发顺序如下；这也是理解当前项目最有效的顺序。

1. **定义一个闭环**：用户交英文文本，得到诊断，保存错误，再做一题针对练习。
2. **搭后端骨架**：创建 FastAPI、`/health`、`.env`、请求/响应 schema。
3. **设计持久化**：决定 Profile、Skill、Submission、Error 的主键和查询方式。
4. **实现诊断链路**：前端 `fetch` → route → LLM service → repository → UI。
5. **展示已保存状态**：Dashboard、History、Notebook，使学习痕迹可见。
6. **实现 Plan 与 Practice**：生成、评分、更新 mastery，保证网络重试不会重复计分。
7. **实现 Chat 和 Chat Import**：持久化会话，结束时提取学习证据。
8. **引入 MemoryAgent**：先保存，再合并/过期/检索，最后才让它影响决策。
9. **加入 Coach、真实材料和语音**：它们共享前面的身份、数据、记忆和分析能力。
10. **补工程护栏**：OAuth、限流、幂等、并发锁、离线测试、Docker、部署。

## 3. 仓库与运行时架构

```text
apps/web  Next.js / React / TypeScript
  └─ 浏览器发出 HTTPS + cookie 请求
apps/api  FastAPI / Python
  ├─ api/routes      HTTP 入口
  ├─ api/deps        身份、限流、模型选择
  ├─ models          Pydantic 输入/输出合同
  ├─ services        业务规则与 LLM 调用
  ├─ db              DynamoDB 单表读写
  └─ core            可测试的纯算法
       ├─ Qwen 或 OpenAI-compatible 文本/嵌入服务
       ├─ OpenAI Realtime（双向语音）
       ├─ Qwen3-TTS-Flash（现有文字转音频）
       └─ DynamoDB（长期数据）
```

一次普通诊断的调用链：

```text
DiagnosticInput（React）
  -> api-client.diagnose()
  -> POST /api/v1/diagnose
  -> Depends(get_llm_provider, rate_limited)
  -> diagnose route
  -> diagnose_english_text()
  -> parse_with_model()
  -> save_submission/save_error/put_skill/save_note/remember_candidates
  -> JSON response
  -> DiagnosticReport（React）
```

## 4. 应用启动、配置、身份与安全

### 4.1 `app/main.py`

- `memory_write_conflict_handler(request, exc)`：MemoryAgent 同一用户写入发生 lease 冲突时，返回 `409 memory_write_retry`；客户端可安全重试，而不把并发错误伪装为成功。
- `root()`：`GET /` 返回服务名称、`/docs` 和健康检查路径，便于最小化连通性检查。

`FastAPI(...)` 创建应用；CORS 中间件只允许配置的前端 origin 和预览 Vercel 域名携带 cookie。每个
`include_router` 把功能挂在 `/api/v1`。理想边界是 route 负责 HTTP/身份并把领域规则委托给 service，
但当前 `diagnose.py`、`chat.py`、`practice.py` 等大 route 仍编排 claim、检索、持久化和错误映射；阅读和
重构时必须以真实代码为准，不能假设 route 都是薄包装。

例如 `health.router` 中的 `@router.get("/health")` 被 `main.py` 加上 `/api/v1` prefix 后，公开路径才是
`GET /api/v1/health`；只创建 route 文件而不 `include_router` 会得到 404。

### 4.2 `app/config.py`：`Settings`

`Settings(BaseSettings)` 从 `.env` 和真实部署环境加载配置。`extra="ignore"` 允许环境中有无关变量；`case_sensitive=False` 使常见的全大写环境变量映射到 Python 字段。

重要 property：

- `cors_origin_list`：把逗号分隔的域名变成列表。
- `uses_qwen_model_studio`：是否配置 Qwen Model Studio key。
- `embedding_api_key`、`embedding_base_url`：允许 Oracle 在仍使用 DeepSeek 文字模型时，独立复用 Qwen
  `text-embedding-v4` 做语义召回。
- `qwen_tts_effective_api_key`：优先专用 TTS key，否则依次复用 Model Studio / embedding key。
- `default_llm_api_key`、`default_llm_base_url`、`default_llm_model`、`default_llm_fast_model`：Qwen 已配置时优先 Qwen；否则使用通用 OpenAI-compatible 配置，再回退旧 DeepSeek 配置。
- `openai_build_week_effective_api_key`：自适应任务规划器未配置专用 key 时复用 `OPENAI_API_KEY`。
- `openai_realtime_model_list`：解析允许的语音模型列表。
- `owner_login_set`、`owner_email_set`、`member_login_set`、`member_email_set`：将配置名单转成小写集合。
- `auth_enabled`、`google_auth_enabled`：只有 client id、secret、session secret 同时存在时才开启 OAuth。

密钥只存在后端 `.env` 或云环境；浏览器绝不能读到 `qwen_model_studio_api_key`、AWS key、session secret 或 OAuth secret。

例如 Oracle 可以只配置 DeepSeek 文字 key + `QWEN_EMBEDDING_API_KEY`：模型目录仍显示 DeepSeek，
Memory 召回却可使用 Qwen embedding；`qwen_tts_effective_api_key` 还可复用同一 Qwen key，而不会把它下发
到浏览器。

### 4.3 `app/api/deps.py`

`get_llm_provider(...)` 有三条互斥路径：

1. 没传 header：返回 `None`，service 使用服务器默认模型。
2. `X-LLM-Server-Deep-Model` 与 `X-LLM-Server-Fast-Model`：只能从服务器 allowlist 选择，key/base URL 不会下发。
3. `X-LLM-API-Key`、`X-LLM-Base-URL`、`X-LLM-Model`：BYOK，仅本次请求使用，要求 HTTPS，不能与服务器模型混用。

其他函数：

- `cookie_kwargs()`：统一生成 `HttpOnly`、生产 `Secure`、`SameSite=Lax` 的 cookie 属性。
- `make_session_jwt(claims, days)`：签发含 `iat`/`exp` 的 30 天登录 JWT。
- `read_session(request)`：从 `session` cookie 验签，失败返回 `None` 而不是抛内部错误。
- `make_state_jwt(redirect)` / `read_state_jwt(state)`：OAuth state 的 10 分钟 nonce 防护。
- `_client_ip(request)`：按 `x-real-ip`、`x-forwarded-for`、socket peer 顺序解析客户端地址；代码没有
  trusted-proxy allowlist，因此部署必须禁止公网绕过 Nginx，并由受控代理覆盖客户端自带转发头。
- `Identity`：统一封装 `user_id`、角色、配额、token/语音上限；`is_unlimited` 和 `has_unlimited_llm_quota` 对 owner/member 返回真。
- `resolve_identity(request, response)`：优先 owner bypass token，其次 session JWT，最后创建并写入一年期 `guest_id` cookie。所有 route 应使用它产生的 `user_id`，不信任 body/path 中的 userId。
- `require_owner(identity)`：非 owner 返回 `403`。
- `rate_limited(feature)`：返回 FastAPI dependency；它对“身份/IP + 功能 + 日期”调用原子计数，超额返回 `429`。

例如 guest 把 JSON 的 `userId` 改成 owner，`resolve_identity` 仍从 cookie 解析 guest，route 覆盖 body；
非 owner 调 Input Lab 2 返回 403，额度已满则在模型调用前返回 429。

## 5. 数据合同、核心算法与 DynamoDB

### 5.1 `models/`：输入输出不是随意的字典

Pydantic models 定义 API 与 LLM 的严格合同：

- `common.py`：`CEFRLevel`、`Severity`、`PracticeType` 枚举，防止字符串拼写漂移。
- `diagnostic.py`：`DiagnoseRequest`、错误/笔记/诊断结果和 `TargetEvidenceAI`。`_word_count()` 只算
  有效 token；`require_enough_words()` 拒绝少于 5 词的诊断。Pydantic 只验证结构；error/success quote
  是否真的来自 learner text 由 route 的 grounding gate 再验证。
- `learner.py`：`LearnerProfile`、`SkillState`、`Submission`、`EnglishError`，即持久化学习状态的公开形状。
- `practice.py`：生成题、提交题、临时评分、AI 评分结果，限制题目和回答大小。
- `plan.py`：固定合同为 **7 天 × 2 task/day × 3 exercise/task**。`cap_exercises`、`cap_target_skills`、`cap_tasks`、`cap_days` 在验证前截断模型超量输出；`normalize_estimated_minutes` 强制 15 分钟。
- `memory.py`：`MemoryCandidate`、手动创建/更新/检索请求；限制 canonical key、内容、信心和重要性。
- `chat.py`：会话、消息、实时 transcript、回复、会话分析和 stealth probe。`cap_examples`、`cap_generated_collections` 将会话分析限制在 DynamoDB 原子提交能容纳的范围内。
- `chat_import.py`：导入会话、导入分析请求和结构化盲点结果。
- `notes.py`：手动选中聊天片段保存。`require_visible_text` 拒绝全空白选区。
- `input_learning.py`：真实材料 capture/attention mission。`normalize_title` 合并空白并拒绝空标题；`blank_to_none` 统一可选字段语义。
- `learning.py`：统一 ActivityRun、LearningEvidence 和 LearningState 的合同；把不同入口产生的学习行为统一成可追踪的运行、证据和技能状态。
- `coach.py`：五类 Coach mission 的 discriminated union。`reject_blank_speech`、`reject_blank_text` 保证 TTS/受权 transcript 不为空。

这些模型的意义是：LLM、浏览器和外部 OAuth 都属于不可信边界；不合格数据不能直接进入数据库或下游 prompt。

### 5.2 `core/`

- `mastery.clamp(value, min, max)`：把 mastery 限在 0–100。
- `mastery.severity_penalty(severity)`：low/medium/high 分别为 -3/-7/-12。
- `mastery.update_skill_from_error(...)`：错误降低 mastery、增加 errorCount、更新 lastSeenAt。
- `mastery.reverse_skill_from_error(existing, severity, now)`：删除历史提交时撤销这一次错误的惩罚。
- `mastery.update_skill_from_practice(existing, is_correct, mastery_delta, now)`：评分后更新 mastery、正确/错误数和练习时间。
- `pagination.encode_dynamo_cursor(last_key)`：把 DynamoDB 的分页键做成 URL-safe Base64 cursor。
- `pagination.decode_dynamo_cursor(cursor, expected_pk, expected_sk_prefix)`：解码后核对当前用户分区和实体前缀；cursor 不是登录凭证，权限仍由服务器身份决定。
- `taxonomy.all_skill_codes()`：返回 taxonomy 允许的技能 code；其他模块不用复制列表。
- `text_hash.normalized_text_hash(text)`：压缩空白、转小写、SHA-256 后取 32 个 hex 字符，用于诊断去重。

### 5.3 `db/keys.py`

所有用户行放在 `PK=USER#<id>`；SK 前缀决定实体类别。每个函数只负责形成一个可预测 key：

`user_pk`、`profile_sk`、`skill_sk`、`submission_sk`、`error_sk`、`submission_hash_sk`、`active_plan_sk`、
`exercise_sk`、`attempt_sk`、`note_sk`、`chat_session_sk`、`chat_message_sk`、`memory_sk`、`memory_trace_sk`、
`activity_run_sk`、`activity_completion_time_sk`、`evidence_event_sk`、`evidence_event_time_sk`、
`learning_state_sk`。

时间在 SK 中，所以 `begins_with("ERROR#")` 就能按一个用户读取错误，且能按时间排序。

例如 `user_pk("abc") -> "USER#abc"`，`skill_sk("grammar.article") -> "SKILL#grammar.article"`；
同一 partition 中既能按精确 SK 读一项，也能按 `begins_with("ERROR#")` 读一类。

### 5.4 `db/dynamodb.py` 与 `db/serialization.py`

- `dynamodb.py`：依据 `Settings` 创建 boto3 DynamoDB resource 和 `table`；本地可改 endpoint 到 emulator。
- `to_dynamo(value)`：递归把 `float` 转 `Decimal`，因为 DynamoDB 不接受 Python float。
- `clean(value)`：读回时递归把 `Decimal` 转 int/float，才能安全 JSON 序列化。

例如 API 的 `73.5` 写入前成为 `Decimal("73.5")`，读回 response 前再变成 float。若漏掉第一步，
boto3 拒绝 Python float；若漏掉第二步，JSON encoder 可能无法公开 Decimal。

### 5.5 `db/repositories.py`：数据访问层完整目录

此层不决定“应该教什么”，只负责按 key 读写。`now_iso` 生成 UTC 时间；`_put` 与 `_delete` 是统一的 DynamoDB 写/删包装。

| 分组 | 函数 | 作用 |
|---|---|---|
| Storage guard | `_serialized_dynamo_item_size`, `ensure_dynamodb_item_fits` | 写前估算 item bytes；超限转成明确 storage contract error，而不是未知 500。 |
| Profile | `get_profile`, `get_or_create_profile`, `save_profile` | 读取；第一次访问创建 B1 默认档案；保存更新。 |
| Skill | `list_skills`, `get_skill`, `put_skill`, `delete_skill` | 查询、单读、upsert、删除技能行。 |
| ActivityRun | `save_activity_run`, `get_activity_run`, `list_activity_runs`, `list_activity_runs_since`, `list_completed_activity_runs_since` | 活动状态、计数和按时间读取。 |
| Learning evidence | `get_learning_state`, `list_learning_states`, `get_evidence_event`, `list_evidence_events`, `list_evidence_events_since`, `save_evidence_with_learning_state` | 以 clientEventId 幂等写 evidence，同时条件更新技能学习状态。 |
| Submission | `save_submission`, `list_recent_submissions`, `get_submission`, `delete_submission` | 保存、跨 DynamoDB 页读取、单读、删除提交。 |
| Error | `save_error`, `list_recent_errors`, `list_weekly_errors`, `list_errors_for_submission`, `delete_error` | 错误证据的读写和按时间范围查询。 |
| Diagnosis claim | `get_submission_hash`, `put_submission_hash`, `claim_diagnosis_request`, `save_diagnosis_draft`, `release_diagnosis_request`, `delete_submission_hash` | hash 去重 + 条件 claim + draft，防止同一文本并发诊断和重复扣 mastery。 |
| Note | `save_note`, `list_notes`, `list_notes_for_submission`, `get_note`, `delete_note` | Notebook 行的保存、跨页读取、来源关联和删除。 |
| Memory lease | `claim_memory_write_lease`, `release_memory_write_lease` | DynamoDB 条件写抢占/释放同一用户的写 lease。 |
| Memory rows | `_memory_row`, `save_memory_with_memory_write_lease`, `save_memory`, `get_memory`, `touch_memory_access`, `expire_memory_if_due`, `list_memories`, `delete_memory`, `save_memory_trace`, `list_memory_traces` | 标准化 memory 行；fenced 保存；读/列/删；访问计数、到期归档和召回审计。 |
| Input keys | `_input_learning_source_sk`, `_input_learning_item_sk` | 为 capture 和其 item 生成同用户分区内 key。 |
| Input claim | `save_input_learning_source`, `claim_input_learning_source`, `complete_input_learning_source`, `release_input_learning_source_claim`, `get_input_learning_source` | 以 claim 保护长 AI 分析，避免同一材料重复写。 |
| Input list/write | `list_input_learning_sources_page`, `list_input_learning_sources`, `_raise_if_input_claim_transaction_lost`, `_write_with_input_learning_claim`, `save_input_learning_item`, `save_memory_with_input_learning_claim`, `list_input_learning_items`, `delete_input_learning_items`, `delete_input_learning_source` | 分页、事务冲突转换、在合法 claim 下写 item/memory、列出和级联删除。 |
| Plan/Exercise | `save_active_plan`, `save_plan_with_activity_run`, `get_active_plan`, `save_exercise`, `get_exercise` | 带 version/ActivityRun 一致性地保存当前计划和题，保证提交时有原题可查。 |
| Practice idempotency | `stable_practice_attempt_id`, `_practice_request_sk`, `get_practice_attempt_request`, `claim_practice_attempt_request`, `complete_practice_attempt_request`, `save_practice_attempt_grade_draft`, `release_practice_attempt_request`, `save_practice_attempt`, `list_recent_practice_attempts` | clientAttemptId 派生稳定 ID；claim 防止网络重试创建两次 attempt；保留 AI grading draft 以便安全恢复。 |
| GitHub/rate | `upsert_github_user`, `get_github_user`, `incr_rate_counter` | OAuth 用户行和原子每日限流计数。 |
| Chat session | `save_chat_session`, `get_chat_session`, `update_chat_session_fields`, `claim_chat_session_analysis`, `claim_chat_session_turn`, `release_chat_session_turn_claim`, `release_chat_session_analysis_claim`, `save_chat_session_analysis_draft`, `request_chat_session_realtime_kick` | 会话、同会话并发发送/分析锁、可重试分析草稿、语音终止信号。 |
| Chat transcript | `_chat_transcript_batch_sk`, `_chat_transcript_stage_sk`, `_serialized_dynamo_item_size`, `_build_chat_transcript_stage_items`, `_committed_chat_transcript_batch_ids`, `_list_chat_transcript_stage_items`, `save_chat_message`, `get_chat_message`, `finalize_chat_session_turn`, `finalize_chat_session_transcript_batch`, `list_chat_messages`, `update_chat_session_summary`, `update_chat_session_analysis` | 大 transcript 分段，限制 400KB item，原子提交消息/计数/分析结果，并能重试而不重复。 |
| Chat pages | `list_chat_sessions_page`, `list_chat_sessions` | 受 cursor 约束地返回会话，而不是一次返回无限数据。 |
| Access role | `_normalize_access_identifier`, `get_access_role`, `list_access_roles`, `set_access_role`, `delete_access_role` | 规范化邮箱/登录名，并维护 owner/member ACL。 |
| Google | `upsert_google_user` | 与 GitHub 用户同样的 OAuth upsert。 |

## 6. HTTP 路由：当前 API 入口与编排

路由共同负责 HTTP、依赖注入、身份/权限和 response 合同。部分小 route 只调用 service；Diagnose、Chat、
Practice、Import 等还承担跨 service/repository 的业务编排。长期重构方向可以是变薄，但本节描述的是当前
事实，不把期望架构写成已经实现。

### 6.1 诊断、历史、笔记、统计

- `diagnose._elapsed_ms`：日志计时；`_json_default`：将 Decimal 转 JSON；`_language_text_hash`：把文本、输出语言、任务上下文合成去重 key。
- `diagnose._grounded_quote`：大小写不敏感、压缩空白后检查 quote 是否为 learner text 子串；
  `_grounded_error_occurrence_count` 只累计真实出现的同技能错误；
  `_grounded_memory_candidate` 拒绝 weakness 中原句不在 learner text 的候选。
- `diagnose._plain_diagnosis_evidence`：grounded error 形成 failure；只有模型显式给出
  `opportunityPresent=true`、`outcome=success`、confidence ≥ 0.55 且 quote grounded 时才形成 success。
  “没有报错”不会被推成成功。
- `diagnose._diagnosis_task_difficulty`：把 A1–C2 映射成 0–1 难度，交给统一 learning evidence。
- `diagnose.diagnose(req, response, provider, identity)`：强制使用服务器身份，预检查档案/去重，后台线程调用 LLM 与持久化；每 10 秒输出空白 keepalive，避免 Cloudflare 长请求超时。
- `diagnose._pre_check(...)`：创建 Profile、读取 hash；重复提交则重构旧响应且不重复写。
- `diagnose._llm_and_persist(...)`：检索记忆、诊断、过滤 ungrounded error/candidate、保存
  submission/error/note/skill/profile/hash，写统一 evidence，再合并 memory candidate。
- `history._fix_tz`：兼容 `Z` 时间；`get_history`：只返回当前身份的完整学习历史；
  `delete_history_entry`：删除提交、关联错误/笔记，回滚旧 Skill 和 Memory 来源；当前尚未撤销/重算同来源的
  `RUN#`、`EVIDENCE#`、`LEARNING#`，不能把它描述成所有派生状态的完整删除。
- `notes._fix_tz`、`_normalized_text`、`_message_context`：处理时间、比较选中文本、截取安全上下文。
- `notes.get_notes`：读取 Notebook；`save_chat_selection`：验证会话与消息所有权后保存选区；`remove_note`：删除自己的一条笔记。
- `stats.get_daily_stats`：按浏览器时区和天数返回日统计。
- `profile.get_profile_page_data`：忽略 URL 中的 userId，用当前身份构建 Dashboard 数据。

### 6.2 Plan 与 Practice

- `plan.create_plan`：结合当前错误、技能和记忆，生成并保存严格的七日计划。
- `plan.read_plan`：读取当前身份的 active plan。
- `plan.update_task`：`PATCH /plan/tasks/{task_id}` 更新当前身份计划任务状态，不信任客户端 userId。
- `practice._exercise_for_storage`：压缩保存字段，避免把过大的瞬时决策写入题目行。
- `practice._severity_from_score`：评分转 low/medium/high 证据等级。
- `practice._get_or_default_skill`：无旧 skill 时创建可练习的默认状态。
- `practice._record_practice_outcome`：更新 attempt、skill、memory strategy/weakness evidence。
- `practice._practice_request_hash`：请求内容的稳定 hash；`_claim_practice_request`：获得幂等 claim。
- `practice.generate`：基于 `recommend_next_action` 生成题并保存。
- `practice.submit`：按 clientAttemptId 幂等评分、保存 attempt，更新学习状态。
- `practice.grade_adhoc`：为计划内的预生成题临时评分，也复用同样的安全提交路径。

### 6.3 Chat 与 Realtime

`chat.py` 的辅助函数按功能分组：

- 模型：`_default_text_model`、`_allowed_text_models`、`_validate_text_model`、`_new_session_model`、`_session_provider`、`_session_text_model`，负责默认值、allowlist、会话固定模型和 BYOK/服务器模型恢复。
- 会话展示：`_elapsed_ms`、`_unlimited_llm_output`、`_public_session`，分别计时、判断额度、隐藏内部字段后返回。
- stealth 状态：`_session_stealth_probes`、`_session_stealth_practices`、`_session_stealth_probe_history`、`_turn_stealth_context`、`_apply_reported_hint_level`、`_has_exact_user_evidence`、`_probe_activation_turn`，提取并验证“自然对话中的隐性复习”证据。
- prompt：`_session_conversation_context`、`_conversation_messages_for_ai`，构造被长度限制的会话上下文。
- 写保护：`_ensure_text_session_writable`，已分析/语音会话不可被文本写入。
- endpoint：`create_session`、`get_sessions`、`get_messages`、`send_message`、`predict`、`analyze_chat_session`，分别创建、分页读取、发送回复、补全预测和结束后原子分析。

`realtime.py`：

- `_allowed_realtime_models`、`_validate_realtime_model`：模型 allowlist 和配额判断。
- `_resolve_realtime_session_user`：忽略客户端伪造的 userId。
- `_realtime_audit_payload`：返回可公开的连接/用量审计。
- `_message_dedupe_key`：同一次 transcript 重传不形成两条消息。
- `create_realtime_session`：创建会话和 OpenAI Realtime session。
- `attach_realtime_sideband`：连接服务器 sideband 来审计和保存 transcript。
- `get_realtime_audit`、`kick_realtime_voice_session`、`save_transcript`：查询、主动终止、持久化文字稿。

### 6.4 Coach、Import、Input、Memory、Auth、Admin

- `coach.create_coach_mission`：按时长、精力、文本/语音和偏好类型生成五类 mission；`create_coach_speech`：调用服务器 TTS；`create_input_lab_2_transcript_mission`：仅 owner 可从受权 transcript 创建任务。
- `chat_import._enforce_platform_import_limits`：限制导入大小以保护配额；`elapsed_ms`：计时；`analyze_chat_import`：流式分析入口；`_json_default`：Decimal JSON；`_analyze_chat_import_and_persist`：分析并写学习状态。
- `input_learning.analyze_source`、`list_sources`、`read_source`、`submit_source_attempt`、`delete_source`：
  真实材料的创建、分页读取、单读、`POST /{source_id}/attempts` 延迟/复述尝试与级联删除。
- `learning.create_run/read_run/update_run`：ActivityRun 的创建、读取和状态更新；
  `create_evidence`：写一次有来源/机会/结果的统一学习证据；`read_learning_overview`：返回累计与近期学习状态。
- `memory.get_memories`、`add_memory`、`retrieve`、`traces`、`next_action`、`stealth_next`、`patch_memory`、`remove_memory`：Memory Center 的 CRUD、召回预览、审计和下一步决策。
- `auth._configured_auth_providers`：列出已配置 provider；`_safe_redirect`：解析 URL 并只允许与
  `frontend_url` 完全相同的 scheme/hostname/effective port，拒绝相似前缀、userinfo 和换协议；
  `github_login/callback` 与 `google_login/callback`：OAuth；`me`：当前身份；`logout`：清 cookie。
- `admin.list_access_roles_endpoint/read_access_role/upsert_access_role/remove_access_role`：owner-only ACL 管理。
- `health.health_check`：无副作用健康检查；`models.list_models`：公开安全的模型目录。

例如 `POST /api/v1/coach/speech` 成功返回 `audio/*` bytes，不是 JSON；非 owner 调
`/api/v1/coach/input-lab-2/transcript-missions` 返回 403；`GET /api/v1/llm/models` 只返回安全 model ID，
永远不返回 key/base URL。

## 7. Service：模型、教学与记忆逻辑

### 7.1 LLM 与普通教学服务

- `ai_client._provider_connection`：把默认/BYOK provider 归一化为 key、URL、model。
- `ai_client.get_client`：创建 OpenAI-compatible SDK client。
- `ai_client._is_unsupported_reasoning_effort`：识别 provider 不支持 reasoning 参数的错误。
- `ai_client._uses_model_studio_qwen`：判断是否 Qwen Model Studio，便于特殊兼容参数。
- `ai_client.parse_with_model`：真正的结构化模型调用入口；fake 模式走 `fake_for`，真实模式请求模型、必要时移除不兼容参数、验证为 Pydantic response model。
- `diagnose_service.select_diagnose_model`：fast 选 fast model，deep 选 deep/default model。
- `diagnose_service.build_diagnose_user_prompt`：将任务上下文标为不可信，只允许它解释意图，不允许它成为错误证据。
- `diagnose_service.diagnose_english_text`：组装 system prompt、语言规则、记忆上下文并调用 `parse_with_model`。
- `plan_service.generate_learning_plan`：为有限技能/错误/记忆生成严格七天计划。
- `practice_service.generate_practice_exercise`：按 target skill、题型、进阶阶段生成题。
- `practice_service.grade_practice`：将用户作答和期望答案交给 schema 评分。
- `chat_service.build_chat_messages`：构造聊天 system + history + user prompt。
- `chat_service.chat_reply`：生成纠错型回复与候选记忆。
- `chat_service.build_predict_messages` / `predict_completion`：为输入中句子生成少量续写预测。
- `session_analysis_service.analyze_session`：对已持久化会话做末尾分析，产出错误、表达、弱项、笔记、记忆和 stealth assessment。
- `profile_service.build_profile_overview`：将 Profile、Skill、近期错误和统计组装为 Dashboard 所需的一个 response；`weakest_skill_code`：从当前 skill 选择掌握度最低的 code，供旧兼容或默认目标使用。
- `notebook_service._weakness_skill_code`：从 weakness memory 找到关联技能；`_source_ids`：收集一条记忆所有来源提交 ID；`list_notebook_notes`：为每条 Note 派生 `current/previous` 学习状态及相关弱项，而不删除已掌握内容。
- `stats_service.resolve_timezone`：解析 IANA 时区，非法值回退 UTC；`parse_iso_datetime`：兼容 `Z` 的 ISO 时间；`local_date_for`：把 UTC 事件映射到用户本地日期；`_day_template`：初始化零值日统计；`_score_average`：安全计算平均分；`_achievements`：根据累计/当日状态生成徽章；`_next_best_action`：从日统计提出可执行的下一步；`build_daily_stats`：读取 submissions/attempts 后聚合最近 N 天的 Dashboard 图表数据。

### 7.2 模型目录、嵌入、TTS 与 Coach

- `model_catalog._normalized`：标准化模型名；`_add_option`：加入不重复安全选项；`configured_server_models`：由配置产生可选 deep/fast 模型；`catalog_payload`：公开 JSON；`server_model_by_id`、`server_model_pair`、`server_model_for_name`：allowlist 查询。
- `model_routing.select_text_model`：把 `fast/deep` tier 解析到请求 provider 或服务器默认模型；
  `reasoning_effort_for_tier`：fast 使用 `medium`，deep 使用 `max`；OpenRouter adapter 将其转换为统一的
  `reasoning.effort` 请求对象。
- `embedding_client.embeddings_available`：检查 Qwen embedding 配置；`_get_client`：创建 client；`embed_texts`：批量获取向量并在失败时返回可降级结果；`embed_text`：单条包装。
- `output_language.normalize_output_language`：不合法语言回退英文；`language_instruction`：返回给模型的回答语言规则。
- `tts_service._generation_url`：只接受 HTTPS Qwen base URL；`_validated_audio_url`：只接受 HTTPS 且属于
  Alibaba allowlist 的音频 URL；`generate_speech`：调用 Qwen3-TTS-Flash，流式读取并在超过 10MB 时立即
  中止，返回 provider `audio/*` 媒体类型（不可信类型才回退 `audio/wav`）。
- `openai_mission_service._model_name/_official_base_url`：fail closed 检查 GPT-5.6 和官方 base URL；
  `_privacy_safe_user_id`：生成哈希 safety identifier；`parse_gpt56_mission`：用 Responses API、
  `store=False` 和 Pydantic Structured Outputs 生成自适应任务。
- `coach_service._selected_fast_model`、`selected_coach_model`：fast/deep 选择；
  `uses_adaptive_mission_planner`：区分 GPT-5.6 与 selected-provider 两条真实运行路径；
  `_response_model_for_request/_gpt56_response_model_for_request`：按 preferred type 选择普通/GPT-5.6
  union schema；`select_scenario_family`：避免连续场景重复；`_compact_skill_context`：压缩 learner skills；
  `_public_response`：只公开可渲染 mission 和真实 generation metadata；`generate_coach_mission`：主生成器；
  `_bounded_transcript_excerpt`：限制版权材料给模型的长度；`generate_transcript_mission`：从受权 transcript
  生成任务。
- `realtime_prompts.realtime_hint_instruction`：Realtime conversation 的语言提示。

例如已有 `"Hold on a second."` 时，Coach Speech 走
`route -> tts_service.generate_speech -> Qwen URL -> allowlisted HTTPS audio download -> audio/*`；Realtime 则是持续
交换麦克风音频。两者即使都“有声音”，也不能复用同一个请求合同或前端状态机。

### 7.3 Input Learning

- `select_input_learning_model`：选择 fast 模型。
- `_source_material`：从 content/transcript/notes 取可分析材料。
- `_canonical_expression_key`：为表达式建立去重 key；`_public_row`：隐藏内部字段。
- `_find_case_insensitive`、`_evidence_around`、`_exact_source_evidence`：验证 AI 指出的表达确实来自用户提供材料，并截取可审计证据。
- `_fallback_grounded_items`、`_fallback_mission_items`、`_fallback_attention_mission`、`_deterministic_result`：
  为 `USE_FAKE_AI=true` 的无密钥开发路径生成确定结果，并在模型结果缺项时做受证据约束的补位；生产
  `_call_model` 的 provider failure 会向 route 冒泡成 502，不承诺 outage 时自动回退。
- `_call_model`：真实结构化调用；`_normalize_items`：删除重复/无证据/超量 item。
- `_memory_candidates`：从值得长期记住的表达生成 memory candidate。
- `analyze_input_learning`：claim → 读记忆 → 分析 → 写 source/item/memory → complete 的主流程。
- `list_input_learning_sources_for_user`、`list_input_learning_sources_page_for_user`、`get_input_learning_source_for_user`、`delete_input_learning_source_for_user`：面向 route 的所有权安全包装。

### 7.4 MemoryAgent：最重要的函数目录

`memory_service.py` 的函数可按生命周期阅读：

1. **时间/规范化**：`utc_now`、`parse_iso`、`iso_at`、`_ttl_after`、`normalize_canonical_key`。统一时间、TTL 和“相同事实”的 key。
2. **公开与相似性**：`public_memory` 隐藏内部细节；`_content_similarity`、`_looks_conflicting` 判断能否合并或必须 supersede。
3. **证据与验证**：`_source_ref`、`_verification_snapshot`、`_error_evidence_pairs`、`_error_evidence_parts`、`_weakness_skill_code`、`_source_modality`、`_append_unique` 把来源、原句/改句、模态和有限列表保存在统一结构中。
4. **弱项学习状态**：`_initialize_weakness_learning_state` 建立 evidence/probe/retention 字段；`_merge_weakness_learning_state` 合并新证据；`_reactivate_weakness` 在新错误出现时恢复 resolved 弱项；`_weakness_graduation_snapshot` 判断是否满足毕业条件；`_record_weakness_practice_evidence` 记录练习结果。
5. **存储生命周期**：`_expiry_fields` 为 preference/goal/strategy/weakness/episode 设置不同过期时间；`_mark_archived` 标记 superseded/forgotten/expired；`_active_memories` 过滤无效行；`list_active_memory_records` 和 `snapshot_active_memory_records` 读取可用于决策的快照；`_matching_memories` 找同 canonical key。
6. **写操作**：`remember_candidates` 批量合并/替换 AI 候选；`create_manual_memory`、`update_memory`、`forget_memory`、`forget_memories_from_source` 服务于用户控制；`_enforce_capacity` 保证每用户不超过上限，优先清理低价值未固定项。
7. **候选生成**：`memory_candidates_from_errors` 把错误变 weakness candidate；`heuristic_memory_candidates` 从明确的偏好/目标句子提取保守候选。
8. **检索数学**：`_tokens`、`lexical_similarity`、`cosine_similarity`、`estimate_tokens`、`_truncate_to_budget`、`_recency` 为混合检索提供词法、语义、预算和时间衰减。
9. **弱项摘要**：`_weakness_overview_sort_key`、`_weakness_min_mastery`、`_weakness_due_label`、`_weakness_verification_state`、`_compact_weakness_metric`、`_compact_weakness_index_entry`、`_build_weakness_overview` 让 prompt 中的弱项信息有界且可读。
10. **召回与结果反馈**：`retrieve_memory_pack` 以语义 50%、词法 15%、重要性 15%、新近性 10%、频率 5%、关键类型 5% 打分，保留目标/偏好，限制条数和 token，并写 trace；`record_practice_outcome_memory` 将评分聚合为 strategy memory 和弱项掌握证据。

`memory_write_service.py` 防止并发覆盖：`current_memory_write_claim` 查当前 ContextVar claim；`memory_write_lease` 带超时地获取同用户 lease；`save_memory` 若存在 claim 则 fenced write；`memory_write_locked` 装饰公共 read-modify-write 函数，保证嵌套调用复用同一 lease。

`decision_service.py`：`_days_since` 计算间隔；`_skill_scores` 以 mastery 缺口 45%、近期错误 25%、失败需求 20%、间隔 10% 排技能；`_type_scores` 根据 strategy memory 选择题型；`_progression_context` 判断 replay/variation/transfer；`_stage_practice_type` 在 transfer 强制 rewrite；`recommend_next_action` 汇总成可解释决策。

`stealth_practice_service.py`：`text_probe_turn_is_ready` 先判断当前消息是否适合自然评估；`_as_now/_clamp/_tokens/_topic_overlap/_retention_state/_skill_code/_fingerprint/_modality_state/_progression_stage` 提供状态与特征；`_strategy_stats/_choose_strategy` 和 `_interaction_move_stats/_choose_interaction_move` 选择既有效又不重复的教学方式；`select_stealth_probe` 选择已知弱项；`_coverage_*`、`_discovery_opportunity_fit`、`select_discovery_probe` 处理未知技能覆盖；`select_conversation_probe` 汇合两种选择；`_skill_elicitation_brief` 与 `build_stealth_probe_instruction` 变成聊天提示；`_strategy_reward/_record_strategy_result/_record_discovery_coverage` 更新统计；`_summary/record_stealth_probe_outcome/record_guided_practice_retention/stealth_practice_summary` 保存结果和可解释摘要。

`realtime_sideband.py`：`_monitor_key` 生成运行中 sideband 的 map key；`_safe_int` 防御性转换数字；`_usage_details/_camel_to_snake/_snake_to_camel/_usage_value/_normalize_usage/_add_usage` 将 provider 用量事件统一累加到会话；`_event_usage/_event_error/_short_text/_transcript_text` 从不可信事件提取受长度限制的字段；`_transcript_event_key/_assistant_buffer_key` 为去重和分段建立稳定 key；`_update_fields/_get_session/_request_kick/_save_transcript_message` 是 async repository 包装；`_connect_realtime_sideband` 建 WebSocket；`start_realtime_sideband`、`kick_realtime_session`、`has_active_realtime_sideband` 管理连接；`_run_realtime_sideband/_monitor_messages/_handle_realtime_event` 消费事件；`_maybe_enforce_kick/_send_kick` 实施时长限制；`_maybe_flush` 批量落库。

`fake_ai.py` 中所有 `_fake_*` 函数分别返回对应 schema 的固定样例（诊断、导入、计划、练习、聊天、Coach、Transcript）；`fake_for(response_model)` 按目标 schema 选择样例。它只用于无密钥本地开发和测试，不能作为生产教学逻辑。

### 7.5 统一学习状态

`learning_service.py` 把 Diagnose、Practice、Coach 和 stealth 等来源统一成可比较证据：

- `build_activity_run/create_activity_run/prepare_activity_run_update/update_activity_run`：建立和推进一次活动，
  把 counter 限制在持久化合同内。
- `_initial_learning_state`：为技能建立 Beta state、机会/结果计数、模态状态、retention 和 recent evidence。
- `_evidence_weight`：按 evaluator confidence、难度、是否延迟和是否新情境计算本次权重；
  `_update_beta_state` 更新 alpha/beta。
- `_apply_evidence`：把 success/hinted_success/failure/avoided 写入累计状态；保留最近 20 条
  `recentEvidence`，分别计算 recent failure、occurrence、risk、独立成功率和跨日覆盖。
- `record_evidence`：以 `clientEventId` 幂等写一次证据；
  `learning_overview`：汇总当前状态；`recommend_coach_mission`：按证据缺口推荐 Coach。

例如累计 25 次机会、5 次 failure，而最近 20 次有 4 次 failure 时，历史计数继续保留 5/25，
`recentErrorRate` 则是 `4/20=0.20`。对应验证见
`scripts.single_sentence_evidence_test` 和 `scripts.learning_loop_test`。

## 8. 前端：页面、API 和状态

### 8.1 `lib/api-client.ts`

它是浏览器唯一应直接接触的后端接口层。

- 基础函数：`delay` 模拟 mock 网络；`getErrorMessage` 将 FastAPI 校验/错误格式转成人类可读文本；`apiFetch` 自动加 JSON、cookie、语言和模型 headers，处理 `429` 登录提示；`newestFirst` 排序；`nextPageCursor` 防止服务器重复 cursor 死循环。
- `timed-fetch.ts`：`fetchWithTotalTimeout` 把 deadline 保持到 response body 被完整读取；因为原生
  `fetch()` 收到 headers 就会 resolve，若此时清 timer，流式 JSON/音频正文可能在 20/110 秒之后继续
  无限等待。调用方主动 abort 与超时错误分别保留，`check-api-timeouts.mjs` 同时验证调用点和
  “headers 已到、正文仍慢”的运行时回归。
- 模型与诊断：`getServerLLMModels`、`diagnose`、`analyzeChatImport`。
- Profile/Memory：`getProfile`、`getMemories`、`createMemory`、`updateMemory`、`forgetMemory`、`retrieveMemories`、`getMemoryTraces`、`getNextActionDecision`。
- Plan/Practice：`getPlan`、`generatePlan`、`updatePlanTask`、`generatePractice`、`gradePracticeAdhoc`、
  `submitPractice`。
- History/Notebook：`getHistory`、`deleteSubmission`、`getNotes`、`saveChatSelectionToNote`、`deleteNote`。
- Input/Coach：`analyzeInputLearning`、`getInputLearningSources`、`getInputLearningSource`、
  `submitInputLearningAttempt`、`deleteInputLearningSource`、`generateCoachMission`、
  `generateInputLab2TranscriptMission`、`synthesizeCoachSpeech`。
- 统一学习状态：`createActivityRun`、`getActivityRun`、`updateActivityRun`、`recordLearningEvidence`、
  `getLearningOverview`。
- Chat/Voice：`createChatSession`、`getChatSessions`、`getChatMessages`、`sendChatMessage`、
  `predictChatCompletion`、`analyzeSession`、`createRealtimeSession`、`attachRealtimeSideband`、
  `kickRealtimeSession`、`saveVoiceTranscript`。
- Admin/Stats：`listAccessRoles`、`upsertAccessRole`、`deleteAccessRole`、`getDailyStats`。

每个函数都先判断 `USE_MOCK`：没有 `NEXT_PUBLIC_API_BASE_URL` 时返回形状一致的 mock data；线上则调用同名后端 API。这个 seam 让 UI 能独立开发，但提交前必须以真实后端验证。

### 8.2 前端通用工具函数

- `auth.ts`：`getMe` 读身份；`isAuthConfigured` 判断登录开关；`loginPageUrl/loginUrl/startLogin` 生成并跳转登录；`logout` 请求退出。
- `language.ts`：`normalizeLanguage`、`getStoredLanguage`、`setStoredLanguage`、`getOutputLanguage` 管理英文/中文输出偏好。
- `llm-settings.ts`：`formatServerModelOption/formatServerModelSelection` 渲染模型名；`legacyServerPair` 兼容旧设置；`serverModelsForMode/normalizeServerModelSettings` 验证选择；`canUseStorage/loadLLMSettings/saveLLMSettings/clearLLMSettings/hasCustomLLMSettings/getLLMProviderHeaders` 管理浏览器本地 BYOK 或服务器模型 header。
- `chatgpt-import.ts`：`textFromPart/messageText/normalizeRole/isoFromTimestamp/normalizeConversation` 清洗官方导出；`normalizeChatGPTExport`、`parseTranscript`、`parseChatGPTImportFile` 支持 JSON/文本；`englishRatio/conversationScore/selectImportConversations` 优先选英语密度和价值高、且数量有限的会话。
- `practice.ts`：`humanizeSkillCode`、`practiceTypeLabel`、`skillLabel` 用当前语言显示代码。
- `skills.ts`：`masteryColor/masteryTextClass/masteryLabel/sortByMasteryAsc` 服务 Dashboard 图表。
- `word-diff.ts`：`tokenize` 按词与空白分词；`diffWords` 生成 LCS 风格原文/改文差异。
- `text-count.countWords`、`utils.cn`、`palette.getPalette/setPalette`、`voice-navigation-guard.setVoiceNavigationLocked/isVoiceNavigationLocked` 分别处理字数、Tailwind class、配色和语音时禁止离开页面。
- `chat-composer.shouldSendFromChatComposer`：区分 Enter 发送与 Shift+Enter 换行。
- `mock-data.getMockExercise/gradeMockAnswer`：本地演示题和固定评分。
- `task-resume.ts`：`loadTaskResume/startTaskResume/updateTaskResume/finishTaskResume/useTaskResume` 在
  localStorage 中保存当前学习任务和草稿；存储失败时保持页面可用，跨标签页用 storage/event 通知刷新。
- `experience.ts`：`trackExperience/markFirstAction` 只记录流程事件、阶段和耗时；类型层拒绝学习原文、
  用户标识和自由文本错误，最多保留最近 100 条本地事件。
- `use-next-exercise.ts`：`useNextExercise` 在用户读反馈时预取下一题；后台预取失败保持安静，真正点击
  Next 时再正常请求，避免把当前反馈替换成错误页。
- `nav.ts`：`NAV_ITEMS/NAV_GROUPS/findNavItem/getVisibleNavGroups` 统一导航清单、分组与 owner-only
  过滤；页面和移动菜单不应各自复制一套入口。
- `session-win.ts`：`getRecentSessionWin/markSessionWin/getWelcomeBackMessage` 维护本浏览器最近一次闭环；
  `sessionWinFromDiagnose/sessionWinFromPractice/sessionWinFromCoach/sessionWinFromChat` 从已有结果派生最多两条
  win 和下一步 CTA，不新增后端状态。
- `i18n.getCopy(language)`：返回本地化字典；文件的大部分内容是字符串而不是逻辑。

### 8.3 页面组件

页面函数是 React 的渲染函数；`useState/useEffect` 内的局部回调只服务该页面，不是跨模块 API。

- `app/page.tsx`：入口/诊断页，组合输入与报告。
- `dashboard/page.tsx` 与 `StatCard`：加载 Profile/Skills，展示总体进度。
- `history/page.tsx` 与 `removeSubmissionFromHistory`：展示历史，确认后删除并刷新本地列表。
- `plan/page.tsx`：生成/读取计划；`plan/practice/page.tsx` 的 `findPlanTask` 找 URL task，`RunnerCard` 渲染一题，`PlanPracticeFlow` 串行完成计划练习。
- `practice/page.tsx` 的 `PracticeFlow`：请求自适应题目、提交、显示评分、继续下一题。
- `chat/page.tsx`：会话选择、发送、预测、分析与 UI 锁；它调用 `api-client`，不直接实现 AI。
- `coach/page.tsx`：请求 mission，并按 union type 渲染场景、图片故事、听力、决策或词汇任务。
- `memory/page.tsx` 的 `SummaryCard/Metric/EvidenceMetric/RecallRow`：渲染记忆总览、毕业证据和检索理由。
- `import/page.tsx` 先选择每个相关会话最近 80 条消息，再用 `chunkChatImportConversations` 保序分批：
  每个会话片段最多 120 条消息、每批最多 20 个会话、序列化 UTF-8 payload 约 200 KB；随后由
  `mergeChatImportResponses/averageCefrEstimate/uniqueStrings/uniqueBy/Stat/InsightList` 合并服务端结果、
  去重和呈现洞察。
- `input/page.tsx` 的 `LearningReason/ResultSkeleton`：解释材料项为何与用户相关、加载占位。
- `stats/page.tsx` 的 `getBrowserTimezone/formatDay/toPercent/StatTile/MiniMetric/LoadingStats`：时区、日期、比例和统计卡片。
- `admin/page.tsx`：owner 管理 access role；`notebook/page.tsx`：筛选、导出和删除笔记；`vocabulary/page.tsx`：词汇输入/复习；`login/page.tsx`：使用 LoginPage。

### 8.4 可复用业务组件

- `DiagnoseProvider/useDiagnose`：跨诊断页面提供 loading/result/error 状态。
- `DiagnosticInput`：输入、字数与提交；`DiagnosticReport`：CEFR、纠错、笔记和行动建议。
- `DiffView`：`isWhitespace`、`DiffLine` 与 `diffWords` 协作显示改写差异。
- `AppShell`：`historyStateSnapshot/historyUrlKey/historyPosition/navigationApi/navigationIndex` 追踪导航；`AppShell` 在语音锁定期间阻止危险导航。
- `LanguageProvider`：`getClientLanguage/getServerLanguage/subscribeToLanguage/LanguageProvider/useLanguage` 用 `useSyncExternalStore` 同步语言偏好。
- `LLMProviderSettings` 与 `ServerModelSelect`：从安全目录加载模型，保存模型设置或临时 BYOK。
- `VoiceChatPanel` + `useRealtimeChat`：hook 中 `pendingTranscriptStorageKey/transcriptMessageId` 用于失败恢复和幂等；组件负责麦克风、Realtime 生命周期与结束回调。
- `SessionWin`：挂载时调用 `markSessionWin`，显示本次闭环成果和下一步；localStorage 失败时静默退化，
  不把它伪装成跨设备学习进度。
- `SessionSummary`：渲染会话末尾分析；`ShadowingButton`：请求 TTS 后播放；`PracticeCard`：提交单题；`LearningPlanCard` 与内部 `ExerciseItem`：显示计划；`NoteCard` 与 `formatDate`：显示笔记；`SubmissionCard` 与 `formatDate`：显示历史提交。
- `SkillBarChart` 的 `wrapSkillLabel/SkillTick` 处理长技能名；`WeaknessRadar`、`ScoreRing/scoreColor`、`CefrBadge` 是数据可视化。
- `CoachScene` 和 `RainyBusStop/MarketMorning/KitchenSurprise`：代码绘制三种内置场景，不依赖外部图片。
- `AuthButton`、`LoginGate`、`LoginPage/safeRedirect`、`NavSidebar`、`AppPreferences`、`PaletteSwitcher`、`ThemeProvider/ThemeToggle`、`LanguageSwitcher`：围绕身份、偏好、导航的 UI 包装。
- `EmptyState`、`ErrorCard`、`DiagnosticLoading`、`CardsLoading`：无数据、错误和 loading 状态。

## 9. `components/ui/` 为什么不逐行分析业务

这些文件是项目自己的导出，但每个函数几乎都遵循同一模式：接收 `className` 和原生/Radix props，用 `cn()` 合并 Tailwind class，然后转发到基础 primitive。它们不读数据库、不发 API、不持有教学状态。

- `alert`：`Alert/AlertTitle/AlertDescription/AlertAction`。
- `badge`：`Badge`。
- `button`：`Button`。
- `card`：`Card/CardHeader/CardTitle/CardDescription/CardAction/CardContent/CardFooter`。
- `chart`：`useChart/ChartContainer/ChartStyle/ChartTooltipContent/ChartLegendContent/getPayloadConfigFromPayload`，唯一稍复杂：通过 Context 为 Recharts 注入颜色/label 配置。
- `checkbox`：`Checkbox`；`collapsible`：`Collapsible/CollapsibleTrigger/CollapsibleContent`。
- `dialog`：`Dialog/DialogTrigger/DialogPortal/DialogClose/DialogOverlay/DialogContent/DialogHeader/DialogFooter/DialogTitle/DialogDescription`。
- `dropdown-menu`：`DropdownMenu`、Portal、Trigger、Content、Group、Label、Item、Sub、SubTrigger、SubContent、CheckboxItem、RadioGroup、RadioItem、Separator、Shortcut。
- `empty`：`Empty/EmptyHeader/EmptyMedia/EmptyTitle/EmptyDescription/EmptyContent`。
- `input`、`textarea`、`separator`、`skeleton`、`spinner`：各自一个原生可访问性包装。
- `progress`：`Progress/ProgressTrack/ProgressIndicator/ProgressLabel/ProgressValue`。
- `scroll-area`：`ScrollArea/ScrollBar`。
- `sheet`：`Sheet/SheetTrigger/SheetClose/SheetPortal/SheetOverlay/SheetContent/SheetHeader/SheetFooter/SheetTitle/SheetDescription`。
- `table`：`Table/TableHeader/TableBody/TableFooter/TableRow/TableHead/TableCell/TableCaption`。
- `tabs`：`Tabs/TabsList/TabsTrigger/TabsContent`；`toggle-group`：`ToggleGroup/ToggleGroupItem`；`toggle`：`Toggle`；`tooltip`：`TooltipProvider/Tooltip/TooltipTrigger/TooltipContent`；`sonner.Toaster`：toast 容器。

修改这些组件时只应调整设计系统；不要把 API 请求或学习规则塞进此处。

## 10. 测试、并发与部署的设计理由

- `scripts/integration_test.py`：用 moto + fake AI 跑“诊断 → Profile → Plan → Practice → History”，不需要真实 key。
- `scripts/smoke_test.py`：验证 import、OpenAPI、schema、模型路由、OAuth exact-origin redirect 和纯规则。
- `scripts/dedup_test.py`：验证 Diagnose context-aware 去重与 History 删除后的来源撤销。
- `scripts/coach_contract_test.py`：验证五类 mission、context 证据边界、TTS HTTPS/域名/10MB 流式上限与
  owner-only 403。
- `scripts/contract_boundary_test.py`：验证较窄下游合同、长度裁剪和跨层投影。
- `scripts/storage_contract_test.py`：验证 DynamoDB item 大小、错误映射和存储边界。
- `scripts/diagnosis_claim_test.py`：验证并发/重试诊断只完成一次副作用。
- `scripts/single_sentence_evidence_test.py`：验证 taxonomy、grounded quote、显式 success、weakness
  candidate/observed/confirmed 和最近 20 条窗口。
- `scripts/learning_loop_test.py`：验证统一 evidence、ActivityRun 和学习状态迁移。
- `scripts/plan_lifecycle_test.py`：验证计划固定数量、长度和任务状态生命周期。
- `scripts/memory_agent_test.py`：验证记忆合并、过期、毕业、复发、检索和决策。
- `scripts/stealth_input_test.py`：验证材料学习、隐性练习、身份隔离与幂等。
- `scripts/input_output_test.py`：验证 retell、必要复用、延迟检索和重试去重。
- `scripts/memory_benchmark.py`：测 Recall、token budget 与过期抑制。
- `apps/web/scripts/check-chat-import-batching.mjs`：直接执行真实前端分批函数，验证 120 条消息、
  20 个会话和 UTF-8 字节三层上限都保持成立。
- `apps/web/scripts/check-api-timeouts.mjs`：验证普通/模型操作仍使用 20/110 秒，并用先到 headers、
  后到 body 的真实 `ReadableStream` 证明 deadline 覆盖完整 response。
- `Memory write lease`：避免同一个用户同时从诊断、聊天、练习写记忆时互相覆盖。
- `Practice/Input/Chat claim`：避免浏览器因为网络失败重试时重复扣分、重复保存 transcript 或重复生成材料项。
- `StreamingResponse keepalive`：诊断的模型响应较慢时，定期给 Cloudflare 空白字节，防止代理 100 秒空闲超时。

部署时，Next.js 在 Vercel，FastAPI 在 Docker/Nginx 后。生产前端只知道稳定 API host；模型、AWS、OAuth 密钥留在后端。详细运行命令见 `apps/api/README.md`、`apps/web/README.md` 和 `LOCAL_TESTING.md`。

当前 Oracle 日常源站不是“一个模型包办全部”：安全文字目录是 DeepSeek deep/fast，语义检索使用 Qwen
`text-embedding-v4`，Coach Speech 使用 Qwen3-TTS-Flash，OpenAI key 服务 Realtime 和 opt-in GPT-5.6
自适应任务。理解部署时要按这四条独立路径检查，不能用一次文字 chat 成功推断所有语音/embedding 功能也成功。

## 11. 修改功能时的实战路线

例如要新增一种“发音问题”能力，通常按此顺序：

1. 在 `models` 加输入/输出字段与合法范围。
2. 在 `core/taxonomy.py` 加 skill code（如果它是长期技能）。
3. 在 service 的 prompt/结构化 schema 中使用该字段。
4. 在 route 调用 service，不让 route 复制业务逻辑。
5. 在 repository 确认有稳定的 SK 和查询路径。
6. 在 `api-client.ts` 加一个对应函数和 TypeScript type。
7. 在页面/组件中显示 loading、error、空态和成功态。
8. 写 fake AI、离线集成测试、并验证真实 provider 输出。

若字段会跨会话影响教学，则还要决定它是否应成为 MemoryCandidate、是否会过期、如何被用户查看/删除，以及是否会进入 `retrieve_memory_pack`。

## 12. 阅读建议：不要从最大文件直接开始

建议实际打开源码时使用以下顺序：

1. `app/main.py`、`app/config.py`、`app/api/deps.py`。
2. `models/diagnostic.py`、`core/mastery.py`、`db/keys.py`。
3. `api/routes/diagnose.py` 与 `services/diagnose_service.py`。
4. `db/repositories.py` 中 Profile/Skill/Submission/Error 四组。
5. `plan.py`、`practice.py`、`decision_service.py`。
6. `memory_service.py`：先读 `remember_candidates`，再读 `retrieve_memory_pack`。
7. 最后读 `chat.py`、`realtime.py` 和前端 `api-client.ts`。

每读一个函数，都回答五个问题：输入是什么？调用谁？写了什么？返回什么？失败时会怎样？这比记住每一行更重要。

## 13. 关键文件导航

- `apps/api/app/main.py`：应用启动。
- `apps/api/app/api/deps.py`：身份、限流、模型提供者。
- `apps/api/app/api/routes/diagnose.py`：最完整的教学写入闭环。
- `apps/api/app/db/repositories.py`：所有 DynamoDB 访问。
- `apps/api/app/services/memory_service.py`：记忆生命周期和召回。
- `apps/api/app/services/decision_service.py`：下一项练习决策。
- `apps/api/app/services/stealth_practice_service.py`：自然对话中的间隔复习。
- `apps/web/lib/api-client.ts`：浏览器到 API 的边界。
- `apps/web/app/chat/page.tsx`、`apps/web/app/memory/page.tsx`：最复杂的前端状态页面。

## 14. 术语速查

- **Route**：HTTP endpoint 的入口，例如 `POST /diagnose`。
- **Dependency**：FastAPI 在 route 前注入的身份、限流、配置等逻辑。
- **Pydantic schema**：自动验证 JSON/LLM 输出形状的 Python 类。
- **Repository**：只做数据库读写的层。
- **Service**：业务规则层，调用模型、算法和 repository。
- **Idempotency**：同一操作重试多次，最终效果仍只发生一次。
- **Lease/claim**：短期排他写锁，用于并发安全。
- **Memory Pack**：从长期记忆中按相关性和 token 预算选出的少量上下文。
- **Canonical key**：表达“同一事实”的稳定 key，用于合并或冲突替换。
- **Mastery**：每个英语技能 0–100 的估计掌握度，不是一次考试分数。
- **Stealth practice**：在自然聊天中出现、但不会粗暴打断用户的观察/复习机会。

## 15. 怎样把“函数目录”变成真正理解

以 `diagnose._plain_diagnosis_evidence` 为例，不要只记住函数名。按五个问题跟读：

| 问题 | 这个函数的答案 |
| --- | --- |
| 输入是什么？ | learner text、已验证 `DiagnosticAIResult`、实际保存的 grounded errors |
| 调用谁？ | `_grounded_quote`、taxonomy 和 severity/confidence 映射 |
| 写了什么？ | 自己不写数据库，只构造统一 evidence list |
| 返回什么？ | 每个可观察技能最多一条 failure 或显式 success |
| 失败/边界怎样验证？ | 原文外 quote、未知 taxonomy、没有 opportunity 的 success 都必须被丢弃 |

贯穿例子：

```text
learner = "Yesterday I went to library."

"to library" + grammar.article error
  -> grounded failure，occurrenceCount=1

"Yesterday I went" + opportunity=true + success + confidence=.91
  -> grounded success

"at school" + 任意 error/success
  -> 不在 learner text，丢弃
```

然后继续跟到调用者：

```text
_plain_diagnosis_evidence
  -> learning_service.record_evidence
  -> lifetime counters + recentEvidence[-20:]
  -> learning overview / Coach recommendation
```

最后运行：

```bash
cd apps/api
uv run python -m scripts.single_sentence_evidence_test
```

用同一个模板阅读其余函数。如果只能复述函数名，却说不出输入、side effect、失败边界和测试，它仍然只是
索引知识；如果能预测上面三个 quote 的结果并在测试中找到断言，才算真正理解。
