# 具身智能公司动态雷达 — 只读架构 / 契约 / 安全 / 实现缺口审查

审查日期：2026-08-05
审查范围：`/Users/ruoheliu/Documents/embodied-news-4Galbot`（本次未修改任何文件、未执行 Git 操作、未调用真实外部服务）
审查基线：`AGENTS.md`、`architecture.md`、`PRD.md`、`SPEC.md`、`TECH-STACK.md`、`implementation-plan.md`、`agent-coordination.md`、`docs/agent-working-agreement.md`、`main-agent-handoff.md`、`progress.md`、`search-strategy.md`、`domestic-website-search-list.md`、`docs/pilot/codex-daily-capital-search-task.md`

> 结论先行：项目自身文档（`SPEC.md` §5.7、`implementation-plan.md` D06、`main-agent-handoff.md`、`progress.md` 2026-08-04 记录）已经明确、诚实地把周报标记为“目标契约，尚未实现”。本次代码审查确认这一自我评估是**准确的**：周报在代码层面完全不存在（0 处 `weekly`/`Weekly`/`weekStart` 引用），现有 DailyDigest、飞书“日报”表、通知模板和路由体系是按单日语义实现的历史兼容能力，migrations 尚未开始。本报告不会、也不应把 DailyDigest 现状报告为周报功能已完成。

---

## 0. 三层区分（先建立坐标系，避免误读下文）

**A. 文档中记录的目标行为（尚未实现）**
- `WeeklyReport` 领域契约（`SPEC.md` §5.7：“目标契约，尚未实现”）。
- `Asia/Shanghai` 自然周（周一 00:00–周日 23:59:59）窗口、次周一生成发布（`SPEC.md` §11.3、`implementation-plan.md` D06）。
- `/weekly/[weekStart]` 路由、历史归档、前后周导航（`SPEC.md` §13.1）。
- 原始线索清洗 → URL 规范化 → 疑似同事件分组 → 用户核验的自动化决策树（`search-strategy.md` §7：“详细决策树仍需在后续专项对齐中冻结”）。
- 两周人工基准召回率的记录与计算（`PRD.md` §3.2、`search-strategy.md` §9）。

**B. 当前已实现且有测试覆盖的行为**
- A01–A06、B01–B06、C01–C09、D01–D04、D05.1（离线）：领域 Schema、飞书客户端/Repository/CLI 骨架、WorkBuddy 兼容导入、OpenAI 候选处理（相关性/抽取/公司归一化/事件去重/置信度摘要）、飞书候选审核视图、审核转正式事件、单日日报生成、飞书个人通知。均使用 Mock/Fixture 测试，未访问真实外部服务（`progress.md` 逐节验证记录与本次代码抽查一致）。

**C. 历史兼容实现（不是当前主链路，不得被当作“已完成的周报/搜索能力”）**
- `DailyDigest`、飞书“日报”表（`daily_digests`）、`/daily` 语义的通知文案、`workbuddy-import`／`openai-discover` CLI 命令。这些代码存在且测试通过，但按 `AGENTS.md` §3、`architecture.md` §9.18–9.20、9.30 明确定性为“暂停”或“待迁移”的兼容层，不代表周报或当前发现主链路已完成。

---

## 1. P0 发现

### P0-1　没有任何调度/自动化基础设施，架构文档所述的定时任务保护措施全部不存在
- **文件**：仓库根目录（`.github/workflows/` 不存在；`Glob(".github/workflows/*.yml")` 返回 0 个文件）
- **触发条件**：任何人尝试按 `architecture.md` §5、§9.8、`SPEC.md` §14.2 描述的方式让系统“无人值守”运行。
- **影响**：`architecture.md`、`SPEC.md`、`TECH-STACK.md` 反复强调的核心安全边界——“周期检查 + 状态表 + 幂等键”“暂停的发现路径不能通过调度意外运行”——目前无法被违反，**只是因为调度本身不存在**，而不是因为有代码在主动拦截它。`lib/domain/automation-run.ts` 定义了 `AutomationRun` 类型和 7 种 `jobType`，但仓库中没有任何文件读取、写入或消费该类型（`Grep "AutomationRun|automation_runs"` 命中的 5 个文件全部是类型/Schema 定义，没有服务或调度器）。这意味着“暂停能力不能被意外调度触发”这条安全声明目前是**真空成立**，一旦有人添加 workflow 文件，没有任何既有代码会强制执行“暂停路径拒绝运行”的门禁。
- **建议方向**：在实现 GitHub Actions 调度前，先实现一个显式的 `AutomationRun` Repository + 调度守卫服务，硬编码拒绝 `DISCOVER_OVERSEAS`（当前暂停）类任务在没有人工授权标记时被执行；调度 workflow 首个版本必须包含该守卫的单元/集成测试，而不是仅靠“没人配置 cron”来保证安全。
- **缺失/需要的测试**：调度守卫拒绝暂停 `jobType` 的单测；`workflow_dispatch` 手动触发暂停任务时同样被拒绝的测试；`AutomationRun` 幂等键（`businessDate + jobType`）唯一性测试。

