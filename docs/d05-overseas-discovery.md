# D05.1 海外候选发现命令

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

当前 C03 OpenAI Schema 是融资研究契约，因此 D05.1 海外入口只创建融资候选。海外技术、产品和商业化发现需要后续单独扩展严格 Schema；国内四类候选仍可通过 WorkBuddy 固定格式进入同一候选表。
