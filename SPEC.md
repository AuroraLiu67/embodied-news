# 具身智能公司动态雷达 MVP 工程规格

> 版本：v0.3
> 状态：Implementation contract  
> 更新日期：2026-08-04
> 架构基线：`architecture.md`  
> 产品要求：`PRD.md`  
> 技术选型：`TECH-STACK.md`

架构组件、数据流、部署与安全边界以 `architecture.md` 为最高参考。本规格负责细化工程契约，不得改变其中的架构不变量。

## 1. 工程目标

本规格定义“飞书为唯一正式数据源、GitHub Actions 自动运行、GitHub Pages 托管静态网站”的实现契约。

Codex 是主工程和集成 Agent，其 Research Operations 角色负责当前国内网站搜索；Claude Code 仅做只读审核。WorkBuddy 已暂停，既有文件导入仅作兼容能力。

## 2. 系统边界

### 2.1 必须实现

- 飞书多维表格 Schema 与公司自建应用。
- 飞书 CLI。
- Codex Research Operations 国内媒体网站资本线索发现与覆盖审计。
- 原始线索经用户初筛后的候选转换；既有 WorkBuddy 候选文件导入保持兼容。
- OpenAI 相关性、抽取、核验和摘要；既有海外候选发现入口暂停运行。
- 公司归一化、事件去重、来源、置信度和审核状态。
- 飞书候选审核、周报编辑和观察清单视图；既有日报表与 DailyDigest 需要迁移。
- 飞书文本通知。
- GitHub Actions 定时调度、幂等补跑和手动重试。
- Next.js 静态网站。
- GitHub Pages 自动部署。
- 可暂停、恢复和防重的历史回填能力（MVP 后续增强，不阻塞七天闭环验收）。

### 2.2 不实现

- PostgreSQL、Neon、Drizzle 或其他独立数据库。
- Cloudflare、Vercel 或常在线个人电脑。
- 独立管理后台和管理员账号系统。
- Obsidian、Coze、飞书消息卡片。
- 微信登录自动化、公众号直接爬取或反爬绕过。
- 当前 MVP 海外搜索自动运行。
- 用户登录、评论、收藏和 CRM。

## 3. 高层架构

```mermaid
flowchart TB
    Research["Codex Research Operations<br/>国内网站资本线索"] --> Lead["原始线索"]
    RSS["wechat-mp-rss<br/>待验证补充"] -.-> Lead
    Lead --> Candidate["研究候选"]
    OpenAI["OpenAI 抽取、核验与摘要"] --> Candidate
    Candidate --> Core["校验、归一化、去重、置信度"]
    Core --> CLI["飞书 CLI"]
    CLI --> Base["飞书多维表格：唯一正式数据源"]
    Base --> Review["飞书审核与编辑"]
    Review --> Base
    Base --> Filter["公开字段过滤"]
    Filter --> Build["Next.js 静态构建"]
    Build --> Pages["GitHub Pages"]
    Actions["GitHub Actions"] -.未来确定性搜索入口.-> Research
    Actions --> CLI
    Actions --> Build
    Actions --> Notify["飞书文本通知"]
```

## 4. 仓库结构

建议目录：

- `app/`：Next.js 页面与布局。
- `components/`：共享 UI 和图表组件。
- `lib/domain/`：领域类型、规则和 Schema。
- `lib/feishu/`：飞书客户端、字段映射和 Repository。
- `lib/providers/`：OpenAI、兼容候选导入和通知 Provider。
- `lib/pipeline/`：发现、抽取、去重、周报和调度；既有 daily-digest 暂作迁移输入。
- `lib/publication/`：公开字段投影与静态页面数据。
- `cli/`：项目飞书 CLI。
- `scripts/`：GitHub Actions 使用的确定性入口。
- `tests/fixtures/`：脱敏 Fixture。
- `.agents/skills/`：项目级 Codex Skills。
- `.github/workflows/`：CI、调度和 Pages 发布。

依赖方向：

- UI 只依赖公开查询模型。
- 领域层不得依赖飞书 SDK、OpenAI SDK 或 Next.js。
- Provider 实现依赖领域契约。
- CLI 和 Actions 入口组合领域服务与 Provider。

## 5. 领域对象

### 5.1 ResearchCandidate

- `candidateId`
- `sourceUrl`
- `canonicalUrl`
- `title`
- `sourceName`
- `sourceType`
- `sourceTier`
- `regionScope`
- `discoveredBy`
- `publishedAt`
- `discoveredAt`
- `rawExcerpt`
- `relevance`
- `extractedFacts`
- `confidence`
- `duplicateOf`
- `conflicts`
- `reviewStatus`

### 5.2 FundingEvent