### P0-2　`discoveredBy` 来源标注在实际执行路径上是错误的，构成正式数据溯源污染
- **文件**：`lib/providers/workbuddy/importer.ts:47`（类型字面量 `discoveredBy: "WORKBUDDY"`）与 `lib/providers/workbuddy/importer.ts:111`（写死赋值 `discoveredBy: "WORKBUDDY"`）；根因在 `lib/domain/common.ts:34`（`discoveryTools = ["WORKBUDDY", "OPENAI", "MANUAL"]`，没有代表 “Codex Research Operations 网站搜索” 的取值）。
- **触发条件**：`main-agent-handoff.md` §4 步骤 4 明确写着当前真实候选批次的导入入口是 `pnpm cli -- workbuddy-import <候选 JSON 文件路径>`——即 2026-08-04 之后，Codex Research Operations 网站搜索产生、用户核验通过的线索，仍然通过 C01/C02 “WorkBuddy 兼容格式”写入飞书候选表。任何这样写入的候选，`discoveredBy` 字段都会被硬编码为 `"WORKBUDDY"`。
- **影响**：这与 `AGENTS.md` §3、`architecture.md` §3.1（“WorkBuddy 已暂停…既有 C01/C02 文件与 CLI 仅作为兼容入口保留，不是现行发现主链路”）直接矛盾——飞书正式候选记录会永久性地错误声称其发现工具是已暂停的 WorkBuddy，而不是实际执行搜索的 Codex Research Operations。这不是文案问题：`discoveredBy` 是审核、复盘、召回率统计（见 P1-8）都会引用的溯源字段，错误标注会污染两周召回率基线的数据来源统计，并让未来审计无法区分“真正来自已暂停 WorkBuddy 的历史候选”和“来自当前 Codex 网站搜索的候选”。
- **建议方向**：在 `common.ts` 的 `discoveryTools` 枚举中新增能代表当前主链路的取值（例如 `CODEX_RESEARCH`），并让 C02 导入路径按调用方显式传入的发现工具赋值，而不是硬编码 `"WORKBUDDY"`；同时评估是否需要为“网站搜索线索经用户核验后走 C01/C02 兼容格式导入”这一现状单独建一条不复用 WorkBuddy 命名空间的候选 ID 前缀（当前 `createCandidateId` 生成 `candidate-wb-*`，见 `importer.ts:96`，同样带有 WorkBuddy 命名空间烙印）。
- **缺失/需要的测试**：导入器按显式 `discoveredBy` 参数生成候选记录的单测；防止 `"WORKBUDDY"` 硬编码回归的契约测试（例如断言当调用方传入 `CODEX_RESEARCH` 时输出记录字段与之一致）。

### P0-3　周报“人工发布前必须完成人工审核”门禁目前没有任何代码可以违反，也没有任何代码可以遵守——因为发布路径不存在
- **文件**：`lib/pipeline/daily-digest/service.ts`（全文件）、`lib/domain/daily-digest.ts:24-38`、`app/`（仅 `layout.tsx`、`page.tsx`、`globals.css`，无发布路由）
- **触发条件**：任何期望“周报未经人工批准不会自动公开”这条 P0 级发布边界（`SPEC.md` §11.3“未完成人工审核不得发布周报”）已经被工程实现保护的假设。
- **影响**：`DailyDigestService.generate()`（`service.ts:83-169`）只生成 `PENDING + DRAFT + autoPublished:false` 的草稿（`service.ts:150-153`），这本身是正确的、且有测试覆盖的单日行为。但“发布”这一步——从飞书 `PUBLISHED` 状态到网站可见——在整个仓库中没有任何代码实现：没有 `lib/publication/` 目录（`Glob("lib/publication/**/*")` 返回 0 个文件，对应 `architecture.md` §9 描述的 E01 公开字段投影模块尚未创建），没有网站数据导出脚本，`app/` 下没有任何读取飞书或公开 JSON 的页面。也就是说，“未审核不得发布”这条边界目前**没有被代码测试到，因为没有代码路径能让内容抵达网站**。这本身不是一个可以被利用的漏洞（没有发布路径=没有绕过发布审核的路径），但意味着一旦 D06/E01 开始实现，必须把“发布前人工审核门禁”作为该阶段的第一批测试，而不是假设它会从 D02/D03 的既有实现中自然继承——因为 D02/D03 从未被任何自动化或 CLI 命令实际调用过（见 P1-1）。
- **建议方向**：将 E01（公开字段投影）与“发布前审核门禁”的显式集成测试作为同一个不可分割的交付单元；不要把 D02/D03 单元测试通过等同于端到端发布门禁已验证。
- **缺失/需要的测试**：一条完整的 “候选 APPROVED → 正式事件 DRAFT → 人工标记 PUBLISHED → 网站构建只包含 PUBLISHED/CORRECTED” 集成测试；一条 “正式事件仍为 DRAFT/READY 时网站构建不得包含该内容” 的反向测试。

---

## 2. P1 发现

### P1-1　核心候选处理流水线（C05–C09、D02、D03）没有被任何 CLI 命令、脚本或调度器调用
- **文件**：`cli/app.ts:51-62`（`ParsedArguments["command"]` 只有 `help | connection-check | schema-check | mapping-bootstrap | workbuddy-import | openai-discover`）；`lib/pipeline/relevance/`、`lib/pipeline/funding-extraction/`、`lib/pipeline/company-resolution/`、`lib/pipeline/event-deduplication/`、`lib/pipeline/confidence-summary/`、`lib/pipeline/candidate-review/`、`lib/pipeline/daily-digest/` 均无对应命令入口。
- **触发条件**：任何人尝试通过 `pnpm cli -- <command>` 实际运行“候选相关性判断 → 抽取 → 公司归一化 → 去重 → 置信度评分 → 审核转正式事件 → 生成日报”这条 `architecture.md` §4 描述的核心数据流。
- **影响**：`SPEC.md` §9 明确列出 CLI 必须提供“处理候选相关性、抽取和去重”“列出待审核候选”“生成指定日期日报草稿”“验证指定日报可发布”“导出公开网站数据”等命令，但这些命令在 `cli/app.ts` 中全部缺失。这些服务类（`RelevanceService`、`FundingExtractionService`、`CompanyResolutionService`、`EventDeduplicationService`、`ConfidenceSummaryService`、`CandidateReviewService`、`DailyDigestService`）都写好了、测试也通过了，但**没有任何生产可执行路径能把它们串联起来跑一遍**。这正是本任务要求警惕的“代码存在≠功能完成”：`progress.md` 中每一节的验证记录都只到“单元/集成测试通过”和“Mock 验证”，没有一条声称“CLI 端到端跑通”。
- **建议方向**：在继续 D06 周报迁移或任何自动化调度之前，先补齐把这条链路串起来的 CLI 命令（哪怕先是人工触发、非定时的版本），否则 D06、E01、GitHub Actions 调度都将构建在一条从未被整体执行验证过的流水线之上。
- **缺失/需要的测试**：至少一条使用 Mock Feishu + Mock OpenAI 跑通“候选 → 相关性 → 抽取 → 公司归一化 → 去重 → 置信度 → 审核转正式事件 → 日报生成”全链路的集成测试，覆盖当前测试矩阵中明显缺失的“跨阶段组合”场景（现有测试均按阶段隔离验证）。

