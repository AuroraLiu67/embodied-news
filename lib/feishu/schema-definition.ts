export type FeishuTableKey =
  | "funding_candidates"
  | "funding_events"
  | "company_developments"
  | "information_sources"
  | "companies"
  | "daily_digests"
  | "watch_items"
  | "internal_assessments"
  | "automation_runs";

export type FeishuFieldType =
  | "text"
  | "longText"
  | "url"
  | "number"
  | "checkbox"
  | "date"
  | "dateTime"
  | "singleSelect"
  | "multiSelect"
  | "textArray"
  | "relation"
  | "user";

export type FeishuFieldVisibility =
  | "PUBLIC"
  | "INTERNAL"
  | "SENSITIVE"
  | "SYSTEM";

export interface FeishuFieldDefinition {
  key: string;
  displayName: string;
  type: FeishuFieldType;
  required: boolean;
  visibility: FeishuFieldVisibility;
  options?: readonly string[];
  relationTable?: FeishuTableKey;
  multiple?: boolean;
  description: string;
}

export type FeishuViewOperator =
  | "equals"
  | "in"
  | "isNotEmpty"
  | "dateIsToday";

export interface FeishuViewFilter {
  fieldKey: string;
  operator: FeishuViewOperator;
  value?: string | boolean | readonly string[];
}

export interface FeishuViewDefinition {
  name: string;
  columns: readonly string[];
  filters: readonly FeishuViewFilter[];
  sort?: readonly {
    fieldKey: string;
    direction: "asc" | "desc";
  }[];
}

export interface FeishuTableDefinition {
  key: FeishuTableKey;
  displayName: string;
  primaryFieldKey: string;
  purpose: string;
  fields: readonly FeishuFieldDefinition[];
  views: readonly FeishuViewDefinition[];
}

const field = (
  definition: FeishuFieldDefinition,
): FeishuFieldDefinition => definition;

const auditFields = [
  field({
    key: "version",
    displayName: "数据版本",
    type: "number",
    required: true,
    visibility: "SYSTEM",
    description: "应用层乐观并发版本号。",
  }),
  field({
    key: "createdAt",
    displayName: "创建时间",
    type: "dateTime",
    required: true,
    visibility: "SYSTEM",
    description: "记录首次创建时间，使用 UTC。",
  }),
  field({
    key: "updatedAt",
    displayName: "更新时间",
    type: "dateTime",
    required: true,
    visibility: "SYSTEM",
    description: "记录最近更新时间，使用 UTC。",
  }),
  field({
    key: "updatedBy",
    displayName: "修改人",
    type: "user",
    required: false,
    visibility: "SYSTEM",
    description: "人工修改人；自动任务可留空并通过任务 ID 审计。",
  }),
] as const;

