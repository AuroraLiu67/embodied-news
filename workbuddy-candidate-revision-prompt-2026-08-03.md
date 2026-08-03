# WorkBuddy 2026-08-03 候选 JSON 修订任务

请修订现有文件 `d05-workbuddy-candidates-2026-08-03.json`。不要重新执行整批新闻搜索，不要随意增加或删除候选；先修复现有 21 条候选的格式、网址、来源名称、重复和乱码问题。

执行前必须阅读：

1. `docs/workbuddy-candidate-format.md`
2. `workbuddy-domestic-observation-list.md`

## 1. 修复 C01 字段

当前文件没有通过项目 Schema 校验。

删除错误字段：

- `reportTime`
- `queryTerms`

替换为 C01 规定字段：

- `publishedAt`
- `queries`
- `sourceType`
- `sourceTier`
- `discoveredAt`

每条候选必须且只能使用以下字段：

- `title`
- `sourceUrl`
- `sourceName`
- `contentType`
- `sourceType`
- `sourceTier`
- `publishedAt`
- `queries`
- `preliminarySummary`
- `discoveredAt`

不要添加其他字段。

`publishedAt` 必须使用带时区的 ISO 8601 格式，例如 `2026-08-03T18:29:00+08:00`。如果来源只显示日期，没有具体时间，使用 `2026-08-03T00:00:00+08:00`，不得猜测具体时分。

`queries` 必须是字符串数组，例如：

```json
"queries": [
  "帕西尼 10亿元 战略轮 融资",
  "具身智能 融资 2026年8月"
]
```

不能继续使用分号连接的字符串。

`discoveredAt` 填写本次实际修订时间，使用带时区的 ISO 8601 北京时间。所有条目可以使用同一个真实修订时间，但不得填写未来时间。

## 2. 补充来源分类

`sourceType` 只能选择：

- `COMPANY`
- `INVESTOR`
- `REGULATOR`
- `GOVERNMENT`
- `FA`
- `MEDIA`
- `SOCIAL`
- `SEARCH_SNIPPET`

`sourceTier` 只能选择：

- `PRIMARY`：公司、投资方、参投方、FA、客户、合作方、交易参与方或正式监管披露。
- `AUTHORITATIVE`：36氪、投资界、证券时报、每日经济新闻、上海证券报等可靠专业媒体的原创报道。
- `SECONDARY`：网易号、腾讯新闻、同花顺等转载或二次发布页面。
- `LEAD`：只能确认搜索线索，尚未打开完整正文。

能够打开完整文章的候选不能标成 `SEARCH_SNIPPET` 或 `LEAD`。

## 3. 修复来源名称与网址不一致

`sourceName` 必须如实反映 `sourceUrl` 页面上的实际发布主体。

当前有多条记录使用网易、腾讯新闻、同花顺等网址，却将 `sourceName` 写成投资界、36氪、晚点 LatePost、甲子光年或其他原始媒体。

处理顺序：

1. 尝试寻找该事件对应的36氪、投资界、晚点 LatePost、甲子光年、公司、投资方、FA 或其他原始文章网址。
2. 找到可访问原文时，更换 `sourceUrl` 并填写原始发布主体。
3. 找不到原文时，可以保留当前转载网址，但必须如实填写当前页面的发布账号，例如：

```json
"sourceName": "网易号（转载自投资界）",
"sourceType": "MEDIA",
"sourceTier": "SECONDARY"
```

不要把转载网址标成原始媒体或一手来源。

重点检查：

- 7 条 `163.com` 链接。
- 腾讯新闻链接。
- 同花顺链接。
- `cbia.com.cn` 链接。
- 页面域名与 `sourceName` 不一致的其他记录。

## 4. 解决重复 URL

当前 21 条候选只有 17 个唯一 URL。重复 URL 包括：

- 每日经济新闻同一 URL 用于 3 条不同融资。
- 大河财立方同一 URL 用于 2 条不同融资。
- 凤凰科技同一 URL 用于 2 条阿里动态。

项目会按 URL 去重，因此不同候选不能使用相同的 `sourceUrl`。

对每个拆分事件：

1. 优先寻找该事件独立的公司、投资方、FA 或专业媒体文章网址。
2. 找到独立网址后，替换对应 `sourceUrl`。
3. 如果只能找到同一篇汇总文章，不得用同一 URL 拆成多个候选。
4. 这种情况只保留一条能够代表该汇总文章的候选；其余事件放入“待补充独立来源”报告，不进入 JSON。
5. 最终 JSON 中每个 `sourceUrl` 必须唯一。

## 5. 修复乱码

当前存在标题：

`贝联珠贯完成��亿元A轮融资，阿里云领投AI Agent运维赛道`

必须打开来源核对准确原文。如果原文确实是“超亿元”，修复为准确标题；如果无法核实，不得猜测，将该条移出 JSON 并在修订报告中说明。

同时检查全部标题和摘要是否存在：

- `�`
- 异常编码
- 截断文字
- HTML 乱码

## 6. 保留新版收录规则

以下内容不需要删除：

- “数亿元”“千万级”“近5亿元”等模糊金额。
- 8月3日发布、但事件发生于此前日期的报道。
- 只有一个可靠专业媒体来源的候选。
- 脑机接口、eVTOL、AI Agent、芯片、量子计算、视频生成等科技类动态。
- 公司赛道、具体业务、核心产品或技术等补充信息。

融资金额必须保留原始表述，不得把“数亿元”转换成猜测的精确数字。

事件日期如果不明确，可以不写。C01 中的 `publishedAt` 表示报道发布时间，不是事件发生时间。

## 7. 摘要要求

在 `preliminarySummary` 中保留：

- 新闻核心事实。
- 公司具体做什么。
- 一级或二级赛道。
- 核心产品、技术或商业化信息。
- 证据状态。
- 必要的事件时间说明。

证据状态可以使用：

- 已确认
- 多源佐证
- 单源报道
- 待核验

不能添加 C01 契约之外的新字段，这些信息只能写入 `preliminarySummary`。

## 8. 输出前验证

输出前必须完成以下检查：

1. JSON 可以正常解析。
2. 顶层只有 `schemaVersion` 和 `candidates`。
3. 每条只有 C01 允许字段。
4. 每条都有可访问网址。
5. 每个 `sourceUrl` 唯一。
6. `sourceName` 与实际页面发布主体一致。
7. `publishedAt` 为带时区的 ISO 8601。
8. `queries` 为字符串数组。
9. 没有乱码字符 `�`。
10. 不包含 Cookie、Token、账号信息或完整付费正文。

## 9. 交付物

请覆盖生成修订后的：

`d05-workbuddy-candidates-2026-08-03.json`

另外生成一份简短报告：

`d05-workbuddy-candidates-2026-08-03-revision-report.md`

报告只需列出：

- 修复了多少条。
- 找到了多少个独立原始网址。
- 仍使用转载网址的候选。
- 因重复 URL 或无法核实而移出的候选。
- 最终候选数量。
- 是否已完成上述 10 项检查。

不要写入飞书，不要生成正式事件或日报。修订完成后，把这两个文件交给 Codex 重新校验。