### P1-2　`WeeklyReport` 领域契约、Schema、公开 DTO、飞书表字段完全不存在
- **文件**：`lib/domain/`（`Glob "lib/**/*.ts"` 全量列出后确认没有 `weekly-report.ts`；`Grep "weekly|Weekly|weekStart" lib/` 返回 0 个文件）；`lib/domain/public-dto.ts:95-107`（只有 `PublicDailyDigest`，无 `PublicWeeklyReport`）；`lib/feishu/schema-definition.ts:253-274`（`daily_digests` 表只有 `digestDate` 单日字段，无 `weekStart`/`weekEnd`/`scheduledPublishAt`）。
- **触发条件**：任何认为“周报正在实现中”或“周报已部分完成”的判断。
- **影响**：`SPEC.md` §5.7 把 `WeeklyReport` 列为“目标契约，尚未实现”，本次代码审查确认字面意义上的零实现——没有类型、没有 Schema、没有飞书字段、没有公开 DTO、没有测试。这不是缺陷，而是需要被诚实记录的现状基线（详见第 5 节迁移依赖图）。
- **建议方向**：见第 5、7 节的迁移顺序建议；不要在 `daily-digest.ts` 上做“加字段”式改造，应新建独立的 `weekly-report.ts` 契约（`architecture.md` §9.4 的 A02 规则“公开 DTO 必须显式列出字段，不得直接扩展完整内部记录”同样适用于内部对象之间不应通过继承/扩散字段迁移）。
- **缺失/需要的测试**：`WeeklyReport` Fixture 与 Schema 测试（合法/非法边界、跨月/跨年周边界、DST 无关性——尽管 Asia/Shanghai 无 DST，仍需显式测试防回归）。

### P1-3　单日日报生成逻辑硬编码“单日相等”过滤，没有任何周窗口计算代码可复用
- **文件**：`lib/pipeline/daily-digest/service.ts:40-50`（`shanghaiBusinessDate` 只计算单一 `YYYY-MM-DD`）、`service.ts:107-109`、`117-119`（`item.announcedAt === digestDate` 精确相等过滤）、`service.ts:138`（`digestId: \`digest-${digestDate}\`` 单日主键）。
- **触发条件**：把该文件当作 D06 迁移的“起点”直接扩展 `digestDate` 为 `weekStart/weekEnd` 区间。
- **影响**：当前实现是“单点相等”而不是“区间包含”，没有周一 00:00–周日 23:59:59 边界计算、没有 ISO 周与自然周语义混用的处理、没有跨月/跨年周的测试。`implementation-plan.md` D06 明确要求覆盖“跨月、跨年、ISO 周边界”，但这些计算目前一行代码都不存在，必须新写而非“改造”。
- **建议方向**：新增独立的 `Asia/Shanghai` 周边界计算函数（输入任意时刻，输出该周的 `weekStart`（周一 00:00+08:00）与 `weekEnd`（周日 23:59:59+08:00）），作为 D06 的第一个独立可测试单元，与生成服务解耦，便于单独覆盖跨月/跨年用例。
- **缺失/需要的测试**：`2026-08-31`（周一，跨月）、`2026-12-29`（跨年，ISO 周 vs 自然周边界）、UTC 时刻在北京时间跨日/跨周边界（如 UTC 周日 16:30 = 北京时间周一 00:30）等固定时钟测试。

### P1-4　通知模板与幂等键在语义和结构上都是“日”粒度，无法直接用于周报
- **文件**：`lib/providers/notification/service.ts:27-35`（`publicationSchema` 使用 `businessDate: isoDateSchema` 单日字段）、`service.ts:83-91`（文案硬编码“日报已生成”“今日融资事件”）、`service.ts:90`（幂等键 `publication:${value.businessDate}`）。
- **触发条件**：D06 迁移周报发布通知时，若直接复用 `sendPublication`。
- **影响**：`businessDate` 字段名和 `isoDateSchema` 校验都假定单一日期；若周报把 `weekStart` 塞进 `businessDate` 字段，语义上会误导后续读者（“businessDate”实际是一周的起点），且幂等键 `publication:${businessDate}` 与现有日报通知的幂等键命名空间完全重叠——如果不改名，同一天既可能是某条历史日报的 `businessDate` 也可能被误用为某周的 `weekStart`，存在幂等键碰撞风险（虽然当前两者不会同时运行，但作为迁移期间的兼容并存风险必须显式排除）。
- **建议方向**：为周报新增独立的 `sendWeeklyPublication` 方法和独立 Schema（`weekStart` 字段名、独立幂等键前缀如 `weekly-publication:${weekStart}`），不要复用/重命名现有 `sendPublication`，以保持 `DailyDigest` 兼容通知在迁移期间继续可用且互不干扰。
- **缺失/需要的测试**：周报通知文案测试（“本周融资事件数”“上一自然周唯一事件数”）；确认日报与周报幂等键命名空间不冲突的测试。

