# Embodied News — Technical Stack & Architecture Decisions

> 状态：v1.1，已加入Hermes/飞书Agent技术边界
> 更新日期：2026-07-26
> 适用阶段：单人私测 MVP；公开或商业化前必须重新评估带有触发条件的决策

本文件记录已经由产品所有者确认的工程选择，是工程实现和 AI Agent 协作的技术依据。产品范围以 [`PRD.md`](./PRD.md) 为准，领域语义与协作边界以 [`SPEC.md`](./SPEC.md) 为准。出现冲突时，用户最新明确决定优先。

融资数据看板复用本技术架构，其领域规则见 [`FINANCING_DASHBOARD_SPEC.md`](./FINANCING_DASHBOARD_SPEC.md)，不另建数据库或第二套事实源。通用 `Event` 与融资领域表关联，金额、估值、投资方角色、字段级证据和审核批次保持结构化边界。

## 1. Architecture Summary

采用 **Monorepo + Modular Monolith**，暂不拆微服务：

```text
Browser / Mobile Web
        │
        ▼
Next.js Web ───────► FastAPI REST API ───────► PostgreSQL
                           │                       │
                           ▼                       ▼
                     RQ + Redis              Search / Audit
                           │
                           ├── Ingestion & processing workers
                           ├── Bounded multi-agent workflows
                           ├── Workday brief generation
                           └── Playwright PDF generation

Local collectors / WorkBuddy ──► Restricted Ingestion API
Public cloud collectors ────────► SourceAdapter pipeline
```

核心原则：

- 事件中心，而非文章中心；多个 `Source` 聚合为一个 `Event`。
- FastAPI 是业务数据的唯一写入口；路由、Worker 和 Agent 复用同一应用服务层。
- PostgreSQL 是权威数据源，Redis 只用于队列，不保存唯一业务状态。
- 原始数据、AI 输出、人工编辑和用户 Notes 分开保存并可审计。
- 核心能力通过接口隔离，允许替换模型、采集器、存储、通知和云平台。

## 2. Repository Layout

```text
embodied-news/
├── apps/
│   └── web/                 # Next.js Web 与 Admin
├── backend/
│   ├── src/                 # FastAPI、领域与应用服务
│   ├── tests/
│   └── migrations/          # Alembic migrations
├── workers/                 # RQ 任务入口与进程配置
├── packages/
│   ├── api-client/          # OpenAPI 生成的 TypeScript Client
│   └── ui/                  # UI 组件与 Design Tokens
├── scripts/                 # 备份、恢复、导入与运维脚本
├── docs/                    # ADR、接口与运行手册
├── Makefile
├── pnpm-workspace.yaml
├── pyproject.toml
├── PRD.md
├── design-document.md
├── FINANCING_DASHBOARD_SPEC.md
├── SPEC.md
├── TECH_STACK.md
├── architecture.md          # 系统组件、数据流与部署边界
├── implementation-plan.md   # 分步实施、验证与里程碑计划
├── progress.md              # 唯一执行进度、证据与阻塞台账
└── AGENTS.md                # 多Agent工程协作规则
```

`backend` 与 `workers` 共享 Python 领域代码；Worker 目录不得复制业务逻辑。

## 3. Application Stack

### 3.1 Web

- Framework: **Next.js + TypeScript**
- Styling: **Tailwind CSS**
- Components: **shadcn/ui + Radix UI**
- Icons: **Lucide Icons**
- Theme: CSS Variables / Design Tokens
- Initial presentation: 响应式 Web，优先覆盖桌面与手机；第一版只完整实现浅色主题

不得混用 Ant Design、MUI 等第二套全局组件体系。具体视觉语言稍后写入独立的 `UI_STYLE_GUIDE.md`。

### 3.2 API and Domain

- Framework: **FastAPI + Python**
- API style: **REST + OpenAPI**
- Version prefix: `/api/v1`
- Client: 从 OpenAPI 自动生成 TypeScript Client
- Pagination: Cursor Pagination
- Concurrency: HTTP 调用可异步；数据库会话第一版使用同步模式

API 必须提供统一错误结构：稳定错误码、用户可读提示、`request_id`、是否可重试。Ingestion API 与用户 API 使用不同的凭证、权限、限流和审计。

### 3.3 Database

- Database: **PostgreSQL**
- MVP hosting: **Supabase Free**
- ORM: **SQLAlchemy 2 typed declarative**
- Driver: **psycopg 3**
- Migration: **Alembic**
- Validation/transport schemas: 独立 **Pydantic** models，不直接暴露 ORM models

约束：