- `eventId`
- `companyId`
- `round`
- `amount`
- `currency`
- `amountDisclosed`
- `investors`
- `announcedAt`
- `region`
- `technologyTags`
- `publicSummary`
- `publicWhyItMatters`
- `sourceIds`
- `confidence`
- `importanceScore`
- `importanceReason`
- `publicationStatus`
- `isPublic`

### 5.3 CompanyDevelopment

- `developmentId`
- `companyId`
- `category`
- `title`
- `announcedAt`
- `technologyTags`
- `publicSummary`
- `publicWhyItMatters`
- `sourceIds`
- `confidence`
- `importanceScore`
- `importanceReason`
- `publicationStatus`
- `isPublic`

### 5.4 InformationSource

- `sourceId`
- `title`
- `url`
- `publisher`
- `sourceType`
- `sourceTier`
- `publishedAt`
- `isPrimary`
- `lastVerifiedAt`

### 5.5 Company

- `companyId`
- `nameZh`
- `nameEn`
- `aliases`
- `website`
- `region`
- `technologyTags`
- `publicDescription`

### 5.6 DailyDigest（既有兼容对象，待迁移）

- `digestId`
- `digestDate`
- `title`
- `fundingEventIds`
- `technologyProductDevelopmentIds`
- `commercializationDevelopmentIds`
- `sectionOrder`
- `reviewStatus`
- `publicationStatus`
- `publishedAt`
- `autoPublished`
- `correctionNote`

### 5.7 WeeklyReport（目标契约，尚未实现）

- `reportId`
- `weekStart`
- `weekEnd`
- `scheduledPublishAt`
- `title`
- `fundingEventIds`
- `sectionOrder`
- `reviewStatus`
- `publicationStatus`
- `publishedAt`
- `correctionNote`

### 5.8 WatchItem

- `watchId`
- `type`
- `name`
- `queries`
- `region`
- `technologyTags`
- `priority`
- `enabled`

### 5.9 InternalAssessment

- `assessmentId`
- `companyId` 或 `eventId`
- `attentionLevel`
- `strategicAssessment`
- `followUpStatus`
- `owner`
- `internalNotes`

### 5.7 AutomationRun

- `runId`
- `businessDate`
- `jobType`
- `status`
- `attempt`
- `startedAt`
- `finishedAt`
- `errorCode`
- `errorSummary`
- `manualActionRequired`

## 6. 飞书多维表格契约

### 6.1 表

固定表名：

- `研究候选`
- `融资事件`
- `公司动态`
- `信息来源`
- `公司`
- `日报`
- `观察清单`
- `内部战投备注`
- `自动化任务`

生产逻辑使用字段 ID，不依赖可被人工修改的字段显示名。字段 ID 映射保存在服务端配置中。

### 6.2 身份与权限

- 使用公司飞书自建应用。
- 生产任务使用应用身份。
- 应用只获得指定多维表格及发送文本消息所需权限。
- 内部战投备注不授权给 Research Operations、WorkBuddy 兼容入口或 OpenAI。
- 公开网站构建只使用公开投影。

### 6.3 Repository 规则

飞书 Repository 必须支持：

- 按稳定业务 ID 查询。
- 分页读取和批量写入。
- 幂等创建或更新。
- 乐观并发检查。
- 限流重试。
- 审计字段写入。
- 字段缺失或字段类型变化时快速失败。

飞书多维表格不提供与关系数据库相同的唯一约束，因此应用层必须在写入前查询并使用稳定业务 ID 防重。

## 7. 运行时 Schema

所有外部输入使用 Zod 校验。

### 7.1 URL

- 只允许 HTTP 和 HTTPS。
- 拒绝本机、私网、云元数据和凭据型 URL。
- canonical URL 去除已知追踪参数。
- 重定向后的最终 URL 重新校验。

### 7.2 文本

- 标题、摘要、正文片段和数组均设置长度上限。
- 删除脚本、危险 HTML 和不可见控制字符。
- 不保存无必要的完整原文。

### 7.3 金额

- 金额使用十进制字符串传递，禁止浮点计算。
- 未披露金额使用 `amountDisclosed=false`。
- 币种使用固定枚举。
- 原币金额保留；看板换算只用于展示统计。

### 7.4 时间

- 内部时间统一为 ISO 8601 UTC。
- 业务日报日期使用 Asia/Shanghai。
- 测试必须使用固定时钟。

## 8. Provider

### 8.1 OpenAIProvider

职责：

- 相关性判断。
- 结构化抽取。
- 冲突比较。
- 中文摘要。
- 市场观察。

限制：

- 模型来自环境变量。
- 输出经过 Schema 校验。
- 有每日调用、候选、Token 和成本上限。
- 只返回候选或建议，不直接写飞书正式事件。

### 8.2 WorkBuddyImportProvider（遗留兼容）

输入为固定候选文件或标准输入，字段至少包括：