### P1-5　飞书“日报”表结构没有周报所需字段，且是唯一正式数据源，迁移必须是数据/字段迁移而非纯代码改造
- **文件**：`lib/feishu/schema-definition.ts:253-274`
- **触发条件**：D06 实施时如果只改代码、不同步迁移飞书表结构。
- **影响**：`architecture.md` §9.11 已自行标注“现有真实表名与既有代码名称；目标语义迁移为每个北京时间自然周最多一条周报。迁移完成前不得声称周报已实现。”——文档层面已预见到这个风险。代码层面看，`daily_digests` 表（`schema-definition.ts:253`）字段全部是单日语义（`digestDate` 单一日期，无周起止字段），且飞书多维表格不提供 schema 迁移工具，字段变更需要人工在真实 Base 上操作并重新跑 B04 Schema 校验。
- **建议方向**：D06 必须包含“飞书表结构变更操作手册 + 人工验收步骤”，且不能与代码合并请求同批次自动执行；建议采用新建 `weekly_reports` 表而非改造 `daily_digests`，避免破坏历史日报数据的可读性和 `docs/feishu-schema.md` 记录的现有字段映射。
- **缺失/需要的测试**：`tests/feishu/schema-definition.test.ts` 需新增周报表结构测试；`tests/feishu/schema-validator.test.ts` 需新增新表字段映射校验测试。

### P1-6　"清洗后待核验线索"（URL 规范化 + 疑似同事件分组）在代码中没有独立实现，且其决策树尚未冻结
- **文件**：`lib/pipeline/`（`Glob` 结果中没有 `lead-cleaning/` 或等价目录）；已实现的事件去重服务 `lib/pipeline/event-deduplication/service.ts:125-200` 只在候选已完成公司归一化（C07）和事实抽取（C06）**之后**运行，操作对象是 `ProcessedFundingCandidate`（`types.ts:10-17`，要求 `companyId`、`facts`、`evidence` 均已存在），而不是搜索引擎刚产出的原始 URL 列表。
- **触发条件**：任何把 C08 `EventDeduplicationService` 当作“目标工作流第二步（清洗/去重）”实现依据的假设。
- **影响**：用户描述的目标工作流是“每日网站搜索 → 确定性清洗与 URL 规范化 → 精确重复移除 → 疑似同事件分组（保留全部来源 URL）→ 最终人工核验 → 批准的研究候选和正式事件”。当前代码实现的顺序（`SPEC.md` §10：`DISCOVER→VALIDATE→FETCH→CLASSIFY→EXTRACT→RESOLVE_COMPANY→DEDUPLICATE→SCORE_CONFIDENCE`）把"事件级去重"放在相关性判断、事实抽取、公司归一化**之后**，这与目标工作流"清洗/去重先于候选转换"的顺序不是同一个阶段。目前"原始线索→清洗后待核验线索"这一层，`search-strategy.md` §2 定义为独立的第二层数据边界，但其"决策树仍需在后续专项对齐中冻结"（§7），意味着连规则本身都还没有和用户冻结，更谈不上代码实现——当前该步骤完全由人工在 Markdown 报告（如 `docs/pilot/codex-media-capital-recall-2026-08-03.md`）中完成。
- **建议方向**：不要把 C08 `EventDeduplicationService` 复用为“原始线索清洗”阶段的实现；需要与用户先冻结决策树（谁是主来源、哪些信号构成"疑似同事件"、跨媒体证据保留多久），再新建独立的、操作对象是"未提取事实的原始线索"的清洗/分组模块。`lib/providers/workbuddy/importer.ts:75-93` 的 `canonicalizeCandidateUrl` 函数是唯一可以直接复用的确定性清洗单元（见第 6 节）。
- **缺失/需要的测试**：一旦决策树冻结，需要“同一事件 3 个不同媒体 URL 全部保留且分组正确”“同一 URL 追踪参数变体合并为 1 条”“跨媒体证据在未决策前不被删除”的测试——当前这些测试完全不存在，因为对应代码不存在。

### P1-7　`ResearchCandidate` 领域契约无法显式表达目标工作流要求的原始线索状态标记
- **文件**：`lib/domain/research-candidate.ts:25-44`（字段集合中没有 `dateConflict`、`bodyUnavailable`、`contentMismatch`、`broadCapitalEvent`、`possibleDuplicateEventGroup` 等状态字段；只有面向已抽取事实的 `conflicts: readonly FactConflict[]`）
- **触发条件**：把 `search-strategy.md` §5 中定义的 `DATE_CONFLICT`／`NEEDS_HUMAN`／`BODY_UNAVAILABLE`／`CONTENT_MISMATCH`／`BROAD_CAPITAL_EVENT`／`POSSIBLE_DUPLICATE_EVENT` 状态标记写入现有系统时。
- **影响**：`main-agent-handoff.md` §6 自行承认“C01 尚无独立的证据状态、事件日期、金额类型和公司画像字段；MVP 暂写入 `preliminarySummary`”——也就是这些状态目前只能塞进一个自由文本字段（`ImportedResearchCandidate.extractedFacts` 的 JSON blob，`importer.ts:115-120`），不是结构化、可查询、可用于飞书视图筛选的字段。这与 Scope 2 要求“冲突、缺失字段、不可访问正文、需要人工审核可以被显式表示”存在差距：目前只能"被记录"，不能"被系统识别和路由"。
- **建议方向**：在设计"清洗后待核验线索"的领域契约时（见 P1-6），把这些状态设计为结构化枚举字段，而不是继续写入自由文本 JSON；需要先决定这些状态是否要提前到 `ResearchCandidate` 之前的新中间对象（"清洗后线索"），还是扩展 `ResearchCandidate` 本身。
- **缺失/需要的测试**：结构化状态字段的 Schema 测试；飞书视图按状态筛选的测试（类比现有 `tests/feishu/schema-definition.test.ts` 对审核视图的验证方式）。