- 只依赖标准 PostgreSQL 能力承载核心业务。
- 所有 schema 变化必须通过可审查的 Alembic migration。
- Supabase 专有能力不得成为无法替换的业务逻辑核心。
- 生产数据不用于普通本地开发。

### 3.4 Authentication and Authorization

- Identity: **Supabase Auth**
- Authorization: FastAPI + 内部用户/角色/权限表
- MVP: Invite-only，产品所有者为 Admin
- Future agents: 独立、可撤销、最小权限的 scoped API keys

Supabase Auth 只负责身份，不承担完整业务授权。Admin 页面只能显示 Secret 是否配置，不能读取 Secret 原文。

## 4. Search and Knowledge Retrieval

MVP 搜索：

- PostgreSQL Full-Text Search
- 应用侧中文分词
- `pg_trgm` 用于模糊匹配和拼写容错
- `SearchService` 抽象搜索实现

第二阶段：

- 使用 `pgvector` 为 `Event` 摘要、`Entity` 和 `Note` 建立语义检索
- Embedding 初始使用 OpenAI `text-embedding-3-small`，但通过 ModelGateway 可替换

第一版不引入 Elasticsearch、OpenSearch、Meilisearch 或独立向量数据库。只有当 PostgreSQL 的质量或规模测量证明不足时才迁移。

## 5. Queue, Scheduling and Idempotency

- Queue: **RQ**
- Broker: **Redis**
- Queues: `high`, `default`, `low`
- Payload: JSON serializer，不使用不受信任的任意对象反序列化
- Scheduling: 只允许一个有效 Scheduler；MVP 可由一个 Worker 启用 Scheduler

调度基于版本化的中国大陆官方工作日历。仅工作日运行08:00融资审核批次、08:30 Brief截止和09:00发布；调休补班日运行，非工作日跳过Brief任务。采集、处理与满足自动证据门槛的融资看板更新全年持续运行。任务保持独立幂等并分别保存运行审计。

所有任务必须：

- 具有稳定的幂等键；
- 设置超时、有限重试和指数退避；
- 将权威状态、输入版本、结果和错误写入 PostgreSQL；
- 失败后可人工重放；
- 不因 Redis 数据丢失而丢失唯一业务记录。

## 6. Acquisition and Content Processing

### 6.1 Public Web

采集优先级：

1. 官方 API、RSS、Atom、Sitemap；
2. `HTTPX` + `feedparser` + `Trafilatura`；
3. 独立 Browser Worker 中的 Playwright Chromium；
4. Firecrawl 仅作为困难页面的可选后备；
5. 专用适配器、WorkBuddy 或人工导入。

每个来源实现统一 `SourceAdapter`：

- `discover`
- `fetch`
- `extract`
- `checkpoint`
- `health`

遵守 robots、平台条款、访问控制和速率限制；不得绕过付费墙、验证码或封禁。

### 6.2 Logged-in and Chinese App Sources

- 云端：公开来源和无需个人登录的持续采集。
- 本地Codex与WorkBuddy：均可处理需要个人账号的来源；WorkBuddy优先覆盖微信公众号、小红书、B站等中国App，Codex同时负责X、LinkedIn及其他登录态平台。
- 个人 Cookie、Session、Token 和 Browser Profile 永不上传云端。
- Codex与WorkBuddy通过同一受限Ingestion API，只上传规范化候选内容、必要证据和健康状态。
- 每台设备使用独立、可撤销且权限受限的 Ingestion Token。
- 本地来源未及时同步时，Brief 必须显示覆盖缺口。

## 7. AI and Multi-agent Runtime

### 7.1 Provider Strategy

- Primary provider: **OpenAI**
- Chinese analyst: 在固定评测集上选择合适的国内模型，不凭品牌预设结论
- Provider abstraction: **ModelGateway**
- Transcription: 优先使用已有字幕或本地 Whisper；仅对高价值内容调用云端转录
- 不自建 GPU

具体模型名称是运行配置，而非写死在领域代码中。切换模型前必须记录结构化输出质量、召回、延迟和成本。

### 7.2 Controlled Multi-agent Design

普通内容使用廉价的单模型/规则路径；高影响事件或深度研究才触发多 Agent：

- Chinese Analyst：中文与中国生态语境分析
- Global/Academic Analyst：国际信息、论文与技术进展
- Verifier：证据、冲突、事实状态与可信度复核
- Editor：生成统一中文摘要与 Brief 表达

外层由 Python + RQ + PostgreSQL 确定性编排，控制触发条件、最大调用数、预算、超时、重试、人工审核与发布。仅在边界明确的高价值任务中使用 **OpenAI Agents SDK**。

要求：