- 标题
- 来源 URL
- 来源名称
- 发布时间
- 查询词
- 初步摘要
- 发现时间

导入流程：

1. 验证文件大小和 Schema。
2. 校验 URL。
3. 生成候选 ID 和 canonical URL。
4. 去重。
5. 写入“研究候选”。

WorkBuddy 当前暂停。该 Provider 只兼容历史 C01 文件；新的 Codex 网站搜索先产生原始线索，经用户初筛和候选转换后才能进入候选 Repository。

### 8.3 FeishuNotificationProvider

只发送：

- 08:00 审核提醒。
- 09:00 发布通知。
- 任务失败与恢复通知。

消息只私聊配置的个人 `open_id`，使用纯文本或普通富文本链接；不接受群聊 `chat_id`，不生成消息卡片。

### 8.4 Mock Provider

CI 和本地测试必须提供 OpenAI、WorkBuddy、飞书和通知 Mock。Mock 不访问外部网络。

## 9. 飞书 CLI

CLI 是人工操作、Codex 和 GitHub Actions 的统一入口。

必须提供以下业务命令：

- 检查飞书连接与字段映射。
- 初始化或验证多维表格 Schema。
- 导入兼容候选文件。
- 处理用户初筛后的 Codex 网站线索；暂停运行 OpenAI 海外发现入口。
- 处理候选相关性、抽取和去重。
- 列出待审核候选。
- 生成指定日期日报草稿。
- 验证指定日报可发布。
- 导出公开网站数据。
- 记录任务状态。
- 重试指定失败任务。

CLI 输出机器可读结果和简洁人类摘要；错误使用稳定错误码。任何命令都不得将密钥输出到日志。

## 10. 采集流水线

阶段：

1. `DISCOVER`
2. `VALIDATE`
3. `FETCH`
4. `CLASSIFY`
5. `EXTRACT`
6. `RESOLVE_COMPANY`
7. `DEDUPLICATE`
8. `SCORE_CONFIDENCE`
9. `SUMMARIZE`
10. `PERSIST_CANDIDATE`

规则：

- 阶段可重试且幂等。
- 单条候选失败不终止整批。
- 重试不得重复创建飞书记录。
- 相同 canonical URL 视为强重复信号。
- 公司、日期、轮次和金额相似时进入事件级去重。
- 冲突事实保留多个来源并标记待复核。

## 11. 审核与周报

### 11.1 审核状态

- `PENDING`
- `APPROVED`
- `REJECTED`
- `NEEDS_RESEARCH`
- `DUPLICATE`

### 11.2 发布状态

- `DRAFT`
- `READY`
- `PUBLISHED`
- `CORRECTED`
- `WITHDRAWN`

### 11.3 周报规则

- 每个北京时间自然周最多一条周报，窗口固定为周一 00:00 至周日 23:59:59，次周一生成。
- 条目只引用审核通过的融资事件或公司动态。
- 当前搜索 MVP 周报只包含融资与广义资本动态。
- 每个板块默认按 1–5 重要性评分降序，人工调整的最终顺序优先。
- 每条内容必须关联并内联展示至少一个可访问原始来源；不得建立独立来源板块。
- 未完成人工审核不得发布周报；当前不自动公开未经人工确认的内容。
- 更正更新当前公开内容并保留更正说明。
- 撤下内容不进入下一次网站构建。

## 12. 公开数据投影

网站构建不能直接导出整张飞书记录。

允许公开：

- 公司公开资料。
- 已发布融资事实。
- 已发布技术、产品和商业化动态。
- 公开摘要。
- 公开来源。
- 重要性评分与理由。
- 置信度。
- 日报和更正说明。
- 聚合统计。

禁止公开：

- 内部战投备注。
- 待审核或被拒绝候选。
- 操作人邮箱。
- 自动化错误详情。
- 飞书 record ID 和应用凭据。
- OpenAI 请求与完整响应。

构建前执行公开 DTO Schema 校验和敏感字段拒绝列表检查。

## 13. 静态网站

### 13.1 路由

- `/`
- `/weekly/[weekStart]`
- `/archive`
- `/funding/[eventId]`
- `/companies/[companyId]`
- `/dashboard`

### 13.2 构建

- Next.js 使用静态导出。
- 构建时读取经过公开投影的本地 JSON。
- 不在浏览器端调用飞书或 OpenAI。
- GitHub Pages 使用项目路径时，资源和链接必须支持 base path。
- 所有页面具备静态 404 降级。

### 13.3 历史归档

- 周报发布后进入归档。
- 按年份和自然周生成索引。
- 周起始日链接稳定。
- 只生成已发布、已更正状态页面。

### 13.4 看板

构建时生成聚合数据：

- 事件数量
- 披露金额
- 轮次
- 技术方向
- 地区

