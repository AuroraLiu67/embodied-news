export interface FeishuDesignRecord {
  tableKey:
    | "companies"
    | "funding_events"
    | "company_developments"
    | "information_sources"
    | "daily_digests";
  fields: Readonly<Record<string, unknown>>;
}

export const companyDesignRecord = {
  tableKey: "companies",
  fields: {
    companyId: "company-example-robotics",
    nameZh: "示例机器人",
    nameEn: "Example Robotics",
    aliases: ["Example Robot"],
    website: "https://example.com/",
    region: "中国",
    technologyTags: ["具身智能"],
    publicDescription: "用于验证飞书关联的脱敏示例公司。",
    fundingEvents: ["event-example-series-a"],
    developments: ["development-example-product"],
    version: 1,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
  },
} satisfies FeishuDesignRecord;

export const eventDesignRecord = {
  tableKey: "funding_events",
  fields: {
    eventId: "event-example-series-a",
    company: ["company-example-robotics"],
    round: "A轮",
    amount: "100000000",
    currency: "CNY",
    amountDisclosed: true,
    investors: ["示例创投"],
    announcedAt: "2026-07-31",
    region: "中国",
    technologyTags: ["具身智能"],
    publicSummary: "示例机器人完成 A 轮融资。",
    publicWhyItMatters: "用于验证公开融资事件字段。",
    sources: ["source-example-official"],
    confidenceLevel: "HIGH",
    importanceScore: 5,
    importanceReason: "重点赛道公司获得重要融资。",
    isPublic: true,
    publicationStatus: "PUBLISHED",
    version: 1,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
  },
} satisfies FeishuDesignRecord;

export const sourceDesignRecord = {
  tableKey: "information_sources",
  fields: {
    sourceId: "source-example-official",
    title: "示例机器人发布融资与产品进展",
    url: "https://example.com/news/official-update",
    publisher: "示例机器人",
    sourceType: "COMPANY",
    sourceTier: "PRIMARY",
    publishedAt: "2026-07-31T00:00:00.000Z",
    isPrimary: true,
    lastVerifiedAt: "2026-07-31T00:30:00.000Z",
    version: 1,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:30:00.000Z",
  },
} satisfies FeishuDesignRecord;

export const developmentDesignRecord = {
  tableKey: "company_developments",
  fields: {
    developmentId: "development-example-product",
    company: ["company-example-robotics"],
    category: "PRODUCT",
    title: "示例机器人发布新一代产品",
    announcedAt: "2026-07-31",
    technologyTags: ["具身智能"],
    publicSummary: "示例机器人发布新一代具身智能产品。",
    publicWhyItMatters: "用于验证技术与产品板块。",
    sources: ["source-example-official"],
    confidenceLevel: "HIGH",
    importanceScore: 4,
    importanceReason: "重点赛道产品更新且具有一手来源。",
    isPublic: true,
    publicationStatus: "PUBLISHED",
    version: 1,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
  },
} satisfies FeishuDesignRecord;

export const digestDesignRecord = {
  tableKey: "daily_digests",
  fields: {
    digestId: "digest-2026-07-31",
    digestDate: "2026-07-31",
    title: "具身智能公司动态日报｜2026-07-31",
    fundingEvents: ["event-example-series-a"],
    technologyProductDevelopments: ["development-example-product"],
    commercializationDevelopments: [],
    sectionOrder:
      '{"funding":["event-example-series-a"],"technologyProduct":["development-example-product"],"commercialization":[]}',
    reviewStatus: "APPROVED",
    publicationStatus: "PUBLISHED",
    publishedAt: "2026-07-31T01:00:00.000Z",
    autoPublished: false,
    correctionNote: null,
    version: 1,
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T01:00:00.000Z",
  },
} satisfies FeishuDesignRecord;

export const feishuDesignRecords = [
  companyDesignRecord,
  eventDesignRecord,
  sourceDesignRecord,
  developmentDesignRecord,
  digestDesignRecord,
] as const;