### P1-8　两周人工基准召回率没有任何领域模型、Schema 或存储结构支持
- **文件**：全仓库 `Grep "recall|召回" lib/` 返回 0 个文件。
- **触发条件**：两周对照召回率试运行开始记录数据时。
- **影响**：`PRD.md` §3.2、`search-strategy.md` §9 定义了明确的召回率公式和逐日记录要求（Agent 命中、人工独立命中、双方共同命中、Agent 独立有效命中、最终唯一事件数），但目前没有任何字段、表或类型可以承载这些数据。`docs/pilot/codex-media-capital-recall-2026-08-03.md` 目前只是一份 Markdown 报告，不是结构化数据。详见第 4 节专项分析。
- **建议方向**：见第 4 节。
- **缺失/需要的测试**：（新模型冻结后）Schema 测试、聚合计算测试（含 Agent-only、Human-only、Both、Rejected、Final-unique 五类计数的正确性）。

### P1-9　`FeishuDailyDigestStore.persist` 的更新路径永远不可能被安全触发，重跑更新语义未定义
- **文件**：`lib/pipeline/daily-digest/feishu-store.ts:58-84`
- **触发条件**：同一 `digestDate` 的日报内容发生变化后重新生成（例如某条融资事件在日报生成后被撤回或新增）。
- **影响**：`persist()` 总是以 `reviewStatus: "PENDING"`、`publicationStatus: "DRAFT"` 写入（`feishu-store.ts:70-71`），且如果 Repository 返回 `action === "updated"`，会直接抛出 `DailyDigestError("DAILY_DIGEST_CHANGED", ...)`（`feishu-store.ts:78-83`）而不是提供任何"内容变化后如何更新"的路径。`progress.md` D03 小节的"重要限制"也承认："当前重跑只接受完全相同的日报内容；新增或修正内容后的显式草稿更新流程将在后续审核与自动化串联阶段处理。"这意味着一旦某天日报生成后又有新审核通过的事件要加入，系统没有定义的行为——只能报错，需要人工介入，且没有代码路径处理"人工已经审核过日报之后又要更新"的场景（这本应该是"更新语义"里最需要保护的场景：不能让自动重跑覆盖已经人工审核过的日报）。
- **建议方向**：D06 迁移周报时必须一并设计"内容变化后的更新语义"：区分"审核前的草稿可以被自动重跑覆盖更新"和"审核后/发布后的内容变化需要走人工更正流程（`correctionNote`）"两种路径，而不是简单地对所有变化报错。
- **缺失/需要的测试**：草稿态重跑更新测试；已审核/已发布态重跑报错并提示走更正流程的测试。

### P1-10　`EventDeduplicationService` 在证据缺失时抛出不透明错误，而非产生可人工处理的状态
- **文件**：`lib/pipeline/event-deduplication/service.ts:108-123`（`buildConflicts`），尤其 `service.ts:115`：`if (!existingUrl || !incomingUrl) throw new EventDeduplicationError();`
- **触发条件**：两条候选在同一天被判定为同一公司、但某个冲突字段（如金额）在其中一方的 `SourceEvidence.supportsFacts` 中没有显式标注支持关系时。
- **影响**：Scope 2 明确要求"冲突、缺失字段…可以被显式表示"。当前实现在这种边界情况下选择直接抛出泛化错误中断整次去重调用，而不是把这条记录标记为需要人工处理的状态（例如复用 `NEEDS_RESEARCH`）。这意味着上游调用方（尚不存在，见 P1-1）必须自行捕获该异常并决定如何处理，而领域层没有把"证据不完整导致无法确定冲突来源"这一状态本身建模为一等公民。
- **建议方向**：评估是否应把这类"证据链断裂"情况改为返回一个新的结果状态（如 `EVIDENCE_INCOMPLETE`）而不是抛异常，使调用方能以统一的方式把候选路由到人工队列，而不是在集成时被迫用 try/catch 兜底。
- **缺失/需要的测试**：对 `tests/pipeline/event-deduplication/service.test.ts` 做过针对性检索（关键词 `buildConflicts`/`existingUrl`），未发现专门覆盖“证据链断裂时的错误恢复路径”的测试用例，说明该分支目前只是隐式行为，没有专项测试锁定；建议补充"两条候选同公司同日期冲突、但其中一方证据未标注 `supportsFacts` 支持冲突字段"的专项测试。

---

## 3. P2 发现

### P2-1　`app/`、`components/` 目前只是工程骨架，E01–E09（公开投影、设计系统、周报页面等）均未开始
- **文件**：`app/page.tsx:1-12`（文案“工程骨架已就绪，融资情报内容将在后续里程碑接入”）、`components/.gitkeep`
- **影响**：不是缺陷，但任何把“网站已支持链接/筛选/排序/展开/图表交互”理解为“当前已实现”的判断都是错误的——这些能力目前都只是 `PRD.md`/`SPEC.md`/`TECH-STACK.md` 中的目标描述，代码仓库里一行页面渲染逻辑都不存在。
- **建议方向**：在 D06/E01 排期沟通中明确标注这一状态，避免下游误判进度。
- **缺失/需要的测试**：N/A（尚无实现）。