未披露金额计入事件数量，不计入金额总额。

## 14. GitHub Actions

### 14.1 CI

每次 Pull Request 执行：

- 代码规范检查。
- TypeScript 类型检查。
- 单元测试。
- 集成测试。
- Next.js 静态构建。
- 链接和敏感字段检查。
- Playwright Smoke Test。

CI 不调用真实外部服务。

### 14.2 调度

调度 Workflow 周期性运行，不只依赖 07:00、08:00、09:00 三个单点 Cron。

每次运行：

1. 读取 Asia/Shanghai 当前业务日期。
2. 查询“自动化任务”中应执行且未完成的任务。
3. 取得任务锁。
4. 运行任务。
5. 写回成功或失败。
6. 释放任务锁。

任务类型：

- `DISCOVER_OVERSEAS`
- `PROCESS_CANDIDATES`
- `CREATE_REVIEW_DIGEST`
- `PUBLISH_DIGEST`
- `BUILD_SITE`
- `NOTIFY`
- `BACKFILL`

必须支持 `workflow_dispatch` 手动重试。

### 14.3 Pages 发布

- 只有默认分支允许生产发布。
- 发布 Job 只获得仓库读取、Pages 写入和身份令牌所需权限。
- 构建产物通过 GitHub Pages artifact 发布。
- 发布失败不得改变飞书正式数据。
- 上一个成功版本继续可访问。

## 15. 项目级 Codex Skill

仓库目标包含“周报网站发布”Skill，用于 Codex重复执行；现有日报发布 Skill 在迁移完成前属于兼容实现：

1. 检查飞书字段映射。
2. 导出公开数据。
3. 运行公开 DTO 和敏感字段验证。
4. 生成静态网站。
5. 运行测试和链接检查。
6. 汇报变更。
7. 经用户明确要求后提交、推送和触发发布。

Skill 负责标准化人工和维护流程；GitHub Actions 运行确定性 CLI 与脚本，不依赖交互式 Codex 会话。

## 16. 环境变量

分类：

- 飞书应用 ID、应用密钥和多维表格标识。
- 飞书各表 ID 和字段映射。
- OpenAI API Key、模型和预算限制。
- 飞书通知 Webhook 或应用消息配置。
- 应用时区和站点 base path。

规则：

- 生产值存储在 GitHub Secrets。
- PR Workflow 不获得生产 Secrets。
- 本地值保存在被 Git 忽略的环境文件。
- 任何环境变量不得写入静态产物。

## 17. 测试

### 17.1 单元测试

- Schema 合法与非法输入。
- URL 安全。
- 公司归一化。
- 事件去重。
- 置信度。
- 金额统计。
- 公开字段投影。
- 时间窗口与幂等键。

### 17.2 集成测试

- Mock WorkBuddy 导入到 Mock 飞书。
- Mock OpenAI 候选进入候选表。
- 审核状态生成周报。
- 飞书字段变化时快速失败。
- 公开导出不包含内部字段。
- 重试不重复写入。

### 17.3 E2E

- 首页展示最新周报。
- 周报、归档和融资详情互相导航。
- 未审核自动发布标记正确。
- 更正说明正确。
- 看板统计与 Fixture 一致。
- GitHub Pages base path 下资源可加载。

## 18. 可观测性

“自动化任务”表记录：

- 业务日期
- 任务类型
- 状态
- 尝试次数
- 候选数量
- 重复数量
- Schema 失败数量
- OpenAI调用量和估算成本
- 开始、结束和简化错误

日志只保存必要元数据，不保存密钥、完整原文、完整模型响应或内部判断。

## 19. 公司所有权

- GitHub 仓库必须属于公司 Organization。
- OpenAI Project 必须属于公司。
- 飞书应用和多维表格必须属于公司租户。
- Codex 搜索运行环境必须归公司并可移交；WorkBuddy 不再是生产账号要求。
- 至少两名管理员具有恢复权限。
- 操作手册包含密钥轮换、手动补跑和网站重新发布。

## 20. Definition of Done

单个任务完成必须满足：

- 实现范围与冻结契约一致。
- 新行为有自动化测试。
- 受影响测试全部通过。
- 没有真实密钥或内部数据进入 Git。
- 没有降低断言或跳过失败测试。
- 文档和字段映射同步更新。
- 交接包含结果、文件、验证和已知限制。

MVP 完成必须满足：

- 飞书能够完成每日候选审核和周报管理。
- 国内网站每日搜索、清洗去重、人工核验和候选转换可运行。
- GitHub Actions 可补跑和手动重试。
- GitHub Pages 可公开访问。
- 网站数据完全来自飞书公开投影。
- 内部字段泄露测试通过。
- 七天真实闭环试运行完成，并得到 WVID 基线。
- 公司其他管理员可独立完成一次发布。
