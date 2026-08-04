# Codex 国内资本动态每日搜索任务模板

> 本文件只填写单次运行参数。所有搜索范围、收录、异常、清洗、去重和人工门禁规则统一引用 `search-strategy.md`，不在此重复。

## 1. 必读输入

1. `AGENTS.md`
2. `docs/agent-working-agreement.md`
3. `search-strategy.md`
4. `domestic-website-search-list.md`

## 2. 本次参数

- 目标业务日：`YYYY-MM-DD`，时区 `Asia/Shanghai`
- 执行时间：`YYYY-MM-DDTHH:mm:ss+08:00`
- 网站清单版本：`domestic-website-search-list.md`
- RSS 补充：默认关闭；只有 wechat-mp-rss 已产生可访问条目时才设为开启
- 允许外部调用：公开网站只读搜索与读取
- 禁止调用：飞书写入、OpenAI 付费调用、WorkBuddy、登录态渠道、通知、发布和 Git 对外操作
- 原始搜索报告：`docs/pilot/<business-date>-capital-search.md`
- 清洗去重报告：`docs/pilot/<business-date>-capital-cleaning.md`
- 人工核验状态：`PENDING`

## 3. 执行与交付

1. Research Operations 按搜索策略逐站搜索并提交原始报告。
2. 对原始报告执行确定性格式清洗、URL 规范化和完全重复合并。
3. 对疑似同事件建立分组，保留全部来源，不自动裁决事件事实。
4. 输出需要用户核验的最小清单，包括日期冲突、内容冲突、正文不可访问、字段缺失和疑似重复。
5. 用户核验前不生成正式候选、不写飞书、不批准或发布。

交付必须报告覆盖范围、停止原因、访问限制、原始结果数、唯一 URL 数、疑似事件组数和待人工核验数；不得承诺绝对零遗漏。
