# Codex 国内资本动态每日搜索任务模板

> 本文件只填写单次运行参数。所有搜索范围、收录、异常、清洗、去重和人工门禁规则统一引用 `search-strategy.md`，不在此重复。

## 1. 必读输入

1. `AGENTS.md`
2. `docs/agent-working-agreement.md`
3. `search-strategy.md`
4. `domestic-website-search-list.md`

## 2. 每日替换参数

- 目标业务日：`YYYY-MM-DD`，时区 `Asia/Shanghai`
- 执行时间：`YYYY-MM-DDTHH:mm:ss+08:00`
- 网站清单版本：`domestic-website-search-list.md`
- RSS 补充：默认关闭；只有 wechat-mp-rss 已产生可访问条目时才设为开启
- 允许外部调用：公开网站只读搜索与读取
- 禁止调用：飞书写入、OpenAI 付费调用、WorkBuddy、登录态渠道、通知、发布和 Git 对外操作
- 原始审计 JSON：`docs/pilot/<business-date>-capital-raw.json`
- 清洗事件 JSON：`docs/pilot/<business-date>-capital-cleaned.json`
- 人工审核 Markdown：`docs/pilot/<business-date>-capital-review.md`
- 人工核验状态：`PENDING`

每天只需替换 `YYYY-MM-DD`、执行时间和三个交付路径；其他规则默认不变。目标业务日通常是执行日的前一天，但不得由 Agent 自行猜测。

## 3. 可直接发送给 Research Operations 的任务

```text
任务编号：DAILY-CAPITAL-SEARCH-<business-date>

目标：
完成 Asia/Shanghai 业务日 <business-date> 的国内融资与广义资本动态搜索、确定性清洗和疑似同事件分组，交付待用户核验的最小清单。

仓库：
/Users/ruoheliu/Documents/embodied-news-4Galbot

必读文件：
- AGENTS.md
- docs/agent-working-agreement.md
- search-strategy.md
- domestic-website-search-list.md

本次参数：
- 目标业务日：<business-date>
- 执行时间：<execution-time-with-08:00-offset>
- RSS 补充：<OFF 或 ON；默认 OFF>
- 原始审计 JSON：docs/pilot/<business-date>-capital-raw.json
- 清洗事件 JSON：docs/pilot/<business-date>-capital-cleaned.json
- 人工审核 Markdown：docs/pilot/<business-date>-capital-review.md

允许修改：
- 上述原始审计 JSON
- 上述清洗事件 JSON
- 上述人工审核 Markdown

禁止修改：
- 必读文件和所有其他共享 Markdown
- progress.md、main-agent-handoff.md
- 业务代码、测试、Schema、候选 JSON 和飞书数据

冻结规则：
- 完整遵守 search-strategy.md，不在本任务中重新解释搜索、收录、异常、清洗、去重或人工门禁。
- 完整覆盖 domestic-website-search-list.md；不得抽样，不设结果数量上限。
- “国内”指本次使用国内媒体网站搜索，不代表只收国内公司；符合业务日、资本事件和来源要求的境外交易主体不得仅因地域被排除。
- raw 可保留非目标日和日期不确定的审计证据；clean 只保留可确认属于 <business-date> 的内容。
- 对“昨天”、“N小时前”、“1天前”等相对时间，按 <execution-time-with-08:00-offset> 换算 Asia/Shanghai 日期并记录依据，同时打开正文核对可见发布日期。
- 正文明确为非目标日时，仅在 raw 中保留并标记排除，不得进入 clean 或普通人工待审清单。
- 日期跨日边界、正文无日期或仍无法可靠判定时，标记 DATE_UNCERTAIN 并询问用户；用户确认前不进入 clean。
- 人工审核 Markdown 只展示正文发布日期已确认属于 <business-date> 的来源和 clean 事件。
- 对非目标日命中，人工审核 Markdown 只报告排除数量，不展示标题、URL、R 编号或逐条审核要求。
- DATE_UNCERTAIN 不进入人工审核 Markdown；在交付时用最小问题另行询问用户。
- 人工审核项只包括目标日事件合并、主来源、广义资本边界和关键字段冲突。
- 搜索后只执行确定性清洗、URL 规范化、完全重复合并和疑似同事件分组。
- 跨媒体疑似同事件保留全部来源；不得替用户裁决事实、最终合并事件或选择主来源。
- 用户核验前不得生成正式候选、写飞书、批准、发布或通知。

外部调用：
- 允许公开网站只读搜索和读取，并按 search-strategy.md 使用 Agent Reach。
- 禁止登录态、Cookie、验证码或付费墙绕过、OpenAI 付费调用、WorkBuddy 和任何外部写入。

Git：
- 不允许 branch、stage、commit、push、merge 或 PR。

验收：
- 每个清单媒体都有覆盖记录、检查范围、停止原因和访问限制。
- 报告原始结果数、唯一 URL 数、疑似事件组数和待人工核验数。
- 报告目标业务日、实际执行时间、相对时间换算依据、正文日期核验结果、非目标日排除数和日期不确定数。
- clean 中不含已确认为非 <business-date> 的条目；日期不确定项已向用户提问而非默认收录。
- clean 不得仅因公司或交易主体位于境外而排除日期、事件范围和来源均合格的条目。
- 人工审核 Markdown 只含日期合格来源和 clean 事件；非目标日仅显示排除数量，日期不确定项在文件外最小化提问。
- git diff --check 通过。
- 不承诺绝对零遗漏。

交接：
- 任务编号与结论
- 搜索覆盖和统计
- 异常与访问限制
- 修改文件
- 验证结果
- 真实外部调用
- 待用户核验项
```

## 4. 固定执行顺序

1. Research Operations 按搜索策略逐站搜索并提交原始报告。
2. 对原始报告执行确定性格式清洗、URL 规范化和完全重复合并。
3. 对疑似同事件建立分组，保留全部来源，不自动裁决事件事实。
4. 先执行业务日门禁：非目标日条目仅留 raw 排除记录；日期不确定项询问用户；只将日期合格项输入 clean。
5. 对日期不确定项在人工审核 Markdown 外提出最小问题；确认前不进入 clean。
6. 人工审核 Markdown 只展示目标日 clean 事件及其合并、主来源、广义资本边界和关键字段冲突；非目标日只报告排除数量。
7. 用户核验前不生成正式候选、不写飞书、不批准或发布。

交付必须报告覆盖范围、停止原因、访问限制、原始结果数、唯一 URL 数、疑似事件组数和待人工核验数；不得承诺绝对零遗漏。