### P2-2　`toCliError`（`cli/errors.ts:47-131`）逐类型 `instanceof` 链式判断，新增错误来源时容易漏接
- **文件**：`cli/errors.ts:47-131`
- **核实结果**：本次已逐行读取该文件。实现本身是安全的——每种已知错误类型都有显式 `instanceof` 分支和硬编码安全文案，未见原始异常信息透传（`WorkBuddyImportError`/`OverseasDiscoveryError` 等自身的 `message` 字段也都是各自文件中的硬编码安全中文文案，不是底层异常透传）；未匹配到的错误统一兜底为 `CLI_UNEXPECTED_ERROR`（`errors.ts:130`），不会泄露堆栈。此前草稿中关于“依赖鸭子类型”的表述不准确，已更正为纯维护性观察。
- **影响**：维护性问题，非安全问题。`toCliError` 是一条线性 `instanceof` 链（`errors.ts:50、59、76、85-87、96、108`），P1-1 一旦补齐 CLI 命令、新增更多 Pipeline 错误类型（如 `RelevanceError`、`FundingExtractionError`、`CandidateReviewError`），需要记得同步在此处添加分支，否则会静默落入 `CLI_UNEXPECTED_ERROR` 兜底，丢失具体错误码和可重试标记。
- **建议方向**：在补齐 P1-1 的 CLI 命令时，为 `toCliError` 建立一条“新增 Pipeline 错误类型必须同步加分支”的检查清单或统一 `DomainError` 接口，避免遗漏。
- **缺失/需要的测试**：为 P1-1 新增的每个 Pipeline 错误类型补充对应的 `toCliError` 分支测试，防止静默落入通用兜底。

### P2-3　`main-agent-handoff.md`、`progress.md` 与 `search-strategy.md` 中散落着大量一次性事件记录，长期可读性成本较高
- **文件**：`progress.md`（1066 行，单文件线性追加）
- **影响**：非代码问题，但会持续增加"必读文档"的 Token 成本（`docs/agent-working-agreement.md` 已经意识到这一问题并建立了控制机制）；长期建议定期归档。
- **建议方向**：按 `agent-coordination.md` 现有的归档机制（`docs/archive/search/`）为 `progress.md` 建立类似的分阶段归档策略，不在本次审查范围内强制要求。

### P2-4　`DailyDigestService` 与 `EventDeduplicationService` 均未对“候选列表规模”做上限保护之外的可观测性输出
- **文件**：`lib/pipeline/daily-digest/service.ts:83-169`
- **影响**：`event-deduplication/service.ts` 对输入数组有 `.max(50)`/`.max(30)` 等 Zod 层面的上限（`service.ts:33-34`、`42-43`），但 `DailyDigestService.generate()` 对 `content.listFundingItems()`/`listDevelopmentItems()` 的返回值没有类似上限校验，理论上不会造成安全问题（内部可信数据源），但与其他模块的防御性编码风格不一致。
- **建议方向**：评估是否需要统一防御性上限校验风格，低优先级。

---

## 4. Scope 4 专项：召回率测量能力评估

**结论：当前领域模型和报告结构完全不能记录两周对照数据。这是一个空白，不是缺陷——因为相关领域对象从未被设计过。**

需要记录的六类数据（用户题面要求）：Agent-only 有效事件、人工独家有效事件、双方共同命中事件、被拒绝结果、最终唯一基准事件集、逐日与两周聚合召回率。

逐项核对：

| 需要的数据 | 现状 |
|---|---|
| Agent 命中的候选 | `ResearchCandidate.discoveredBy` 存在，但见 P0-2，当前所有经 C02 导入的候选（无论实际来自 Codex 网站搜索还是历史 WorkBuddy）都被标记为 `"WORKBUDDY"`，无法与"人工独立搜索发现"区分开——因为人工搜索结果目前也没有专门的 `discoveredBy` 取值（`discoveryTools` 只有 `WORKBUDDY \| OPENAI \| MANUAL`，"人工搜索并提交作为基准对照"和"人工补充遗漏链接"两种不同语义目前共享同一个 `MANUAL` 取值，见 `common.ts:34`）。 |
| 人工独立命中 | 无对应字段；`MANUAL` 取值语义模糊（见上）。 |
| 双方共同命中 | 无任何"同一事件被多个 `discoveredBy` 命中"的关联结构；`EventDeduplicationService` 的 `EVENT_DUPLICATE`/`URL_DUPLICATE` 状态本可以承载这个信息（重复即命中同一事件的第二个来源），但结果类型 `EventDeduplicationResult`（`types.ts:31-42`）没有保留"本次合并涉及几个不同 `discoveredBy` 来源"这一聚合信息，需要额外计算。 |
| 被拒绝结果 | `ReviewStatus` 有 `REJECTED`，可用，但没有"被拒绝原因是否计入检索到但无效"的分类标记。 |
| 最终唯一基准事件集 | 无独立对象；需要新建，且必须与 `FundingEvent`/`ResearchCandidate` 解耦（基准集包含"Agent 独立发现且用户确认有效"但可能尚未走完完整审核转正式事件流程的事件，见 `PRD.md` §3.2 最后一句：“Agent 独立发现且经用户确认有效的事件也进入基准集”——这意味着基准集成员资格判定标准与 `FundingEvent` 转换所需的完整字段集合（`CandidateReviewService` 要求的 companyId/sourceIds/publicSummary 等，见 `candidate-review/service.ts:19-34`）不是同一个门槛，需要单独建模，不能直接复用 `ReviewStatus === APPROVED` 作为基准集判据）。 |
| 逐日/两周聚合召回率 | 无任何计算函数或存储结构。 |

**建议方向**：新建一个独立的、明确标注为“两周试运行专用、非长期正式数据契约”的 `RecallBenchmark` 领域对象（例如：`businessDate`、`agentOnlyValidEventIds`、`humanOnlyValidEventIds`、`bothValidEventIds`、`rejectedCount`、`finalUniqueEventIds`），配套一个纯函数计算 `Agent 召回率 = |agentFound ∩ finalUnique| / |finalUnique|`，并在飞书中新建一张临时观测表（不进入九表正式契约，避免与长期数据模型混淆）。由于用户明确要求“不得通过降低相关性、证据或人工审核标准提高召回率”，该对象的验收测试应包含“基准集事件必须先满足现有 `APPROVED` 审核语义或等价的人工确认标记，才能计入分母”的显式断言，防止实现时为了让数字好看而放宽口径。