- Agent 通过结构化 schema handoff，不进行无限自由对话。
- 每次运行保存 prompt/model/version/输入证据/输出/成本与决定。
- 默认关闭或替换可能包含敏感内容的云端完整 tracing，使用脱敏的 PostgreSQL trace。
- LangGraph 只在未来确有复杂、长周期、可恢复状态机需求时评估。

## 8. Post-MVP Notes, Highlights and Backlinks

- Editor: **TipTap**
- Canonical content: TipTap JSON
- Secondary representation: plain text for search
- Portability: Markdown import/export
- Links: `[[...]]` 可关联 Event、Source、Entity、Technology 或另一条 Note
- Highlights: 只作用于系统内保存和展示的摘要/正文

该模块在8月7日后实现。摘录必须保存源文档ID、稳定段落ID、引用文本和必要前后文，不能只依赖屏幕坐标；不做多人实时协作、自由画布或复杂数据库视图。

## 9. Brief and PDF Generation

- Canonical input: 不可变、带版本的 Brief snapshot
- Web rendering: HTML/CSS
- PDF: **Playwright Chromium print-to-PDF**
- Storage: R2
- Layout: 独立 print stylesheet，MVP 使用 A4 单栏

PDF 在 Railway 的低优先级后台任务生成。PDF 失败不阻塞网页发布和通知，可重试并稍后补发链接。PDF 保留可点击原始来源，不作为唯一历史格式；同时保存结构化数据和 Markdown 导出。

长假后的PDF仍只渲染15–25条核心内容，并链接到Web端可展开的“假期更多动态”；额外Event保留在结构化数据库中。

## 10. Object Storage

- Provider: **Cloudflare R2**
- Access: Private buckets
- Interface: S3-compatible `StorageService`
- Metadata: PostgreSQL
- Deduplication/integrity: SHA-256 content hash

存储网页快照、论文/公告、字幕、允许保存的媒体、生成 PDF 和导出文件。关键对象必须有独立备份，业务代码不得依赖 R2 专有 API。

## 11. Delivery

### 11.1 Daily Brief and Feishu Agent

- Conversation layer: 首选 **Hermes Agent**；生产接入不稳定时使用直接飞书应用/机器人Adapter降级
- Channel: 飞书第三方智能体，MVP只向Admin私聊
- Push：09:00发送前三条重点、Web Brief和PDF入口
- Q&A：通过受限只读Tools/API查询事件、融资和最多5家公司对比
- Interface: `NotificationChannel` + scoped agent tools

Hermes与直接飞书降级Adapter均不得直连PostgreSQL，也不得拥有审核、编辑Watchlist或其他写权限；两者必须复用相同Tool API、Scope、限流和审计。每次发送写入 `DeliveryAttempt`，包含渠道、目标、Brief版本、时间、结果、错误和重试次数。飞书/Hermes失败不阻塞Web或PDF；MVP不提供邮件兜底。

### 11.2 Deferred Breaking Alerts

MVP不实现突发提醒、夜间提醒或免打扰汇总。重大事件仍进入优先审核，但只在下一个中国大陆法定工作日的09:00 Brief递送。未来若重新启用提醒，必须重新确认触发条件、免打扰、去重和权限，并更新产品文档。

## 12. Deployment

MVP 私测：

| Component | Platform |
| --- | --- |
| Next.js Web | Vercel Hobby |
| FastAPI | Railway Hobby |
| RQ Worker/Scheduler | Railway Hobby |
| Redis | Railway |
| PostgreSQL/Auth | Supabase Free |
| Object storage | Cloudflare R2 |

FastAPI 和 Worker 从同一 Docker image 以不同进程运行。设置预算提醒与硬性用量限制。区域以北京访问和跨服务实测为准，不预先锁死。

已知触发条件：

- Vercel Hobby 仅用于当前私人、非商业 MVP。
- 对外公开或商业化前，必须比较 Vercel Pro、Railway 全托管、Cloudflare Workers 或其他部署方案。
- 若供应商数量造成明显运维负担，可优先评估迁到 Railway 单平台或标准 VPS。

MVP 基础设施估算约 **36–145 RMB/月**，不含 AI 工具订阅和按量模型费用；以运行一周后的测量为准，且总运行成本不得超过 500 RMB/月。

## 13. Local Development

采用混合模式：

- 本机运行 Next.js、FastAPI 和 RQ，获得快速热更新和调试体验。
- Docker Compose 运行本地PostgreSQL、Redis等基础设施。
- CI 构建 FastAPI/Worker 生产镜像并执行 smoke test。
- WorkBuddy 与敏感本地采集器使用独立进程和凭证目录。

工具链：