export const feishuTableDefinitions: readonly FeishuTableDefinition[] = [
  {
    key: "funding_candidates",
    displayName: "研究候选",
    primaryFieldKey: "candidateId",
    purpose: "保存 WorkBuddy、OpenAI 和人工提交的待审核研究候选。",
    fields: [
      field({ key: "candidateId", displayName: "候选 ID", type: "text", required: true, visibility: "INTERNAL", description: "应用生成的稳定候选业务 ID。" }),
      field({ key: "title", displayName: "标题", type: "text", required: true, visibility: "INTERNAL", description: "来源标题。" }),
      field({ key: "sourceUrl", displayName: "来源 URL", type: "url", required: true, visibility: "INTERNAL", description: "原始发现 URL。" }),
      field({ key: "canonicalUrl", displayName: "规范 URL", type: "url", required: true, visibility: "SYSTEM", description: "去除追踪参数后的防重 URL。" }),
      field({ key: "sourceType", displayName: "来源类型", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["COMPANY", "INVESTOR", "REGULATOR", "GOVERNMENT", "FA", "MEDIA", "SOCIAL", "SEARCH_SNIPPET"], description: "来源主体类型。" }),
      field({ key: "sourceTier", displayName: "来源等级", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["PRIMARY", "AUTHORITATIVE", "SECONDARY", "LEAD"], description: "来源可信等级。" }),
      field({ key: "contentType", displayName: "内容类型", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["FUNDING", "TECHNOLOGY", "PRODUCT", "COMMERCIALIZATION"], description: "候选准备转化成的正式情报类型。" }),
      field({ key: "regionScope", displayName: "国内或海外", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["CHINA", "OVERSEAS"], description: "候选地域范围。" }),
      field({ key: "discoveredBy", displayName: "发现工具", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["WORKBUDDY", "OPENAI", "MANUAL"], description: "候选发现入口。" }),
      field({ key: "publishedAt", displayName: "来源发布时间", type: "dateTime", required: false, visibility: "INTERNAL", description: "来源公开时间。" }),
      field({ key: "discoveredAt", displayName: "发现时间", type: "dateTime", required: true, visibility: "INTERNAL", description: "系统发现时间。" }),
      field({ key: "rawExcerpt", displayName: "初步摘要", type: "longText", required: false, visibility: "INTERNAL", description: "必要的短正文片段，不保存完整原文。" }),
      field({ key: "extractedFacts", displayName: "初步抽取字段", type: "longText", required: false, visibility: "INTERNAL", description: "经过 Schema 校验的结构化事实 JSON。" }),
      field({ key: "relevanceDecision", displayName: "相关性", type: "singleSelect", required: false, visibility: "INTERNAL", options: ["RELEVANT", "NOT_RELEVANT", "UNCERTAIN"], description: "具身智能融资相关性判断。" }),
      field({ key: "confidenceLevel", displayName: "置信度等级", type: "singleSelect", required: false, visibility: "INTERNAL", options: ["LOW", "MEDIUM", "HIGH"], description: "候选置信度等级。" }),
      field({ key: "confidenceScore", displayName: "置信度分数", type: "number", required: false, visibility: "INTERNAL", description: "0 到 1 的候选置信度。" }),
      field({ key: "importanceScore", displayName: "建议重要性", type: "number", required: false, visibility: "INTERNAL", description: "1 到 5 的建议重要性分，允许人工调整。" }),
      field({ key: "duplicateCandidate", displayName: "重复候选", type: "relation", required: false, visibility: "INTERNAL", relationTable: "funding_candidates", multiple: false, description: "指向已存在的重复候选。" }),
      field({ key: "conflictSummary", displayName: "冲突提示", type: "longText", required: false, visibility: "INTERNAL", description: "金额、轮次或其他事实冲突摘要。" }),
      field({ key: "reviewStatus", displayName: "审核状态", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["PENDING", "APPROVED", "REJECTED", "NEEDS_RESEARCH", "DUPLICATE"], description: "人工审核结果。" }),
      ...auditFields,
    ],
    views: [
      { name: "今日待审核", columns: ["candidateId", "title", "sourceUrl", "sourceTier", "confidenceLevel", "conflictSummary", "reviewStatus"], filters: [{ fieldKey: "discoveredAt", operator: "dateIsToday" }, { fieldKey: "reviewStatus", operator: "equals", value: "PENDING" }], sort: [{ fieldKey: "confidenceScore", direction: "desc" }] },
      { name: "高置信度", columns: ["candidateId", "title", "sourceUrl", "sourceTier", "confidenceScore", "conflictSummary", "reviewStatus"], filters: [{ fieldKey: "confidenceLevel", operator: "equals", value: "HIGH" }, { fieldKey: "reviewStatus", operator: "equals", value: "PENDING" }] },
      { name: "低置信度", columns: ["candidateId", "title", "sourceUrl", "sourceTier", "confidenceScore", "conflictSummary", "reviewStatus"], filters: [{ fieldKey: "confidenceLevel", operator: "equals", value: "LOW" }] },
      { name: "待复核", columns: ["candidateId", "title", "sourceUrl", "sourceTier", "confidenceLevel", "conflictSummary", "reviewStatus"], filters: [{ fieldKey: "reviewStatus", operator: "equals", value: "NEEDS_RESEARCH" }] },
      { name: "重复候选", columns: ["candidateId", "title", "sourceUrl", "sourceTier", "duplicateCandidate", "conflictSummary", "reviewStatus"], filters: [{ fieldKey: "reviewStatus", operator: "equals", value: "DUPLICATE" }] },
    ],
  },
  {
    key: "funding_events",
    displayName: "融资事件",
    primaryFieldKey: "eventId",
    purpose: "保存审核后的正式融资事实和发布控制。",
    fields: [
      field({ key: "eventId", displayName: "事件 ID", type: "text", required: true, visibility: "PUBLIC", description: "稳定公开事件 ID。" }),
      field({ key: "company", displayName: "公司关联", type: "relation", required: true, visibility: "PUBLIC", relationTable: "companies", multiple: false, description: "关联唯一公司记录。" }),
      field({ key: "round", displayName: "轮次", type: "text", required: false, visibility: "PUBLIC", description: "公开融资轮次。" }),
      field({ key: "amount", displayName: "金额", type: "text", required: false, visibility: "PUBLIC", description: "十进制字符串金额。" }),
      field({ key: "currency", displayName: "币种", type: "singleSelect", required: false, visibility: "PUBLIC", options: ["CNY", "USD", "EUR", "GBP", "JPY", "KRW", "OTHER"], description: "原始披露币种。" }),
      field({ key: "amountDisclosed", displayName: "金额是否披露", type: "checkbox", required: true, visibility: "PUBLIC", description: "未披露时金额和币种为空。" }),
      field({ key: "investors", displayName: "投资方", type: "textArray", required: false, visibility: "PUBLIC", description: "投资方名称列表。" }),
      field({ key: "announcedAt", displayName: "融资日期", type: "date", required: true, visibility: "PUBLIC", description: "融资公告业务日期。" }),
      field({ key: "region", displayName: "地区", type: "text", required: true, visibility: "PUBLIC", description: "公司或事件地区。" }),
      field({ key: "technologyTags", displayName: "技术方向", type: "multiSelect", required: false, visibility: "PUBLIC", description: "具身智能技术标签。" }),
      field({ key: "publicSummary", displayName: "公开摘要", type: "longText", required: true, visibility: "PUBLIC", description: "仅基于证据的中文摘要。" }),
      field({ key: "publicWhyItMatters", displayName: "公开意义", type: "longText", required: true, visibility: "PUBLIC", description: "公开市场意义说明。" }),
      field({ key: "sources", displayName: "原始信息来源", type: "relation", required: true, visibility: "PUBLIC", relationTable: "information_sources", multiple: true, description: "至少关联一个可访问的原始来源；无来源不得发布。" }),
      field({ key: "confidenceLevel", displayName: "置信度", type: "singleSelect", required: true, visibility: "PUBLIC", options: ["LOW", "MEDIUM", "HIGH"], description: "公开置信度等级。" }),
      field({ key: "importanceScore", displayName: "重要性评分", type: "number", required: true, visibility: "PUBLIC", description: "1 到 5 的最终重要性分，日报板块内按此降序排列。" }),
      field({ key: "importanceReason", displayName: "重要性理由", type: "longText", required: true, visibility: "PUBLIC", description: "解释评分依据，供审核和公开展示使用。" }),
      field({ key: "isPublic", displayName: "允许公开", type: "checkbox", required: true, visibility: "INTERNAL", description: "人工公开控制开关。" }),
      field({ key: "publicationStatus", displayName: "发布状态", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["DRAFT", "READY", "PUBLISHED", "CORRECTED", "WITHDRAWN"], description: "正式发布状态。" }),
      ...auditFields,
    ],
    views: [
      { name: "待发布", columns: ["eventId", "company", "round", "amount", "currency", "announcedAt", "sources", "importanceScore", "isPublic", "publicationStatus"], filters: [{ fieldKey: "publicationStatus", operator: "equals", value: "READY" }] },
      { name: "公开已发布", columns: ["eventId", "company", "round", "amount", "currency", "announcedAt", "publicSummary", "sources", "importanceScore", "confidenceLevel"], filters: [{ fieldKey: "isPublic", operator: "equals", value: true }, { fieldKey: "publicationStatus", operator: "in", value: ["PUBLISHED", "CORRECTED"] }], sort: [{ fieldKey: "importanceScore", direction: "desc" }] },
    ],
  },
  {
    key: "company_developments",
    displayName: "公司动态",
    primaryFieldKey: "developmentId",
    purpose: "保存技术、产品和商业化进展，并作为日报后两个板块的正式内容。",
    fields: [
      field({ key: "developmentId", displayName: "动态 ID", type: "text", required: true, visibility: "PUBLIC", description: "稳定公开动态 ID。" }),
      field({ key: "company", displayName: "公司关联", type: "relation", required: true, visibility: "PUBLIC", relationTable: "companies", multiple: false, description: "关联唯一公司记录。" }),
      field({ key: "category", displayName: "动态类型", type: "singleSelect", required: true, visibility: "PUBLIC", options: ["TECHNOLOGY", "PRODUCT", "COMMERCIALIZATION"], description: "技术、产品或商业化进展。" }),
      field({ key: "title", displayName: "标题", type: "text", required: true, visibility: "PUBLIC", description: "公开动态标题。" }),
      field({ key: "announcedAt", displayName: "发布日期", type: "date", required: true, visibility: "PUBLIC", description: "原始信息的业务日期。" }),
      field({ key: "technologyTags", displayName: "技术方向", type: "multiSelect", required: false, visibility: "PUBLIC", description: "具身智能技术和赛道标签。" }),
      field({ key: "publicSummary", displayName: "公开摘要", type: "longText", required: true, visibility: "PUBLIC", description: "仅基于来源证据的中文摘要。" }),
      field({ key: "publicWhyItMatters", displayName: "公开意义", type: "longText", required: true, visibility: "PUBLIC", description: "技术或商业价值说明。" }),
      field({ key: "sources", displayName: "原始信息来源", type: "relation", required: true, visibility: "PUBLIC", relationTable: "information_sources", multiple: true, description: "至少关联一个可访问原始来源；无来源不得发布。" }),
      field({ key: "confidenceLevel", displayName: "置信度", type: "singleSelect", required: true, visibility: "PUBLIC", options: ["LOW", "MEDIUM", "HIGH"], description: "公开置信度等级。" }),
      field({ key: "importanceScore", displayName: "重要性评分", type: "number", required: true, visibility: "PUBLIC", description: "1 到 5 的最终重要性分，日报板块内按此降序排列。" }),
      field({ key: "importanceReason", displayName: "重要性理由", type: "longText", required: true, visibility: "PUBLIC", description: "解释评分依据。" }),
      field({ key: "isPublic", displayName: "允许公开", type: "checkbox", required: true, visibility: "INTERNAL", description: "人工公开控制开关。" }),
      field({ key: "publicationStatus", displayName: "发布状态", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["DRAFT", "READY", "PUBLISHED", "CORRECTED", "WITHDRAWN"], description: "正式发布状态。" }),
      ...auditFields,
    ],
    views: [
      { name: "待发布", columns: ["developmentId", "company", "category", "title", "announcedAt", "sources", "importanceScore", "publicationStatus"], filters: [{ fieldKey: "publicationStatus", operator: "equals", value: "READY" }] },
      { name: "公开已发布", columns: ["developmentId", "company", "category", "title", "announcedAt", "sources", "importanceScore"], filters: [{ fieldKey: "isPublic", operator: "equals", value: true }, { fieldKey: "publicationStatus", operator: "in", value: ["PUBLISHED", "CORRECTED"] }], sort: [{ fieldKey: "importanceScore", direction: "desc" }] },
    ],
  },
  {
    key: "information_sources",
    displayName: "信息来源",
    primaryFieldKey: "sourceId",
    purpose: "逐条保存融资和公司动态的原始来源链接及可信等级。",
    fields: [
      field({ key: "sourceId", displayName: "来源 ID", type: "text", required: true, visibility: "PUBLIC", description: "稳定公开来源 ID。" }),
      field({ key: "title", displayName: "原始标题", type: "text", required: true, visibility: "PUBLIC", description: "来源页面原始标题。" }),
      field({ key: "url", displayName: "原始链接", type: "url", required: true, visibility: "PUBLIC", description: "用户可直接打开的原始信息页面。" }),
      field({ key: "publisher", displayName: "发布主体", type: "text", required: true, visibility: "PUBLIC", description: "公司、投资方、政府或媒体名称。" }),
      field({ key: "sourceType", displayName: "来源类型", type: "singleSelect", required: true, visibility: "PUBLIC", options: ["COMPANY", "INVESTOR", "REGULATOR", "GOVERNMENT", "FA", "MEDIA", "SOCIAL"], description: "来源主体类型。" }),
      field({ key: "sourceTier", displayName: "来源等级", type: "singleSelect", required: true, visibility: "PUBLIC", options: ["PRIMARY", "AUTHORITATIVE", "SECONDARY"], description: "一手、权威或二手来源。" }),
      field({ key: "publishedAt", displayName: "原始发布时间", type: "dateTime", required: false, visibility: "PUBLIC", description: "来源公开时间。" }),
      field({ key: "isPrimary", displayName: "主要来源", type: "checkbox", required: true, visibility: "PUBLIC", description: "同一条内容优先展示的来源。" }),
      field({ key: "lastVerifiedAt", displayName: "链接验证时间", type: "dateTime", required: true, visibility: "SYSTEM", description: "最近一次确认链接可访问的时间。" }),
      ...auditFields,
    ],
    views: [
      { name: "一手来源", columns: ["sourceId", "title", "url", "publisher", "sourceType", "publishedAt", "lastVerifiedAt"], filters: [{ fieldKey: "sourceTier", operator: "equals", value: "PRIMARY" }] },
    ],
  },
  {
    key: "companies",
    displayName: "公司",
    primaryFieldKey: "companyId",
    purpose: "保存公司标准名称、别名、公开资料和融资历史关联。",
    fields: [
      field({ key: "companyId", displayName: "公司 ID", type: "text", required: true, visibility: "PUBLIC", description: "稳定公开公司 ID。" }),
      field({ key: "nameZh", displayName: "中文名称", type: "text", required: false, visibility: "PUBLIC", description: "公司中文标准名。" }),
      field({ key: "nameEn", displayName: "英文名称", type: "text", required: false, visibility: "PUBLIC", description: "公司英文标准名。" }),
      field({ key: "aliases", displayName: "别名", type: "textArray", required: false, visibility: "PUBLIC", description: "中英文历史名和常用名。" }),
      field({ key: "website", displayName: "官网", type: "url", required: true, visibility: "PUBLIC", description: "公司公开官网。" }),
      field({ key: "region", displayName: "地区", type: "text", required: true, visibility: "PUBLIC", description: "公司总部或主要地区。" }),
      field({ key: "technologyTags", displayName: "技术标签", type: "multiSelect", required: false, visibility: "PUBLIC", description: "公司具身智能技术标签。" }),
      field({ key: "publicDescription", displayName: "公司简介", type: "longText", required: true, visibility: "PUBLIC", description: "公开公司简介。" }),
      field({ key: "fundingEvents", displayName: "关联融资事件", type: "relation", required: false, visibility: "PUBLIC", relationTable: "funding_events", multiple: true, description: "公司已关联融资事件。" }),
      field({ key: "developments", displayName: "关联公司动态", type: "relation", required: false, visibility: "PUBLIC", relationTable: "company_developments", multiple: true, description: "公司已关联的技术、产品和商业化动态。" }),
      ...auditFields,
    ],
    views: [
      { name: "公司档案", columns: ["companyId", "nameZh", "nameEn", "website", "region", "technologyTags", "fundingEvents"], filters: [] },
    ],
  },
  {
    key: "daily_digests",
    displayName: "日报",
    primaryFieldKey: "digestId",
    purpose: "保存每个业务日期唯一的日报、事件顺序和发布状态。",
    fields: [
      field({ key: "digestId", displayName: "日报 ID", type: "text", required: true, visibility: "PUBLIC", description: "稳定日报 ID。" }),
      field({ key: "digestDate", displayName: "日报日期", type: "date", required: true, visibility: "PUBLIC", description: "Asia/Shanghai 业务日期。" }),
      field({ key: "title", displayName: "标题", type: "text", required: true, visibility: "PUBLIC", description: "公开日报标题。" }),
      field({ key: "fundingEvents", displayName: "今日融资", type: "relation", required: false, visibility: "PUBLIC", relationTable: "funding_events", multiple: true, description: "日报融资板块，按重要性评分降序。" }),
      field({ key: "technologyProductDevelopments", displayName: "技术与产品", type: "relation", required: false, visibility: "PUBLIC", relationTable: "company_developments", multiple: true, description: "日报技术与产品板块，按重要性评分降序。" }),
      field({ key: "commercializationDevelopments", displayName: "商业化进展", type: "relation", required: false, visibility: "PUBLIC", relationTable: "company_developments", multiple: true, description: "日报商业化板块，按重要性评分降序。" }),
      field({ key: "sectionOrder", displayName: "板块内排序", type: "longText", required: false, visibility: "PUBLIC", description: "三个板块各自的内容 ID 排序 JSON；默认按重要性降序，人工可调整。" }),
      field({ key: "reviewStatus", displayName: "审核状态", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["PENDING", "APPROVED", "REJECTED", "NEEDS_RESEARCH", "DUPLICATE"], description: "日报人工审核状态。" }),
      field({ key: "publicationStatus", displayName: "发布状态", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["DRAFT", "READY", "PUBLISHED", "CORRECTED", "WITHDRAWN"], description: "日报发布状态。" }),
      field({ key: "publishedAt", displayName: "发布时间", type: "dateTime", required: false, visibility: "PUBLIC", description: "实际发布时间。" }),
      field({ key: "autoPublished", displayName: "AI 自动发布", type: "checkbox", required: true, visibility: "PUBLIC", description: "是否未经人工审核自动发布。" }),
      field({ key: "correctionNote", displayName: "更正说明", type: "longText", required: false, visibility: "PUBLIC", description: "公开更正说明。" }),
      ...auditFields,
    ],
    views: [
      { name: "今日待审核", columns: ["digestDate", "title", "fundingEvents", "technologyProductDevelopments", "commercializationDevelopments", "sectionOrder", "reviewStatus"], filters: [{ fieldKey: "digestDate", operator: "dateIsToday" }, { fieldKey: "reviewStatus", operator: "equals", value: "PENDING" }] },
      { name: "已发布归档", columns: ["digestDate", "title", "fundingEvents", "technologyProductDevelopments", "commercializationDevelopments", "publicationStatus", "autoPublished", "correctionNote"], filters: [{ fieldKey: "publicationStatus", operator: "in", value: ["PUBLISHED", "CORRECTED"] }], sort: [{ fieldKey: "digestDate", direction: "desc" }] },
    ],
  },
  {
    key: "watch_items",
    displayName: "观察清单",
    primaryFieldKey: "watchId",
    purpose: "保存公司、机构、公众号、关键词和赛道研究目标。",
    fields: [
      field({ key: "watchId", displayName: "观察项 ID", type: "text", required: true, visibility: "INTERNAL", description: "稳定观察项 ID。" }),
      field({ key: "type", displayName: "类型", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["FOCUS_COMPANY", "FOCUS_TRACK", "INVESTOR", "FA", "WECHAT_ACCOUNT", "KEYWORD"], description: "重点公司、重点赛道、重点来源或搜索目标类型。" }),
      field({ key: "name", displayName: "名称", type: "text", required: true, visibility: "INTERNAL", description: "观察目标名称。" }),
      field({ key: "queries", displayName: "查询词", type: "textArray", required: true, visibility: "INTERNAL", description: "WorkBuddy 或 OpenAI 查询词。" }),
      field({ key: "region", displayName: "地域", type: "text", required: true, visibility: "INTERNAL", description: "关注地域。" }),
      field({ key: "technologyTags", displayName: "关联赛道标签", type: "multiSelect", required: false, visibility: "INTERNAL", description: "重点公司、来源或关键词关联的技术赛道。" }),
      field({ key: "sourceTier", displayName: "来源可信等级", type: "singleSelect", required: false, visibility: "INTERNAL", options: ["PRIMARY", "AUTHORITATIVE", "SECONDARY", "LEAD"], description: "重点公众号或其他来源的默认可信等级；不等同于搜索优先级。" }),
      field({ key: "priority", displayName: "优先级", type: "singleSelect", required: true, visibility: "INTERNAL", options: ["LOW", "MEDIUM", "HIGH"], description: "研究优先级。" }),
      field({ key: "enabled", displayName: "是否启用", type: "checkbox", required: true, visibility: "INTERNAL", description: "是否参与研究任务。" }),
      ...auditFields,
    ],
    views: [
      { name: "已启用", columns: ["watchId", "type", "name", "queries", "region", "technologyTags", "priority"], filters: [{ fieldKey: "enabled", operator: "equals", value: true }], sort: [{ fieldKey: "priority", direction: "desc" }] },
    ],
  },
  {
    key: "internal_assessments",
    displayName: "内部战投备注",
    primaryFieldKey: "assessmentId",
    purpose: "保存只允许内部团队访问的战略判断和跟进信息。",
    fields: [
      field({ key: "assessmentId", displayName: "内部备注 ID", type: "text", required: true, visibility: "SENSITIVE", description: "稳定内部备注 ID。" }),
      field({ key: "company", displayName: "公司关联", type: "relation", required: false, visibility: "SENSITIVE", relationTable: "companies", multiple: false, description: "关联公司；与事件关联二选一。" }),
      field({ key: "fundingEvent", displayName: "事件关联", type: "relation", required: false, visibility: "SENSITIVE", relationTable: "funding_events", multiple: false, description: "关联融资事件；与公司关联二选一。" }),
      field({ key: "attentionLevel", displayName: "内部关注等级", type: "singleSelect", required: true, visibility: "SENSITIVE", options: ["LOW", "MEDIUM", "HIGH", "STRATEGIC"], description: "内部关注等级。" }),
      field({ key: "strategicAssessment", displayName: "战投判断", type: "longText", required: false, visibility: "SENSITIVE", description: "内部战略判断。" }),
      field({ key: "followUpStatus", displayName: "跟进状态", type: "singleSelect", required: true, visibility: "SENSITIVE", options: ["NOT_STARTED", "RESEARCHING", "CONTACTING", "IN_PROGRESS", "PAUSED", "CLOSED"], description: "内部跟进阶段。" }),
      field({ key: "owner", displayName: "负责人", type: "user", required: true, visibility: "SENSITIVE", description: "内部负责人。" }),
      field({ key: "internalNotes", displayName: "内部备注", type: "longText", required: false, visibility: "SENSITIVE", description: "禁止公开的内部信息。" }),
      ...auditFields,
    ],
    views: [
      { name: "跟进中", columns: ["assessmentId", "company", "fundingEvent", "attentionLevel", "followUpStatus", "owner"], filters: [{ fieldKey: "followUpStatus", operator: "in", value: ["CONTACTING", "IN_PROGRESS"] }] },
    ],
  },
  {
    key: "automation_runs",
    displayName: "自动化任务",
    primaryFieldKey: "runId",
    purpose: "保存自动任务的幂等、锁、重试、结果和人工处理状态。",
    fields: [
      field({ key: "runId", displayName: "任务 ID", type: "text", required: true, visibility: "SYSTEM", description: "业务日期与任务类型形成的稳定任务 ID。" }),
      field({ key: "businessDate", displayName: "业务日期", type: "date", required: true, visibility: "SYSTEM", description: "Asia/Shanghai 业务日期。" }),
      field({ key: "jobType", displayName: "任务类型", type: "singleSelect", required: true, visibility: "SYSTEM", options: ["DISCOVER_OVERSEAS", "PROCESS_CANDIDATES", "CREATE_REVIEW_DIGEST", "PUBLISH_DIGEST", "BUILD_SITE", "NOTIFY", "BACKFILL"], description: "自动化任务类型。" }),
      field({ key: "status", displayName: "运行状态", type: "singleSelect", required: true, visibility: "SYSTEM", options: ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "REQUIRES_MANUAL_ACTION"], description: "任务运行状态。" }),
      field({ key: "attempt", displayName: "尝试次数", type: "number", required: true, visibility: "SYSTEM", description: "已执行尝试次数。" }),
      field({ key: "startedAt", displayName: "开始时间", type: "dateTime", required: false, visibility: "SYSTEM", description: "本次运行开始时间。" }),
      field({ key: "finishedAt", displayName: "结束时间", type: "dateTime", required: false, visibility: "SYSTEM", description: "本次运行结束时间。" }),
      field({ key: "errorCode", displayName: "错误码", type: "text", required: false, visibility: "SYSTEM", description: "稳定简化错误码。" }),
      field({ key: "errorSummary", displayName: "简化错误原因", type: "longText", required: false, visibility: "SYSTEM", description: "不含密钥和完整响应的错误摘要。" }),
      field({ key: "manualActionRequired", displayName: "需要人工处理", type: "checkbox", required: true, visibility: "SYSTEM", description: "是否需要管理员介入。" }),
      field({ key: "lockOwner", displayName: "任务锁持有者", type: "text", required: false, visibility: "SYSTEM", description: "并发任务锁持有者。" }),
      field({ key: "lockExpiresAt", displayName: "任务锁过期时间", type: "dateTime", required: false, visibility: "SYSTEM", description: "任务锁失效时间。" }),
      ...auditFields,
    ],
    views: [
      { name: "待执行", columns: ["runId", "businessDate", "jobType", "status", "attempt"], filters: [{ fieldKey: "status", operator: "equals", value: "PENDING" }], sort: [{ fieldKey: "businessDate", direction: "asc" }] },
      { name: "失败与人工处理", columns: ["runId", "businessDate", "jobType", "status", "attempt", "errorCode", "errorSummary", "manualActionRequired"], filters: [{ fieldKey: "status", operator: "in", value: ["FAILED", "REQUIRES_MANUAL_ACTION"] }] },
    ],
  },
] as const;

export const feishuTableByKey = Object.fromEntries(
  feishuTableDefinitions.map((table) => [table.key, table]),
) as Readonly<Record<FeishuTableKey, FeishuTableDefinition>>;
