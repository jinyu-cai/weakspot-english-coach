# 从零建立 WeakSpot English Coach：完全新手指南

[English edition](BEGINNER_GUIDE.en.md) · [项目首页](../README.md)

适合第一次接触编程、终端、前后端和数据库的读者。按 **2026-09-23 的当前工作区代码**编写；中英文版章节与练习一一对应。

你将完成三件事：在自己电脑上运行完整项目；从空目录亲手写出一个简化版；理解如何逐步扩展成有数据库、AI、学习记忆和部署能力的应用。第一轮不需要购买服务器、注册模型服务或准备 API Key。下载工具和依赖仍需要网络。

这份指南是新的入门入口。较长的 [中文开发笔记](../development.md) 和 [英文开发笔记](../development.en.md) 留作深入阅读；它们涉及旧部署的部分不能替代当前配置。当前数据库是 PostgreSQL，DynamoDB 和 RDS 迁移不是新手安装步骤。

<a id="contents"></a>
## 目录

1. [先理解我们要做什么](#step-1)
2. [第一次使用终端](#step-2)
3. [安装工具：macOS、Windows、Linux](#step-3)
4. [下载项目，认识文件夹](#step-4)
5. [运行完整项目：不用真实 AI 密钥](#step-5)
6. [完成第一次诊断，停止与再次启动](#step-6)
7. [够用的编程基础](#step-7)
8. [沿一次请求阅读真实源码](#step-8)
9. [从空目录写出一个简化版](#step-9)
10. [把临时记录变成数据库记录](#step-10)
11. [接入真实 AI，理解学习记忆](#step-11)
12. [修改功能、测试和保存版本](#step-12)
13. [从本地运行走向上线](#step-13)
14. [遇到错误时怎么排查](#step-14)
15. [学习顺序、自测与继续阅读](#step-15)

<a id="step-1"></a>
## 1. 先理解我们要做什么

WeakSpot 是一个英语学习网站。用户写一段英文，系统给出诊断，保存有依据的薄弱项，再安排练习。下一次练习可以使用此前的学习记录。

先把网站想成三个协作的程序：

| 部分 | 用普通话解释 | 本项目使用 |
| --- | --- | --- |
| 前端 | 浏览器里看得见、能点击的页面 | React、Next.js、TypeScript |
| 后端 | 接收请求、检查输入、组织诊断和保存记录 | Python、FastAPI |
| 数据库 | 程序关闭后仍保存记录的地方 | PostgreSQL |
| AI 服务 | 后端向外部模型请求分析的能力 | 可替换的模型服务；入门时用固定结果 |

在本指南的本地环境中，数据这样移动：

```mermaid
flowchart LR
    A[浏览器 localhost:3000] --> B[Next.js 前端]
    B -->|/backend/api/v1/diagnose| C[Next.js 代理]
    C -->|127.0.0.1:8000/api/v1/diagnose| D[FastAPI 后端]
    D --> E[固定的模拟 AI 结果]
    D <--> F[(Docker 中的 PostgreSQL)]
```

`localhost` 和 `127.0.0.1` 通常都表示你自己的电脑；`3000`、`8000`、`5432` 是端口，用来区分不同服务。浏览器不是直接连接数据库。运行在 Docker 容器里的程序拥有自己的网络环境，因此容器里的 `127.0.0.1` 也不是宿主机。

先完成的最小闭环是：**输入英文 → 点击分析 → 收到报告 → 在历史中找到记录**。语音、电子书、OAuth 登录和云部署放到后面。

<a id="step-2"></a>
## 2. 第一次使用终端

终端是输入文字命令来操作电脑的窗口。macOS 打开「终端」，Windows 按下一章安装后打开「Ubuntu」，Linux 打开 Terminal。

本指南的 `bash` 命令适用于 macOS 的 zsh/bash、Linux bash、Windows 的 WSL Ubuntu。**不要直接粘贴到 Windows CMD 或 PowerShell**；唯一的 PowerShell 安装步骤会单独标注。

```bash
pwd
ls
```

`pwd` 显示当前文件夹的完整路径；`ls` 列出其中的文件。再认识这些命令：

| 命令或符号 | 含义 |
| --- | --- |
| `cd apps/api` | 进入当前目录下的 `apps/api` |
| `cd ..` | 返回上一级 |
| `cd ~/projects` | 进入自己用户目录下的 `projects` |
| `mkdir -p ~/projects` | 创建目录；已有时继续使用 |
| `# 这是一条说明` | 注释，不是程序输出 |
| `Ctrl+C` | 停止当前终端中运行的前台程序 |

命令一行一行执行；失败后先解决当前错误。代码块前的「执行位置」告诉你先进入哪个文件夹。不要把 `$`、日志或 Markdown 的三个反引号复制进终端。跨多行的命令中，行末 `\` 表示下一行仍属于同一条命令。

后续会打开三个终端标签页：A 运行后端，B 运行前端，C 执行检查。A、B 一直显示日志、没有出现新的输入提示符，是正常运行状态。每个新终端的当前目录独立，需要重新 `cd`。

文件内容和终端命令不同。看到「创建文件」时，在编辑器中建立指定文件，粘贴代码并保存；不要把 Python、JSON 或 TSX 内容当成 shell 命令执行。

<a id="step-3"></a>
## 3. 安装工具：macOS、Windows、Linux

### 3.1 需要哪些工具

| 工具 | 用途 | 本指南使用的版本依据 |
| --- | --- | --- |
| 编辑器，例如 VS Code | 打开文件夹、编辑代码 | 任意可用版本 |
| Git | 下载代码和记录修改 | 可用的 Git 版本 |
| Node.js | 运行前端开发工具 | **24**，来自仓库 [`.nvmrc`](../.nvmrc) |
| pnpm | 安装前端依赖 | **9.6.0**，来自 [`package.json`](../apps/web/package.json) |
| uv | 管理 Python 和后端依赖 | 支持下列命令的当前 uv |
| Python | 运行后端 | 本文选 **3.11**；项目要求 `>=3.11` |
| Docker Desktop / Docker Engine + Compose | 在容器里运行 PostgreSQL | 支持 `docker compose` 的版本 |

依赖就是项目使用的现成代码库。`uv.lock` 和 `pnpm-lock.yaml` 记录具体依赖版本；学习运行已有项目时保留它们，不要先升级全部软件包。

### 3.2 按操作系统准备

**macOS：**

1. 安装 [VS Code](https://code.visualstudio.com/download)，以后用「File → Open Folder」打开项目。
2. 执行 `git --version`；若系统提示安装命令行开发工具，完成安装。其他安装方式见 [Git 官方入口](https://git-scm.com/install/)。
3. 从 [Node.js 下载页](https://nodejs.org/en/download) 选择 **24.x** 安装包。如果已经使用 nvm，执行下面的 nvm 命令即可，无需再装第二份 Node。
4. 安装并打开 [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/)，按电脑芯片选择 Apple silicon 或 Intel 版本，等待引擎运行。

**Windows：**

1. 在管理员 PowerShell 中执行下面这条命令，按提示重启，首次打开 Ubuntu 时设置 Linux 用户名和密码：

   ```powershell
   wsl --install
   ```

2. 安装 Docker Desktop，使用 WSL 2 后端，在 Settings → Resources → WSL Integration 中启用 Ubuntu。参照 [微软 WSL 安装说明](https://learn.microsoft.com/en-us/windows/wsl/install) 和 [Docker WSL 指南](https://docs.docker.com/desktop/features/wsl/)。
3. **后续命令都在 Ubuntu 终端执行。**在 Ubuntu 中按 [nvm 官方安装说明](https://github.com/nvm-sh/nvm#installing-and-updating) 安装 nvm，再执行下面的 Node 命令。不要拿 Windows 中的 Node 安装结果代替 Ubuntu 中的安装。
4. 用 VS Code 的 WSL 扩展打开 Ubuntu 内的项目。将代码放在 `~/projects`，本文不使用 `/mnt/c` 路径。

**Linux / Windows 的 Ubuntu：**先安装基础命令。下面适用于 Ubuntu/Debian，其他发行版使用对应包管理器：

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
```

原生 Linux 还需要安装 [Docker Desktop](https://docs.docker.com/desktop/setup/install/linux/) 或 [Docker Engine](https://docs.docker.com/engine/install/) 及 Compose 插件。Windows WSL 用户使用上述 Docker Desktop 集成，不必再在 Ubuntu 中安装第二套 Docker 引擎。

原生 Linux 用户也按 [nvm 官方安装说明](https://github.com/nvm-sh/nvm#installing-and-updating) 安装 nvm，然后执行下一组命令来安装 Node 24。

已按官方说明安装 nvm 的读者，在新终端中执行：

```bash
nvm install 24
nvm use 24
nvm alias default 24
```

### 3.3 安装 pnpm、uv 和 Python

执行位置：任意文件夹。先确保 `node --version` 输出 `v24...`。

```bash
npm install --global pnpm@9.6.0
curl -LsSf https://astral.sh/uv/install.sh | sh
```

第一条为这里选用的 pnpm 9 安装方式；不要省略版本号改装不匹配的最新版。兼容性可查 [pnpm 官方说明](https://pnpm.io/installation)。第二条使用 [uv 官方安装器](https://docs.astral.sh/uv/getting-started/installation/)。完成后关闭并重新打开终端，使新命令进入 PATH，也就是电脑搜索命令的位置。

```bash
uv python install 3.11
git --version
node --version
pnpm --version
uv --version
docker --version
docker compose version
docker info
```

`pnpm` 应为 `9.6.0`。`docker info` 应能显示 Server 信息；仅 `docker --version` 成功，不能证明引擎已启动。Python 由 uv 管理，系统的 `python` 命令不存在也不影响后面的 `uv run`。[uv 管理 Python 的说明](https://docs.astral.sh/uv/guides/install-python/)

**完成标志：**这些版本检查成功，Docker 引擎可用。遇到 `command not found` 先去第 14 章，不要继续跳过。

<a id="step-4"></a>
## 4. 下载项目，认识文件夹

执行位置：任意文件夹；以下统一将项目放在 `~/projects`。

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/jinyu-cai/weakspot-english-coach.git
cd weakspot-english-coach
pwd
git status
```

已经下载过的读者直接进入已有项目，不要再次克隆到它里面。若路径不是本文的路径，后续 `cd ~/projects/weakspot-english-coach/...` 要替换为你的实际路径。

用编辑器打开整个 `weakspot-english-coach` 文件夹：

```text
weakspot-english-coach/       ← 项目根目录
├── apps/
│   ├── api/                  ← 后端：在这里执行 uv 命令
│   │   ├── app/             ← 应用源码
│   │   ├── alembic/         ← 数据库结构升级记录
│   │   ├── scripts/         ← 测试、维护工具
│   │   ├── pyproject.toml   ← 后端依赖声明
│   │   └── uv.lock          ← 锁定的依赖版本
│   └── web/                 ← 前端：在这里执行 pnpm 命令
│       ├── app/             ← 页面与布局
│       ├── components/      ← 可复用界面组件
│       ├── lib/             ← 请求、类型、语言等工具
│       └── package.json     ← 前端依赖与启动命令
└── docs/                    ← 文档
```

`git clone` 下载源代码，不会自动安装全部依赖。下面分别安装前后端依赖。

<a id="step-5"></a>
## 5. 运行完整项目：不用真实 AI 密钥

### 5.1 先分清三种模式

| 模式 | 前端 API 地址 | 后端和数据库 | 能证明什么 |
| --- | --- | --- | --- |
| 前端预览 | 留空 | 不需要 | 页面能显示模拟数据 |
| 本指南主路线 | `/backend` | 都需要，`USE_FAKE_AI=true` | 请求、存储和学习流程能协作 |
| 真实 AI | `/backend` | 都需要，`USE_FAKE_AI=false`，另配服务商 | 模型确实参与分析 |

模拟 AI 是提前写好的固定返回值，不会真正理解每一段输入。主路线保留真实数据库，所以刷新页面、重启后端后仍能读取已经保存的记录。

### 5.2 终端 A：安装后端依赖

执行位置：`apps/api`。

```bash
cd ~/projects/weakspot-english-coach/apps/api
uv sync --frozen --python 3.11
uv run --frozen python --version
```

`uv sync` 建立 `.venv` 虚拟环境，即本项目专用的 Python 依赖目录。`--frozen` 使用现有锁文件，不更新它；`uv run` 在此环境中执行程序，无需手动激活虚拟环境。[uv 同步规则](https://docs.astral.sh/uv/concepts/projects/sync/)

### 5.3 创建本地配置

在编辑器中新建 **`apps/api/.env`**，写入以下完整内容。如果已有此文件，先保留原文件并逐项核对，不要覆盖真实配置。文件名必须是 `.env`，不能是 `.env.txt`。

```dotenv
APP_ENV=development
DATABASE_URL=postgresql+psycopg://weakspot:weakspot@127.0.0.1:5432/weakspot
USE_FAKE_AI=true
OPENAI_BUILD_WEEK_ENABLED=false
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=local-learning-only-do-not-use-in-production
GUEST_DAILY_LIMIT=100
USER_DAILY_LIMIT=100
```

这是一份专用于本地学习的最小配置。不必把 [`.env.example`](../apps/api/.env.example) 中所有可选服务都配置一遍。

| 配置 | 为什么需要 |
| --- | --- |
| `DATABASE_URL` | 告诉电脑上运行的后端如何连接 Docker 暴露的本地数据库 |
| `USE_FAKE_AI=true` | 使用固定文本模型结果，避免真实模型调用 |
| `OPENAI_BUILD_WEEK_ENABLED=false` | 不启用额外的专用任务规划模型路径 |
| `CORS_ORIGINS` | 允许哪些网页来源直接访问后端 |
| `SESSION_SECRET` | 本地会话签名用的示例值；上线必须另设随机值 |
| 两个 `DAILY_LIMIT` | 放宽本地练习限额，避免几次点击就耗尽游客额度 |

环境变量是程序启动时读取的配置。此后修改 `.env`，要停止并重新启动后端。已在 shell 中 `export` 的同名变量会优先于 `.env`；若之前配置过它们，先在新终端核对自己的设置。

`.env` 已由 `.gitignore` 排除。不要把密钥放进网页、截图或 Git 提交中；带 `NEXT_PUBLIC_` 前缀的前端配置会暴露给浏览器。

### 5.4 启动 PostgreSQL，建立数据库表

执行位置：仍在终端 A 的 `apps/api`。

```bash
docker compose -f docker-compose.local.yml up -d --wait postgres
docker compose -f docker-compose.local.yml ps
uv run --frozen alembic upgrade head
```

第一条只启动 `postgres` 服务；`-d` 表示后台运行，`--wait` 等待健康检查。数据库的本地用户名、密码都是 `weakspot`，与这份开发 Compose 文件匹配。`weakspot` 保存手动练习数据，`weakspot_test` 供自动测试使用。

Alembic 是数据库结构升级工具。`upgrade head` 把表结构升级到仓库当前版本；它不是把业务记录删除后重建。

**完成标志：**Compose 显示 PostgreSQL 为 healthy，迁移命令没有 traceback。数据库数据保存在 Docker volume 中，不随终端关闭而消失。

### 5.5 启动后端

执行位置：终端 A 的 `apps/api`。

```bash
uv run --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

`uvicorn` 是运行 FastAPI 的服务器；`app.main:app` 指 `app/main.py` 里的 `app` 对象；`--reload` 会在代码变化时重启。看到 `Application startup complete` 后保留此终端。

打开 [后端健康检查](http://localhost:8000/api/v1/health) 应包含 `"status":"ok"`；打开 [数据库就绪检查](http://localhost:8000/api/v1/health/ready) 应得到：

```json
{"status":"ready","database":"postgresql"}
```

第一个仅证明 API 可以响应；第二个会执行数据库查询，但也不能单独证明所有业务表已完成迁移，所以不要省略 Alembic。

### 5.6 终端 B：配置并启动前端

在新的终端 B 中执行：

```bash
cd ~/projects/weakspot-english-coach/apps/web
pnpm install --frozen-lockfile
```

在编辑器中新建 **`apps/web/.env.local`**：

```dotenv
NEXT_PUBLIC_API_BASE_URL=/backend
```

已有此文件时编辑对应值，保留其他配置。然后在终端 B 执行：

```bash
pnpm dev
```

打开 [本地网站](http://localhost:3000)。`/backend` 是 [`next.config.mjs`](../apps/web/next.config.mjs) 配置的代理入口，它会把 `/backend/api/v1/...` 转到 `127.0.0.1:8000/api/v1/...`。因此不要把配置写成 `/backend/api/v1`，请求函数还会追加 `/api/v1`。

若终端显示端口被占用后改成了 3001，打开日志里的实际网址。当前代理支持这个场景。学习时始终使用同一个主机名和浏览器，以便保留游客身份。修改 `.env.local` 后重新启动前端。

### 5.7 可选：只看页面或使用全容器后端

暂时装不了 Docker，也可以先在 `apps/web` 执行以下命令预览页面：

```bash
NEXT_PUBLIC_API_BASE_URL= pnpm dev
```

这条命令临时覆盖 `.env.local`，使用前端模拟数据。它不能验证数据库持久化。结束预览后用 `Ctrl+C` 停止，再按主路线启动。

仓库还支持在 `apps/api` 中运行 `docker compose -f docker-compose.local.yml up -d --build`，同时把后端和数据库放进容器。它的模拟 AI 配置写在 Compose 文件中，**不会自动套用你为宿主机后端填写的 `.env` 设置**。新手先坚持一种启动方式；已有容器后端占用 8000 时，先执行 `docker compose -f docker-compose.local.yml stop api`，再运行 5.5。

<a id="step-6"></a>
## 6. 完成第一次诊断，停止与再次启动

### 6.1 用页面验收

1. 在首页的写作输入框中粘贴下面的英文。
2. 选择 Fast，点击 **Analyze my English / 分析**。不需要配置 OAuth 登录，基础诊断可用游客身份。
3. 确认出现诊断报告。模拟模式会返回固定示例，结果未必对应你任意修改后的句子。
4. 打开 `/history`，找到刚才的记录；刷新后仍应存在。再看 `/dashboard`、`/notebook` 和 `/memory`，观察相关学习数据。
5. 在同一个浏览器中再次提交完全相同的文本，观察去重行为；不能用“记录必须再增加一条”作为成功标准。

```text
Yesterday I go to my university and I meet my friend. We talk about our project,
but I feel my English is not very good. I always use simple words and I cannot
explain my idea clearly.
```

真实项目要求诊断输入至少 5 个词、最多 12,000 个字符。游客模式不意味着每个功能都开放：管理功能、部分学习实验、真实语音等有额外权限或服务条件。

### 6.2 看见一次真实请求

浏览器按 F12 或右键「检查」，打开 Network，筛选 `diagnose`，再次发起请求。应看到：

```text
POST /backend/api/v1/diagnose
HTTP 200
```

在 Response 中能看到 JSON；终端 A 能看到后端日志。如果页面有报告但完全没有对应网络请求，检查是否误用了前端模拟模式。

终端 C 可以单独检查 API。执行位置：任意目录。cookie 文件放在 `/tmp`，下面两次调用共享同一个游客身份：

```bash
curl --fail-with-body http://localhost:8000/api/v1/health/ready
curl --fail-with-body -c /tmp/weakspot-beginner-cookies.txt -b /tmp/weakspot-beginner-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"userId":"beginner","text":"Yesterday I go to school with my friend.","diagnosisMode":"fast","outputLanguage":"en"}' \
  http://localhost:8000/api/v1/diagnose
curl --fail-with-body -c /tmp/weakspot-beginner-cookies.txt -b /tmp/weakspot-beginner-cookies.txt \
  http://localhost:8000/api/v1/profile/beginner
```

`curl` 是用终端发 HTTP 请求的工具。`-d` 提供 JSON 请求体，`-c/-b` 保存并发送 cookie。接口仍需要 `userId` 字段，但后端以会话/游客 cookie 解析的身份为准，会覆盖请求中的 ID。此处 `beginner` 不会让你读取其他人的记录。curl 的 cookie 与浏览器的 cookie 不同，两边的游客历史也不同。

还可以打开 [交互式 API 文档](http://localhost:8000/docs)，展开 `POST /api/v1/diagnose`，点击 Try it out，填写同样的 JSON 后 Execute。

### 6.3 安全停止和下次启动

停止时，在 A、B 分别按 `Ctrl+C`。在 `apps/api` 目录执行：

```bash
docker compose -f docker-compose.local.yml stop postgres
```

下次启动不需要再次安装全部依赖，也不必重新创建 `.env`：

```bash
# 终端 A：apps/api
docker compose -f docker-compose.local.yml up -d --wait postgres
uv run --frozen alembic upgrade head
uv run --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# 终端 B：apps/web
pnpm dev
```

不要把 `docker compose down -v` 当作日常停止命令：`-v` 会删除数据库 volume。浏览器清除 cookie、换浏览器或使用无痕模式，则会得到另一个游客身份，看不到旧身份的历史不一定是数据库丢失。

<a id="step-7"></a>
## 7. 够用的编程基础

先认识下面几个概念，再进入第 9 章动手。不需要先背完整语言手册。

### 7.1 Python：变量、函数、字典、类型

以下是独立教学片段，可以保存为练习目录中的 `hello.py`，用 `uv run python hello.py` 执行：

```python
text = "Yesterday I go to school."

def count_words(value: str) -> int:
    return len(value.split())

report = {"originalText": text, "wordCount": count_words(text)}
print(report["wordCount"])
```

结果是 `5`。`text` 是变量；`def` 定义一个可重复调用的函数；缩进表示哪些语句属于函数；字典保存名称与值的对应关系。`str`、`int` 是类型提示，本身不会自动验证网络输入。后端使用 Pydantic 模型来执行输入验证。

### 7.2 HTTP 和 JSON：两个程序如何交流

HTTP 请求包含方法、地址、请求头和可选请求体。`GET` 常用于读取，`POST` 常用于提交。JSON 是一种传递结构化数据的文本格式，字段名与字符串用双引号。

```json
{"text":"Yesterday I go to school."}
```

| 状态码 | 在本项目中的常见含义 |
| --- | --- |
| 200 | 请求成功 |
| 401 / 403 | 没有登录或没有所需权限 |
| 422 | 数据格式不符合接口要求，例如文本太短 |
| 429 | 触发使用频率/额度限制 |
| 500 | 后端出现异常，需要看日志 |
| 503 | 某个依赖尚未就绪，例如数据库 |

### 7.3 TypeScript 和 React：页面如何变化

TypeScript 是加入类型检查的 JavaScript；`.tsx` 还允许在代码里写 JSX，也就是类似 HTML 的界面描述。

第 9 章会实际使用 `useState` 保存输入、结果和加载状态。调用 `setText(...)` 后，React 根据新状态重新绘制页面。`onClick` 把按钮点击连接到函数。`async/await` 用于等待 HTTP 请求完成，期间可以显示“正在分析”。

`fetch` 收到 HTTP 422 时并不自动抛出异常，所以请求函数要检查 `response.ok`。浏览器中的 TypeScript 类型也不能代替后端验证：用户可以绕过页面直接调用 API。

<a id="step-8"></a>
## 8. 沿一次请求阅读真实源码

不要按文件名顺序通读全仓库。从刚才的「分析」按钮出发，只追踪这一条路径：

| 顺序 | 文件 | 要回答的问题 |
| --- | --- | --- |
| 1 | [`app/page.tsx`](../apps/web/app/page.tsx) | 首页组合了哪些组件？ |
| 2 | [`diagnostic-input.tsx`](../apps/web/components/diagnostic-input.tsx) | 文本和点击事件从哪里来？ |
| 3 | [`diagnose-provider.tsx`](../apps/web/components/diagnose-provider.tsx) | 哪里设置 loading、result、error？ |
| 4 | [`api-client.ts`](../apps/web/lib/api-client.ts) | `diagnose()` 如何组装 JSON、发送请求？ |
| 5 | [`main.py`](../apps/api/app/main.py) | `/api/v1` 前缀和路由如何注册？ |
| 6 | [`api/routes/diagnose.py`](../apps/api/app/api/routes/diagnose.py) | 如何检查身份、去重、组织保存？ |
| 7 | [`models/diagnostic.py`](../apps/api/app/models/diagnostic.py) | `DiagnoseRequest` 接受哪些字段？ |
| 8 | [`diagnose_service.py`](../apps/api/app/services/diagnose_service.py) | 如何描述模型任务、选择模型？ |
| 9 | [`ai_client.py`](../apps/api/app/services/ai_client.py) | 如何调用模型并验证结果？ |
| 10 | [`db/repositories.py`](../apps/api/app/db/repositories.py) → [`postgres_repositories.py`](../apps/api/app/db/postgres_repositories.py) | 如何保存、查询记录？ |

route 是接口入口，service 是业务逻辑，repository 是数据访问接口。真实代码里部分业务编排仍在 route 中；这些名称表达职责，不意味着每个文件都完美遵守教科书分层。

动手：在编辑器中全局搜索 `DiagnoseRequest`，然后搜索 `USE_FAKE_AI`。找到对应模型与设置后，解释“为什么前端页面能显示报告，却不一定调用了 AI”。

<a id="step-9"></a>
## 9. 从空目录写出一个简化版

现在自己写一个小应用：输入一句英文，返回规则式纠正，并显示历史。它用 **内存存储、固定规则、单一共享历史**，没有真实 AI、用户隔离或生产安全能力；仅在本机学习。后端重启会清空历史。这不是覆盖原项目的操作。

下面每个标有路径的文件代码块都是完整文件。中英文版使用相同代码。先停止第 5 章的前后端，避免端口冲突。

### 9.1 创建空项目与依赖

执行位置：终端 A，从任意目录开始。

```bash
cd ~/projects
mkdir weakspot-mini
cd weakspot-mini
mkdir api web
cd api
uv init --bare --python 3.11
uv add 'fastapi>=0.110,<1.0' 'uvicorn[standard]>=0.29' 'pydantic>=2.6,<3' httpx
mkdir app
touch app/__init__.py
```

如果 `weakspot-mini` 已存在，换一个新目录名，不要合并覆盖旧练习。`uv add` 安装依赖并写入本练习的 `pyproject.toml` 与 `uv.lock`。`app/__init__.py` 留空，表示这里是一个 Python 包。

用编辑器打开 `weakspot-mini`。先创建以下四个后端文件。

### 9.2 数据合同：`api/app/models.py`

```python
from pydantic import BaseModel, Field, field_validator


class DiagnoseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)

    @field_validator("text")
    @classmethod
    def require_words(cls, value: str) -> str:
        if len(value.split()) < 5:
            raise ValueError("Write at least 5 words.")
        return value.strip()


class Submission(BaseModel):
    id: str
    originalText: str
    correctedText: str
    explanation: str
```

`DiagnoseRequest` 是输入合同；缺少文本、文本太短或超过字符限制时，FastAPI 返回 422。`Submission` 是输出合同。这里按空白计词，是教学用简化规则，真实项目还排除了只含标点的 token。

### 9.3 数据存取：`api/app/repository.py`

```python
from uuid import uuid4

from app.models import Submission

_items: list[Submission] = []


def save(original: str, corrected: str, explanation: str) -> Submission:
    item = Submission(
        id=uuid4().hex,
        originalText=original,
        correctedText=corrected,
        explanation=explanation,
    )
    _items.append(item)
    return item


def list_all() -> list[Submission]:
    return list(reversed(_items))
```

`uuid4()` 生成标识符；`_items` 是这个进程中的列表；`append` 添加一条记录；倒序返回使新记录排在前面。把保存逻辑放在单独文件里，将来换 PostgreSQL 时更容易定位修改点。

### 9.4 业务逻辑：`api/app/service.py`

```python
from app import repository
from app.models import Submission


def diagnose(text: str) -> Submission:
    if text == "Yesterday I go to school.":
        corrected = "Yesterday I went to school."
        explanation = "Use the past tense after Yesterday in this example."
    else:
        corrected = text
        explanation = "This demo only checks its exact example sentence."
    return repository.save(text, corrected, explanation)
```

这里故意只匹配一个完整句子。其他输入原样返回，不代表语法正确。这样可以先检查程序连接，之后再把规则替换成经过验证的模型结果。

### 9.5 HTTP 入口：`api/app/main.py`

```python
from fastapi import FastAPI

from app import repository, service
from app.models import DiagnoseRequest, Submission

app = FastAPI(title="WeakSpot Mini")


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/diagnose", response_model=Submission)
def diagnose(request: DiagnoseRequest):
    return service.diagnose(request.text)


@app.get("/api/v1/history", response_model=list[Submission])
def history():
    return repository.list_all()
```

以 `@` 开头的是装饰器，这里把路径与处理函数关联起来。FastAPI 将 JSON 转成 `DiagnoseRequest`，调用函数，再把返回模型转成 JSON。这个练习的浏览器请求经 Next.js 同源代理转发，所以不需要额外的跨域中间件。

终端 A，执行位置 `~/projects/weakspot-mini/api`：

```bash
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

打开 [小项目 API 文档](http://localhost:8000/docs)。先试 `GET /api/v1/health`，再给 `POST /api/v1/diagnose` 提交 `{"text":"Yesterday I go to school."}`，应返回纠正后的句子和 ID。

### 9.6 手动建立最小前端

这里手工创建 Next.js 需要的文件，让你看见入口，而不是依赖生成器的默认选项。终端 B：

```bash
cd ~/projects/weakspot-mini/web
mkdir app
```

创建 **`web/package.json`**：

```json
{
  "name": "weakspot-mini-web",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.6.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "typescript": "5.7.3",
    "@types/node": "^24",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3"
  }
}
```

这里的核心前端版本与本次查阅的主仓库一致；这个本地练习不是长期的生产依赖升级方案。

创建 **`web/next.config.mjs`**：

```javascript
const nextConfig = {
  async rewrites() {
    return [{
      source: "/backend/api/v1/:path*",
      destination: "http://127.0.0.1:8000/api/v1/:path*",
    }]
  },
}

export default nextConfig
```

创建 **`web/tsconfig.json`**：

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

创建 **`web/app/layout.tsx`**：

```tsx
import type { ReactNode } from "react"

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
```

`layout.tsx` 提供所有页面外层的 HTML。`children` 表示要放进去的页面内容。接下来创建 **`web/app/page.tsx`**：

```tsx
"use client"

import { useState } from "react"

type Submission = {
  id: string
  originalText: string
  correctedText: string
  explanation: string
}

async function request<T>(path: string, body?: { text: string }): Promise<T> {
  const response = await fetch(`/backend/api/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

export default function Home() {
  const [text, setText] = useState("Yesterday I go to school.")
  const [result, setResult] = useState<Submission | null>(null)
  const [history, setHistory] = useState<Submission[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function run(analyze: boolean) {
    setBusy(true)
    setError("")
    try {
      if (analyze) {
        setResult(await request<Submission>("/diagnose", { text }))
      }
      setHistory(await request<Submission[]>("/history"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>WeakSpot Mini</h1>
      <p>Local learning demo: one rule, shared in-memory history.</p>
      <label htmlFor="writing">Write at least five words</label>
      <textarea
        id="writing"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={12000}
        rows={5}
        style={{ display: "block", width: "100%", margin: "12px 0" }}
      />
      <button disabled={busy} onClick={() => void run(true)}>
        {busy ? "Working..." : "Analyze"}
      </button>{" "}
      <button disabled={busy} onClick={() => void run(false)}>Load history</button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <section aria-label="Result">
          <h2>Result</h2>
          <p>{result.correctedText}</p>
          <p>{result.explanation}</p>
        </section>
      )}
      <h2>History</h2>
      <ul>{history.map((item) => (
        <li key={item.id}>{item.originalText} → {item.correctedText}</li>
      ))}</ul>
    </main>
  )
}
```

`"use client"` 允许这个组件使用浏览器交互和状态。`request<T>` 用类型参数描述期望的返回数据；类型提示不验证远程 JSON，因此真正的接口仍须维护输入输出合同。`try/catch/finally` 分别处理成功、失败和最后都要执行的收尾操作。

### 9.7 运行并验收小项目

终端 B，执行位置 `~/projects/weakspot-mini/web`：

```bash
pnpm install
pnpm dev
```

新项目第一次还没有锁文件，因此这里不用 `--frozen-lockfile`。启动 Next.js 后生成的 `next-env.d.ts` 是框架类型文件，不要手写修改。

打开 [小项目页面](http://localhost:3000)，依次检查：

| 操作 | 应看到什么 | 说明什么 |
| --- | --- | --- |
| 提交默认句子 | `Yesterday I went to school.` | 前后端和规则协作成功 |
| 把输入改成 `Hello there` 再提交 | 页面显示 HTTP 422 | 后端验证确实工作 |
| 恢复默认句子再次提交 | 历史多一条记录 | 本简化版没有去重 |
| 刷新网页，点击 Load history | 已保存的历史重新显示 | 浏览器状态与后端状态是两件事 |
| 重启后端，再 Load history | 历史为空 | 内存存储不能代替数据库 |

### 9.8 写第一个自动测试

创建 **`api/test_app.py`**。测试是在代码里替你发请求、检查结果，不需要打开网页：

```python
import unittest

from fastapi.testclient import TestClient

from app import repository
from app.main import app


class AppTest(unittest.TestCase):
    def setUp(self):
        repository._items.clear()
        self.client = TestClient(app)

    def test_diagnosis_is_saved(self):
        response = self.client.post("/api/v1/diagnose", json={
            "text": "Yesterday I go to school."
        })
        self.assertEqual(response.status_code, 200)
        item = response.json()
        self.assertEqual(item["correctedText"], "Yesterday I went to school.")
        self.assertEqual(self.client.get("/api/v1/history").json(), [item])

    def test_invalid_input_does_not_create_history(self):
        for payload in ({"text": "Hello there"}, {}, {"text": "word " * 3000}):
            response = self.client.post("/api/v1/diagnose", json=payload)
            self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/api/v1/history").json(), [])

    def test_unknown_sentence_is_not_claimed_as_corrected(self):
        text = "Today I enjoy learning new things."
        response = self.client.post("/api/v1/diagnose", json={"text": text})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["correctedText"], text)
        self.assertIn("only checks", response.json()["explanation"])


if __name__ == "__main__":
    unittest.main()
```

终端 C，执行位置 `~/projects/weakspot-mini/api`：

```bash
uv run python -m unittest -v
```

应看到 3 个测试通过。再在 `weakspot-mini/web` 执行：

```bash
pnpm exec tsc --noEmit
pnpm build
```

`tsc` 检查类型，`build` 检查能否生成部署用的前端。此时你已经从空目录写出了一个小型全栈应用。接下来回到主仓库学习它如何解决这个小项目尚未解决的问题。

<a id="step-10"></a>
## 10. 把临时记录变成数据库记录

数据库中的表可以类比带规则的表格：一行是一条记录，一列是一种字段。主键标识记录，外键表达记录间的关联，索引加速特定查询，事务确保一组修改一起成功或一起撤销。

真实项目的 [`schema.py`](../apps/api/app/db/schema.py) 定义表，Alembic 保存结构迁移，SQLAlchemy/psycopg 负责与 PostgreSQL 交流。`payload` 的 JSONB 列适合保存结构可变的报告细节；常用标识、时间等另有便于约束与查询的列。

返回主仓库，按第 5 章运行完整项目并提交一次诊断。终端 C，执行位置为主仓库 `apps/api`：

```bash
docker compose -f docker-compose.local.yml exec postgres psql -U weakspot -d weakspot
```

现在进入的是数据库命令行，不是 shell。输入：

```sql
\dt
\d submissions
SELECT count(*) FROM submissions;
SELECT user_id, submission_id, created_at FROM submissions ORDER BY created_at DESC LIMIT 5;
\q
```

`\dt` 看表，`\d` 看结构，`SELECT` 读数据，`\q` 退出。重启后端再查数量，记录仍在，便验证了持久化。不要把重启浏览器、重启后端和删除数据库 volume 混为一谈。

把第 9 章小项目升级为数据库应用时，按此顺序扩展：

1. 设计 `submissions` 表的 ID、原文、纠正、解释和时间字段。
2. 增加数据库连接配置和 Alembic 迁移，用迁移建立表。
3. 将 `repository.save/list_all` 的内部实现替换为数据库写入/查询，保留接口形状。
4. 增加“重启后历史仍在”的验收；模型调用结束后再进行短事务写入。
5. 加入多用户之前，先设计可信身份与所有查询中的 `user_id` 隔离。

这部分是下一阶段任务，不是只改一个 URL 就完成了数据库替换。逐步 SQL 练习见 [PostgreSQL 入门指南](POSTGRESQL_BEGINNER_GUIDE.md)。

<a id="step-11"></a>
## 11. 接入真实 AI，理解学习记忆

### 11.1 先替换模型能力，再增加其他服务

回到主仓库；只有无密钥闭环成功后才做这一节。真实调用需要你自己的服务商账号与可用额度。下面是**配置形状示例**，尖括号中的值必须替换，不是可直接执行的命令。

对于支持本项目所需结构化文本请求的 OpenAI-compatible 服务，在宿主机后端的 `apps/api/.env` 中修改：

```dotenv
USE_FAKE_AI=false
OPENAI_COMPAT_API_KEY=<your-provider-key>
OPENAI_COMPAT_BASE_URL=<provider-documented-api-base-url>
OPENAI_COMPAT_MODEL=<available-deep-model-id>
OPENAI_COMPAT_FAST_MODEL=<available-fast-model-id>
OPENAI_BUILD_WEEK_ENABLED=false
```

这些是本仓库 [`config.py`](../apps/api/app/config.py) 支持的配置名。“OpenAI-compatible”描述 API 格式，不能保证每家服务的模型、返回结构和参数完全相同。模型名称和权限以服务商当前文档及你的账号为准，不把旧文档中的名称当成可用承诺。

第一次只配置一种文本服务商。若已有 OpenRouter、OpenCode Go 或 Qwen 专用密钥，它们可能优先于通用配置；私有 Fast 模型也有独立路由。结合 [`MODEL_ROUTING.md`](MODEL_ROUTING.md) 与 `config.py` 查实际选择，不要同时填满所有示例变量。

重启后端，清除浏览器 AI 设置中的自定义服务覆盖，选择默认/Fast，用一段**新的**文本进行诊断，防止去重缓存返回旧的模拟结果。确认后端日志中的模型选择与报告；`/health` 成功不证明模型凭据有效。

### 11.2 为什么模型结果要有合同

普通聊天可以返回任意文字；网站需要 `correctedText`、`errors` 等固定字段才能显示并保存。项目通过 Pydantic 规定结果结构，并由 `ai_client.py` 处理结构化调用、解析、校验和错误。

先确保“模型输出 → 可验证数据 → 保存”可靠，再增加提示词复杂度。不要因为模型写了一句肯定的话就直接把它当作学习事实。

### 11.3 学习记忆不是把全部聊天塞回模型

| 环节 | 它解决什么问题 | 源码入口 |
| --- | --- | --- |
| 学习证据 | 区分实际错误、成功与没有观察机会 | [`learning_service.py`](../apps/api/app/services/learning_service.py) |
| 记忆写入 | 保存偏好、目标、策略、薄弱项和经历，处理合并与冲突 | [`memory_service.py`](../apps/api/app/services/memory_service.py) |
| 记忆检索 | 选择与当前任务相关的有限上下文 | 同上；[`embedding_client.py`](../apps/api/app/services/embedding_client.py) |
| 下一步决策 | 根据证据与练习历史选择练什么 | [`decision_service.py`](../apps/api/app/services/decision_service.py) |
| 可见控制 | 用户查看、修改或忘记记忆 | [`memory/page.tsx`](../apps/web/app/memory/page.tsx) |

默认设置最多检索 6 条记忆，700 个估算 token 的预算再保留 15% 余量；文本聊天仅保留有限的近期消息作为上下文。token 可以先理解为模型处理文本的计量单位，它不等于字符数或词数。没有 embedding 服务时可以退回词面匹配；模拟 AI 也跳过真实向量调用。

练习：在 `/memory` 添加一条偏好，例如“请先解释最影响理解的一个问题”；预览检索结果，然后执行忘记，再预览。检查活跃上下文是否变化。模拟 AI 模式可验证记录与检索流程，不能验证真实模型是否遵循该偏好。

真实语音、TTS、电子书翻译和专用 Coach 规划还有各自的设置、权限与模型要求。它们不是启动基本诊断所需的前置条件，按 [后端文档](../apps/api/README.md) 分别接入。

<a id="step-12"></a>
## 12. 修改功能、测试和保存版本

### 12.1 做一个看得见的小改动

执行位置：主仓库根目录。先看工作区，保留自己和他人已有的修改：

```bash
git status
git switch -c codex/beginner-first-change
```

branch 是一条独立的版本记录线；创建分支不会清除当前未提交的修改。若分支名已存在，换一个名称。

在 [`apps/web/lib/i18n.ts`](../apps/web/lib/i18n.ts) 搜索 `Analyze my English`，修改对应按钮文案并检查中英文界面。不要一次性替换所有 `analyze` 字段。保持前端运行，保存文件，观察热更新，然后检查差异：

```bash
git diff -- apps/web/lib/i18n.ts
```

### 12.2 选择与修改相关的检查

后端检查，执行位置 `apps/api`：

```bash
uv run --frozen python -m scripts.smoke_test
```

这是离线 smoke test：检查应用导入、接口/模型合同等，不需要运行后端服务器或连接真实模型。

需要验证数据库业务流程时，先确保本地 PostgreSQL 启动，再执行：

```bash
DATABASE_URL=postgresql+psycopg://weakspot:weakspot@127.0.0.1:5432/weakspot_test \
  USE_FAKE_AI=true uv run --frozen python -m scripts.integration_test
```

它会重置专用测试库内的应用数据。这里只能使用本地、名字以 `_test` 结尾的可丢弃数据库；不要改成手动练习的 `weakspot` 或生产 URL。该命令里的变量只影响这一次运行，不会改写 `.env`。

前端检查，执行位置 `apps/web`：

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test:chat-import
pnpm test:realtime-transcript
pnpm test:timeouts
pnpm build
```

lint 检查代码规范，tsc 检查类型，专用脚本检查对应行为，build 验证生产构建。当前主项目的 `next.config.mjs` 配置了 `ignoreBuildErrors: true`，所以 **build 成功不能替代单独的 TypeScript 检查**。更完整的选择见 [LOCAL_TESTING.md](../LOCAL_TESTING.md)。

### 12.3 保存一次修改

执行位置：主仓库根目录。确认只提交自己的改动：

```bash
git status
git diff
git add apps/web/lib/i18n.ts
git diff --cached
git commit -m "docs(ui): clarify analyze button wording"
```

`add` 将指定文件加入暂存区，`commit` 保存本地版本，`push` 才会上传远端。首次 commit 若提示身份未配置，按 Git 提示为当前仓库设置你选择的 `user.name`、`user.email`。先学会本地提交即可；没有原仓库写权限时，通过自己的 fork 和 Pull Request 贡献。

<a id="step-13"></a>
## 13. 从本地运行走向上线

部署就是把程序放到其他人也能访问的运行环境，并为它配置域名、HTTPS、身份、数据保存和维护方式。`pnpm dev` 与 `uvicorn --reload` 是开发命令，不是本项目的生产部署方案。

当前仓库描述的部署拓扑是 Next.js 前端在 Vercel，FastAPI 与 PostgreSQL 16 在同一台 Oracle Cloud 服务器的 Docker 中运行，Nginx/HTTPS 提供 API 入口。这里说明配置设计，不代表本文重新验证了线上服务状态。RDS、DynamoDB 和早期 Alibaba 源站文档属于历史路径。

从零准备你自己的部署时，按以下顺序完成，每步都有验收点：

| 顺序 | 工作 | 通过条件 |
| --- | --- | --- |
| 1 | 准备 Linux 主机、域名、Docker/Compose、Nginx、TLS 工具 | 能登录自己的服务器，确认对应 Linux 发行版的安装方式 |
| 2 | 下载代码，参考 `deploy/.env.production.example` 填写服务端配置 | 数据库密码、会话密钥为独立随机值；模拟 AI 关闭 |
| 3 | 按当前 runbook 启动私有数据库、执行迁移、启动 API | 服务器本地 `/api/v1/health/ready` 返回 ready |
| 4 | 配置自己的 API 域名、Nginx 和 HTTPS | 浏览器可访问 HTTPS 健康接口 |
| 5 | 在 Vercel 导入自己的仓库，Root Directory 设为 `apps/web` | 前端能完成构建 |
| 6 | 设置前端 `NEXT_PUBLIC_API_BASE_URL` 为自己的 HTTPS API 基地址，再部署 | 浏览器请求发往自己的后端；地址不重复追加 `/api/v1` |
| 7 | 设置精确的 CORS 来源、前端 URL、OAuth 回调与 cookie 配置 | 登录后的身份保持一致，访问他人的数据被拒绝 |
| 8 | 验证诊断、历史和练习；配置备份并演练恢复 | 新记录重启后仍在，备份确实可恢复 |

前端公共环境变量会参与构建，修改后要重新构建部署。[Next.js 环境变量说明](https://nextjs.org/docs/app/guides/environment-variables)

具体命令与模板以 [后端部署说明](../apps/api/DEPLOY.md) 和 [当前本机 PostgreSQL 生产 runbook](LOCAL_POSTGRESQL_PRODUCTION.md) 为准。后者包含现有系统的迁移章节；全新部署不需要执行旧 RDS 数据迁移。生产数据库在 Compose 私有网络中，URL 的主机名通常是 `postgres`，不是本地开发的 `127.0.0.1`；不要对公网开放 5432。

本地示例密码和会话值只适合学习。生产应配置自动备份，并保留异地副本；同一服务器上的备份无法覆盖整台主机或磁盘丢失。这一章是上线路线，实际操作前先完成本地验收，再逐项使用上述部署文档。

<a id="step-14"></a>
## 14. 遇到错误时怎么排查

按依赖顺序检查：**工具可用 → Docker 可用 → PostgreSQL healthy → 迁移成功 → API ready → 前端地址正确 → 业务请求成功**。先看出错命令的最后几行，以及后端 traceback 的末尾，不要同时修改所有配置。

| 现象 | 首先检查 | 处理方式 |
| --- | --- | --- |
| `command not found` | 当前终端能否找到 node/pnpm/uv | 完成安装并重新打开终端；WSL 内重新检查 |
| npm 全局安装 `EACCES` | Node 安装位置与权限 | 使用自己用户下的 nvm 安装 Node；不要反复给项目目录乱改权限 |
| `Cannot connect to Docker daemon` | Docker Desktop 是否运行 | 启动引擎；WSL 检查 Ubuntu 集成 |
| Docker socket `permission denied` | 当前用户的 Docker 权限 | 按对应系统的官方安装后配置修复，不要把 socket 改成任意人可写 |
| 5432 或 8000 被占用 | 是否已有本机数据库/另一种后端启动方式 | 停止你自己启动的重复服务；不要随意终止不认识的进程 |
| 数据库容器 unhealthy | `docker compose -f docker-compose.local.yml logs --tail=80 postgres` | 查看启动错误，确认端口、磁盘空间和已有 volume 的初始化配置 |
| 数据库密码失败 | volume 是否来自之前的另一套账号 | 使用该 volume 原来的配置；改 Compose 密码不会重建已有数据库用户 |
| `/health` 正常，`/health/ready` 503 | `DATABASE_URL` 和 PostgreSQL 状态 | 确认使用宿主机 URL，并在 `apps/api` 启动 API |
| `relation ... does not exist` | 表结构是否创建 | 在正确数据库上执行 `uv run --frozen alembic upgrade head` |
| 页面显示报告，后端没有请求 | API 地址是否为空 | 设置 `.env.local` 为 `/backend`，重启前端 |
| `Failed to fetch` / 代理 502 | API 是否运行在 8000 | 先打开 ready 接口，再检查 Network、API 和前端日志 |
| `/api/v1/api/v1` 或 404 | 是否把 API 前缀重复写入配置 | 本地基地址只填 `/backend` |
| HTTP 422 | Response 中具体哪个字段失败 | 检查字段、最少词数、字符上限；无需重新安装项目 |
| HTTP 429 | 是否触发游客/用户限额 | 本地改 `GUEST_DAILY_LIMIT` 后重启；生产按其限额使用 |
| 历史突然为空 | 是否换了 cookie、主机名或模式 | 使用同一浏览器地址；确认仍连接同一个本地数据库 |
| 改了 key 仍返回固定内容 | fake AI、容器环境或重复文本缓存 | 关闭实际运行进程的 fake AI，重启，换一段新文本 |
| `pnpm install --frozen-lockfile` 失败 | package.json 与锁文件是否配套 | 先查看 Git 差异；不要删锁文件掩盖问题 |
| 构建时字体下载失败 | 前端日志中的外部资源地址 | 检查网络/代理；这是构建资源问题，不是数据库问题 |

需要求助时，提供：操作系统、执行目录、完整命令、报错最后几行、预期行为。对密钥、数据库密码、cookie 和真实用户文本进行遮盖。不要直接粘贴整个 `.env`。

<a id="step-15"></a>
## 15. 学习顺序、自测与继续阅读

### 15.1 按成果推进

| 阶段 | 阅读与练习 | 完成证据 |
| --- | --- | --- |
| 第一次接触 | 第 1–4 章 | 能解释前后端，独立找到项目目录并检查工具 |
| 第一次运行 | 第 5–6 章 | 无密钥模式下有报告、真实请求和持久化历史 |
| 第一次写代码 | 第 7–9 章 | 小项目成功运行，3 个自动测试通过 |
| 第一次理解数据 | 第 8、10 章 | 能沿请求找到保存位置，用 SQL 读出记录 |
| 第一次接真实能力 | 第 11 章 | 能区分模拟数据、模拟 AI 和真实模型结果 |
| 第一次交付修改 | 第 12 章 | 有可解释的 diff、相应检查和本地 commit |
| 第一次考虑上线 | 第 13–14 章 | 能说明配置差异、备份恢复和故障排查顺序 |

每阶段可以分多天完成。先做到能解释自己刚运行的命令，再增加功能。

### 15.2 自测与答案

1. **能打开页面，能否证明数据库连接成功？**不能。页面可能使用前端 mock；继续检查 ready 接口和真实业务写入。
2. **设置 `USE_FAKE_AI=true` 后还要不要数据库？**主项目需要，它只替换模型结果，不替换存储。
3. **为什么要运行迁移？**数据库服务启动并不等于业务表已存在，迁移维护表结构版本。
4. **为什么修改 React state 后页面会更新？**状态变化触发组件重新渲染；普通变量变化没有同样的状态管理作用。
5. **小项目重启后历史消失，主项目却保留，为什么？**前者用进程内列表，后者用带持久卷的 PostgreSQL。
6. **能把模型 Key 放进 `NEXT_PUBLIC_API_KEY` 吗？**不能。该前缀面向浏览器公开，服务端密钥留在后端。
7. **模型没有指出某个错误，是否等于已经掌握？**不等于。还要考虑任务是否提供观察机会，以及是否有可验证成功证据。
8. **`pnpm build` 通过是否保证本项目类型正确？**不能。当前主仓库必须单独运行 `pnpm exec tsc --noEmit`。

### 15.3 后续阅读顺序

- [项目代码导读](PROJECT_CODE_WALKTHROUGH_ZH.md)：找具体函数和调用关系。
- [PostgreSQL 入门](POSTGRESQL_BEGINNER_GUIDE.md)：练习数据设计、SQL 和事务。
- [中文开发笔记](../development.md) / [英文开发笔记](../development.en.md)：补充 Python、React、工程机制的详细解释；部署部分对照当前 runbook。
- [MemoryAgent 设计](MEMORY_AGENT_DESIGN.md)：深入记忆生命周期、检索、遗忘与评估。
- [架构](ARCHITECTURE.md) 和 [本地测试](../LOCAL_TESTING.md)：理解完整系统与回归验证。

后续扩展小项目的顺序可以是：PostgreSQL → 身份与用户隔离 → 真实结构化 AI → 学习记录和练习 → 有界记忆 → 部署。每次只加一层，保留一个成功例子和一个失败例子来验证边界。

### 15.4 本次文档核验范围

已检查两版的章节对应、相对链接、命令语法和相同的教学代码；从文档提取的小项目通过了 3 项后端测试、TypeScript 检查与 Next.js 生产构建，主项目离线 smoke test 也已通过。这些执行使用本机现有依赖，不等同于在 macOS、Windows、Linux 上逐一进行全新安装；完整项目的 PostgreSQL 联调、真实模型调用和云部署未在本次文档更新中重新执行。