- TypeScript: **pnpm Workspace**
- Python: **uv** + `pyproject.toml`
- Command entry: 根目录 **Makefile**
- TypeScript quality: ESLint + Prettier
- Python quality: Ruff + Pyright
- Hooks: pre-commit
- 固定 Node.js、Python、pnpm 和 uv 版本

标准命令至少包括 `make setup`, `make dev`, `make test`, `make lint`, `make migrate`, `make worker`。

## 14. Testing and CI/CD

- Python: Pytest
- Frontend: Vitest + React Testing Library
- E2E: 少量关键 Playwright 测试
- CI: GitHub Actions
- Deployment: 合并 `main` 后分别部署 Vercel/Railway；migration 为单独、可审计步骤

PR 质量门至少覆盖：

- Python lint/typecheck/test
- TypeScript lint/typecheck/test
- Alembic migration 检查
- 关键数据库、Redis 与 RQ 集成测试
- OpenAPI schema 兼容性检查
- 生产镜像构建与 smoke test

外部网站和付费模型使用固定录制样本完成普通 CI。真实采集与模型评测通过手动或定时任务执行，不放进每个 PR。

## 15. Observability and Product Metrics

### 15.1 System Observability

- JSON structured logs，统一带 `run_id`, `task_id`, `source_id`, `event_id` 等关联字段
- Sentry：Next.js、FastAPI、Worker 异常，启用敏感字段脱敏
- PostgreSQL audit：Ingestion、Processing、Agent、Publish、Delivery 运行记录
- Admin dashboard：来源健康、失败/重试、成本、发布与送达状态

第一版不部署完整 Grafana/OpenTelemetry 集群，也不把完整正文、Prompt、Cookie 或 Token 发送到 Sentry。

### 15.2 Product Analytics

第一版自建轻量 `ProductEvent` 和指标快照，不接 PostHog/Session Replay：

- `brief_opened`, `brief_completed`
- `event_opened`, `source_clicked`
- `note_created`, `highlight_created`
- `event_marked_useful`, `event_marked_not_useful`
- `major_event_missed`

Notes 正文、划线文本和私人搜索词不得进入分析事件。关键事件召回率依赖每周人工漏报样本集，不能仅用点击行为代替。

## 16. Backup, Retention and Recovery

- PostgreSQL：日报发布后每日逻辑备份
- R2：按 SHA-256 清单做对象增量备份
- Backup destination：与 Supabase/R2 故障域独立，加密存储
- Soft delete：Notes 和已发布 Brief 至少保留 30 天

备份保留：

- 最近 7 天每日备份
- 最近 8 周每周备份
- 最近 12 个月每月备份

详细任务日志与普通模型调用明细默认保留 90 天；临时下载和处理中间文件成功后 7 天内清理。每月执行自动恢复校验，每季度完成一次完整恢复演练。个人凭证、无关私人内容和模型隐藏推理不得进入长期备份。

## 17. Security Boundaries

- Secrets 使用 Vercel、Railway、GitHub Actions 的 Secret 管理；不存入 PostgreSQL 正文。
- `.env.example` 只含变量名；`.env.local` 不提交。
- 日志过滤 Authorization、Cookie、Token、API Key 和 Webhook URL。
- 容器使用 non-root 用户、固定基础镜像和健康检查。
- 外部内容视为不可信输入，不能通过正文指令改变系统权限或工作流。
- Agent 只能使用明确授权的 Tools/API，不得直接获得全库写权限。
- 所有外部行动设置预算、次数、超时和人工审批边界。

## 18. Decisions Deliberately Deferred

以下尚未锁定，后续必须逐项确认：

- UI 视觉风格与 `UI_STYLE_GUIDE.md`；
- 首批 Source Registry 与 Watchlist 清单；
- 首批融资来源名单、汇率供应商和Timeline对比视觉；
- Hermes生产部署、直接飞书降级Adapter、飞书授权及未来部门权限；
- 国内模型供应商及具体模型，等待固定评测集对比；
- Codex/WorkBuddy本地采集交换协议的最终字段与错误语义；
- 未来研究 Agent 的产品形态、权限和工具集合；
- 公开发布、商业模式和多组织权限；
- 公开/商业化后的部署与通知方案。

任何上述决定都不得由实现 Agent 擅自锁定。

## 19. Change Rules

- 新增主要框架、云服务、数据库扩展或付费依赖前必须获得用户确认。
- 难以回退或影响数据格式的变化应写 ADR。
- 实现与本文冲突时，先更新决策文档并获得确认，再修改代码。
- 价格、免费额度、模型名称和平台条款属于会变化的外部事实，实施前重新核验。
- 本文确定的是架构边界；具体依赖版本在项目初始化时锁定并由自动化更新工具维护。