**需要用户确认的决策**（不应由实现者单方面决定）：
1. `discoveredBy` 是否需要拆分出独立的“人工基准搜索”取值，还是复用现有 `MANUAL`？
2. Agent 独立发现且用户确认有效但尚未转换为正式 `FundingEvent` 的候选，是否允许仅凭候选层的人工确认标记（而非完整 `APPROVED` 转换）就计入基准集分母？
3. `RecallBenchmark` 数据是否需要进入飞书正式九表体系，还是作为两周后即可归档的临时表？

---

## 5. 迁移依赖图（DailyDigest → WeeklyReport）

```
lib/domain/common.ts (IsoDate/IsoDateTime 基础类型，无需变更)
        │
        ▼
新建 lib/domain/weekly-report.ts ──────────────┐
   (WeeklyReport, WeeklyReportItemOrder)        │
        │                                       │
        ▼                                       ▼
lib/domain/schemas/domain.ts               lib/domain/public-dto.ts
   (新增 weeklyReportSchema，                (新增 PublicWeeklyReport /
    周边界跨字段校验)                          PublicWeeklyReportEntry)
        │                                       │
        ▼                                       ▼
lib/feishu/schema-definition.ts            tests/fixtures/domain.ts
   (新建 weekly_reports 表定义，              tests/fixtures/feishu-design.ts
    人工在真实飞书 Base 创建字段)              tests/type-contracts/public-dto.ts
        │
        ▼
lib/feishu/repository.ts (新增周报表工厂，复用现有 FeishuTableRepository 通用逻辑)
        │
        ▼
新建 lib/pipeline/weekly-report/
   ├── types.ts        (WeeklyReportStore, WeeklyReportContentSource)
   ├── service.ts       (新增独立周边界计算函数 + 周窗口筛选，
   │                      不能从 daily-digest/service.ts 复制粘贴单日相等逻辑)
   ├── feishu-store.ts  (幂等 + 更新语义，需先解决 P1-9 的"审核后更新"设计)
   └── errors.ts
        │
        ▼
lib/providers/notification/service.ts
   (新增 sendWeeklyPublication，独立 Schema 与幂等键前缀，不复用 sendPublication)
        │
        ▼
cli/app.ts (新增周报生成/发布相关命令 —— 前提是先完成 P1-1 的既有流水线接入)
        │
        ▼
新建 lib/publication/ (E01 公开字段投影，当前完全不存在)
        │
        ▼
app/weekly/[weekStart]/、app/archive/ 等路由 (E02-E09，当前完全不存在)
        │
        ▼
.github/workflows/ (调度自动化，当前完全不存在，且应晚于 P0-1 的调度守卫实现)
```

**关键点**：这条依赖链目前在"新建 `lib/pipeline/weekly-report/`"之前的所有上游节点（领域契约、Schema、飞书表）都是 0% 实现；`daily-digest/` 现有代码不是这条链的可复用节点，而是需要保持独立运行（兼容期）的旁支。

---

## 6. 必须同步变更的契约清单

以下契约互相耦合，任何单独修改都会破坏一致性，必须在同一个变更集中处理：

1. **`WeeklyReport` 内部对象** ↔ **`weeklyReportSchema` 运行时校验** ↔ **`weekly_reports` 飞书表字段** ↔ **`FeishuWeeklyReportStore`**：四者必须同时定义、同时通过 B04 字段映射校验，缺一不可（`architecture.md` §9.5 A03 冻结规则“公开导出必须通过独立白名单 Schema”同样适用于内部对象的飞书映射）。
2. **`PublicWeeklyReport` DTO** ↔ **`tests/type-contracts/public-dto.ts` 编译期契约测试** ↔ **公开导出 Schema（`lib/domain/schemas/boundaries.ts`）**：新增周报公开字段时必须同步更新这三处，否则会重演 `architecture.md` 强调的“新增内部字段不应自动进入公开契约”的风险敞口。
3. **周边界计算函数** ↔ **通知幂等键格式** ↔ **飞书日报表主键（`digestId` → 新的 `reportId`）** ↔ **`/weekly/[weekStart]` 路由参数**：这四处都以“周起始日”为身份标识，命名和格式（是否含时区后缀、是否为 `YYYY-MM-DD`）必须在设计阶段一次性冻结，避免后续在飞书字段、URL、通知文案中出现三套不同的周标识格式。
4. **`discoveryTools` 枚举** ↔ **C02 导入器的 `discoveredBy` 赋值逻辑** ↔ **两周召回率基准的来源统计**：见 P0-2、P1-8，三者必须同时修正，否则修了枚举也没用（导入器仍会硬编码）。

---

## 7. 可安全复用的现有组件

- `canonicalizeCandidateUrl`（`lib/providers/workbuddy/importer.ts:75-93`）：通用 URL 规范化逻辑（去 fragment、去追踪参数、参数排序、去除多余尾斜杠），与 WorkBuddy JSON 格式无耦合，可直接用于“原始线索清洗”阶段。
- `FeishuTableRepository`（`lib/feishu/repository.ts`）通用幂等创建/更新/版本检查逻辑：周报表可直接复用同一套 Repository 工厂，无需重新实现乐观并发。
- `EventDeduplicationService` 的信号比较算法（`event-deduplication/service.ts:88-123` 的 `conflictFields`/`sameAmount`/`sameNullableText`）：算法本身（同公司内比较日期/轮次/金额至少两个信号一致）是合理、可复用的事件级去重逻辑，只是运行阶段需要重新定位（见 P1-6），不建议改动算法本身。
- `ConfidenceSummaryService` 的确定性摘要生成（逐句 claim + 来源 URL 绑定）：与"日报 vs 周报"无关，是候选层的通用能力，周报可直接消费其输出，无需改造。
- `NotificationService` 的幂等键模式（`业务标识:${key}` 字符串格式）和文本模板结构：可以作为周报通知的设计模板，但具体 Schema 和方法必须新建（见 P1-4），不能改造现有方法签名。
- `sortDigestSection`（`lib/domain/daily-digest.ts:45-66`）的排序算法（人工顺序优先，否则按重要性降序，同分稳定 ID）：算法通用，周报板块排序可直接复用同一实现，只需改造调用处的类型参数。
- 五类飞书候选审核视图设计模式（`lib/feishu/schema-definition.ts` 的 `field()`/视图筛选器 DSL）：为周报表新建视图（如“待发布周报”“已发布归档”）时可复用同一套 DSL 和测试模式。

