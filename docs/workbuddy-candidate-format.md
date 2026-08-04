# WorkBuddy 候选导出说明

> 格式版本：1  
> 文件编码：UTF-8  
> 文件类型：JSON

> 状态：遗留兼容契约。WorkBuddy 已暂停；本文件只用于读取既有 C01 文件，不再是现行搜索任务说明。

本格式用于把既有 WorkBuddy 文件交给项目飞书 CLI。它只承载未经审核的研究候选，不是正式融资事件或发布数据。新的 Codex 网站搜索先按 `search-strategy.md` 形成原始线索，不得跳过用户初筛直接套用本格式写入飞书。

## 1. 文件结构

文件顶层必须是一个对象，只允许 `schemaVersion` 和 `candidates`：

```json
{
  "schemaVersion": "1",
  "candidates": [
    {
      "title": "示例机器人公司完成新一轮融资",
      "sourceUrl": "https://mp.weixin.qq.com/s/example-article",
      "sourceName": "示例公司官方公众号",
      "contentType": "FUNDING",
      "sourceType": "COMPANY",
      "sourceTier": "PRIMARY",
      "publishedAt": "2026-08-01T01:30:00+08:00",
      "queries": ["示例机器人 融资", "具身智能 新一轮融资"],
      "preliminarySummary": "官方公众号宣布完成新一轮融资，金额未披露。",
      "discoveredAt": "2026-08-01T08:15:00+08:00"
    }
  ]
}
```

每个文件包含 1–500 条候选，与当前 C01 运行时 Schema 一致。没有合格候选时不生成候选 JSON 文件，只在任务总结中报告 0 条；不得伪造候选或输出不符合 Schema 的空文件。不得添加 `candidateId`、正式融资字段、审核状态、发布状态、允许公开或内部战投字段；这些信息由后续系统或人工审核产生。

## 2. 候选字段

| 字段 | 必填 | 规则 |
|---|---|---|
| `title` | 是 | 原始标题，去除首尾空白后 1–500 个字符。 |
| `sourceUrl` | 是 | 原始文章或公告的 HTTP/HTTPS 地址，最长 2048 个字符；不得包含账号密码，也不得指向本机、私网或保留地址。 |
| `sourceName` | 是 | 发布主体或公众号名称，1–200 个字符。 |
| `contentType` | 是 | `FUNDING`、`TECHNOLOGY`、`PRODUCT` 或 `COMMERCIALIZATION`。 |
| `sourceType` | 是 | `COMPANY`、`INVESTOR`、`REGULATOR`、`GOVERNMENT`、`FA`、`MEDIA`、`SOCIAL` 或 `SEARCH_SNIPPET`。C01 保留 `SEARCH_SNIPPET` 枚举，但本次每日候选不得把搜索摘要作为主来源。 |
| `sourceTier` | 是 | `PRIMARY`、`AUTHORITATIVE`、`SECONDARY` 或 `LEAD`。`LEAD` 只表示当前证据较弱；仍须提供可访问、能支持核心事实的文章或公告，不能只提供搜索结果页。 |
| `publishedAt` | 是 | 原始发布时间，使用带时区的 ISO 8601；无法确认时填 `null`，不得猜测。 |
| `queries` | 是 | 发现该候选的查询词数组，1–30 项，每项 1–300 个字符。 |
| `preliminarySummary` | 否 | 只写来源支持的初步摘要，最多 2000 个字符；不要复制完整文章。 |
| `discoveredAt` | 是 | WorkBuddy 实际发现时间，使用带时区的 ISO 8601。 |

时间示例：`2026-08-01T08:15:00+08:00` 或 `2026-08-01T00:15:00Z`。只有日期、缺少时区或自然语言日期均不合法。

## 3. 兼容文件要求

1. 本文件不定义现行搜索顺序；当前搜索入口以 `search-strategy.md` 和 `domestic-website-search-list.md` 为准。
2. 同一 URL 被多个查询词命中时只输出一次，并合并 `queries`。
3. 同一事件有多个来源时只生成一条候选，选择信息最完整、可访问且能支持核心事实的文章作为 `sourceUrl`；其他必要来源及证据差异简要写入 `preliminarySummary`，不得把同一事件伪装成多条候选。
4. `sourceUrl` 必须指向实际文章或公告，不能只提供搜索结果页、搜索摘要、登录页或截图。
5. 保留所选主来源的原始标题和发布主体；不要把 AI 推断写成已经确认的事实。
6. 金额、轮次或事件日期未披露时不要估算，相关不确定性可以写入 `preliminarySummary`；`publishedAt` 始终表示主来源的报道发布时间。
7. 候选 JSON 文件只能包含第 1 节定义的 JSON 对象，不添加 Markdown 代码围栏、任务总结、解释文字或模型思考过程。每日任务要求的简短总结应作为文件之外的单独回复提供，不得写进 JSON。
8. 导出前检查 JSON 能正常解析，并确认不包含账号、Cookie、Token、内部备注或完整付费正文。

## 4. 错误处理

- 单条候选字段不完整时，修正或移除该条后再导出；不要用空字符串代替必填内容。
- 原始发布时间未知时使用 `null`；发现时间必须始终存在。
- URL 指向内网、本机、非 HTTP 协议或包含凭据时，不得导出。
- 没有合格候选时不生成候选 JSON 文件，在文件之外的任务总结中报告 0 条及主要原因。
- 文件超过 500 条时拆分成多个文件，每个文件继续使用 `schemaVersion: "1"`。

C02 的 CLI 导入会再次执行文件大小、JSON 和运行时 Schema 校验，并完成 canonical URL、候选 ID、防重及飞书写入。
