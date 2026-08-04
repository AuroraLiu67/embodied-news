# D05.1 海外候选发现命令

> 状态：已实现的兼容命令，2026-08-04 起暂停运行。当前 MVP 不执行海外搜索；未来恢复时由 Codex Research Operations 负责发现并重新评估是否复用此入口。

该命令按指定的 Asia/Shanghai 业务日期执行 OpenAI Web Search，并且只把通过项目 Schema 和日期门禁的海外融资结果写入飞书“研究候选”表。

~~~text
pnpm cli -- openai-discover YYYY-MM-DD <查询文件.json>
~~~

查询文件使用严格版本化格式：

~~~json
{
  "schemaVersion": "1",
  "queries": [
    {
      "queryId": "priority-companies",
      "query": "检索任务说明"
    }
  ]
}
~~~

约束：

- 每个文件包含 1–30 个查询，queryId 必须唯一。
- OpenAI 每个查询最多产生一个融资研究结果。
- 至少一个原始来源必须有明确发布时间，且换算到 Asia/Shanghai 后等于命令指定日期。
- SEARCH_SNIPPET 和 LEAD 不能作为创建候选的主来源。
- 结果只写入“研究候选”，固定为 OVERSEAS + OPENAI + FUNDING + PENDING。
- 相同 canonical URL 已存在时跳过，不覆盖已有候选。
- 命令输出只包含查询、新建、重复、拒绝和失败数量，不输出完整模型响应或网页正文。
- 普通自动化测试必须使用 Mock Provider 和 Mock Repository；真实调用必须经用户明确授权。

当前 C03 OpenAI Schema 是融资研究契约，因此该暂停入口只能创建融资候选。新的国内 Codex 搜索不直接调用本命令，也不通过 WorkBuddy 主链路进入候选表。

## 历史轻量运行策略（不再执行）

- 以下内容记录旧试跑方法，不是当前运行要求。
- 海外方法与国内一致：优先信源、精简事件词、宽发现、线索触发补搜。
- 每日轻量范围包含融资/资本、量产/交付/部署、新模型/新产品三类；可轮换查看少量高信号公司，但不按全部公司或赛道逐项轮询，不展开公司×赛道×事件矩阵。
- 观察清单主要用于已发现线索的分类、排序和必要补搜，不是必须逐项完成的每日任务清单。
- 轻量化不改变日期、可访问来源、Schema、去重、幂等和人工审核门禁，也不扩展当前仅支持 Physical AI 融资的实现。
- 推荐使用 `docs/pilot/d05-overseas-queries-lightweight.json`；日期化的首次试跑查询文件保留为历史基线，不再作为默认轻量模板。
- `d05-overseas-queries-lightweight.json` 仅保留为历史输入；当前不得运行。