---

## 8. 需要用户确认的决策（不应由实现者单方面决定）

1. **飞书表策略**：`weekly_reports` 是新建独立表，还是改造现有 `daily_digests` 表？（本报告建议新建，理由见 P1-5，但涉及真实生产 Base 的人工操作，必须用户拍板。）
2. **DailyDigest 的最终归宿**：D06 完成后，`daily_digests` 表和相关代码是否保留为可查询的历史归档，还是逐步下线？`SPEC.md`/`architecture.md` 当前只说“待迁移”，未说明迁移后旧数据如何处置。
3. **周报覆盖范围**：`PRD.md` §3“当前只冻结'搜索 MVP'为国内融资与资本动态……整个产品 MVP 是否同步收缩，将在后续专项对齐中决定”——周报是否要包含技术/产品/商业化板块（现有三板块日报的另外两块），还是像当前搜索范围一样收窄为“只含融资与资本动态”？这直接决定 `WeeklyReport` 契约的字段集合。
4. **原始线索清洗决策树**：`search-strategy.md` §7 明确写着这一决策树尚未冻结（谁是主来源、多少信号构成"疑似同事件"、跨媒体证据保留策略）。这是 P1-6/P1-7 的前置阻塞项，必须用户先拍板规则，再谈实现。
5. **召回率基准集判定门槛**：见第 4 节末尾三个问题（`discoveredBy` 是否拆分、候选层确认是否足以计入分母、`RecallBenchmark` 是否进入九表体系）。
6. **`discoveredBy` 枚举变更的影响范围**：新增枚举值是否需要回填历史候选记录的 `discoveredBy` 字段（P0-2 的修复是否需要数据回填，还是只对新记录生效）？

---

## 9. 建议实现顺序

1. **先修 P0-2**（`discoveredBy` 溯源污染）——影响范围最小、风险最高、且是后续召回率统计的前置依赖，应独立于周报迁移立即处理。
2. **冻结第 8 节的 6 个决策**，尤其是原始线索清洗决策树（决策 4）和飞书表策略（决策 1）——没有这些决策，后续任何代码都可能返工。
3. **补齐 P1-1**（把已实现的 C05–C09/D02/D03 服务接入 CLI，跑通一次端到端集成测试）——这是验证现有"已完成"标注（`progress.md`）在系统集成层面依然成立的必要步骤，且是 D06、GitHub Actions 调度共同的前置依赖。
4. **实现 P0-1 的调度守卫**（`AutomationRun` 消费者 + 暂停任务拒绝逻辑）——必须先于任何 `.github/workflows/` 文件落地。
5. **按第 5 节依赖图从上到下实现 D06**：`weekly-report.ts` 领域契约 → Schema → 飞书表（人工创建+验收）→ Repository → `lib/pipeline/weekly-report/` → 通知 → CLI 命令。
6. **实现 E01（`lib/publication/`）公开字段投影**，与"发布前人工审核门禁"集成测试（P0-3）同批交付。
7. **实现 `/weekly/[weekStart]` 及相关路由（E02+）**。
8. **两周召回率试运行的 `RecallBenchmark` 建模**（第 4 节）——可以与步骤 5-7 并行，因为它不依赖周报页面本身，只依赖候选/事件数据。
9. **接入 GitHub Actions 调度**，此时 P0-1 的守卫必须已经就位并有测试覆盖。

---

## 10. 哪些发现会阻塞下一个实现任务

- **阻塞“继续 D06 周报实现”**：P1-2、P1-3、P1-5（契约/字段/飞书表零基线，必须先建立）；决策 1、3、4（第 8 节）未拍板前不应开始写周报领域代码。
- **阻塞“接入 GitHub Actions 调度”**：P0-1（调度守卫缺失）必须先修复，否则暂停能力可能被意外调度触发，这是本次审查中唯一一条“修复前绝对不能开始下一步”的强阻塞项。
- **阻塞“声称候选处理链路已验证”**：P1-1（无 CLI 集成路径）——在补齐集成测试前，不应在交接文档中把 C05–D03 描述为“系统已验证可运行”，只能描述为“各阶段服务已通过单元/Mock 测试”。
- **阻塞“开始两周召回率试运行的正式数据记录”**：P1-8 及第 4 节的三项用户决策。
- **不阻塞、可并行**：P0-2 的修复（范围小，应尽快独立处理，但不阻塞其他工作流）；P2 类发现均为可延后处理的维护性事项。

---

## 附：本次审查方法说明

- 全程只读：使用 Read/Glob/Grep 工具检索和阅读源码与文档，未调用 Write/Edit，未执行任何 Git、Feishu、WorkBuddy 或 OpenAI 相关的外部命令。
- 行号引用均来自审查时读取到的文件内容；如后续文件发生变更，行号可能漂移，建议复核前重新定位。
- `cli/errors.ts` 已逐行读取并核实（见 P2-2 更正说明）。受限于篇幅，`lib/feishu/client.ts`、`lib/pipeline/company-resolution/service.ts`、`domestic-website-search-list.md` 全文等文件本次以文档描述＋抽样代码交叉验证为主，未逐行审查；如需更高把握度，建议对这些文件及 P1-10 标注的证据恢复路径做一次独立复核。
