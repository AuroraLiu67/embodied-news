import type {
  AutomationRun,
  Company,
  CompanyDevelopment,
  DailyDigest,
  FundingEvent,
  InformationSource,
  InternalAssessment,
  PublicCompany,
  PublicCompanyDevelopment,
  PublicDailyDigest,
  PublicFundingEvent,
  ResearchCandidate,
  WatchItem,
} from "../../lib/domain";

export const companyFixture = {
  companyId: "company-galbot",
  nameZh: "银河通用",
  nameEn: "Galbot",
  aliases: ["银河通用机器人"],
  website: "https://www.galbot.com/",
  region: "中国",
  technologyTags: ["具身智能", "通用机器人"],
  publicDescription: "研发通用具身智能机器人与相关基础模型。",
} satisfies Company;

export const candidateFixture = {
  candidateId: "candidate-2026-001",
  sourceUrl: "https://example.com/news/galbot-funding",
  canonicalUrl: "https://example.com/news/galbot-funding",
  title: "银河通用完成新一轮融资",
  sourceName: "公司官网",
  sourceType: "COMPANY",
  sourceTier: "PRIMARY",
  regionScope: "CHINA",
  discoveredBy: "WORKBUDDY",
  publishedAt: "2026-07-30T01:00:00.000Z",
  discoveredAt: "2026-07-30T02:00:00.000Z",
  rawExcerpt: "公司宣布完成新一轮融资，金额未披露。",
  relevance: {
    decision: "RELEVANT",
    confidence: {
      level: "HIGH",
      score: 0.96,
      reasons: ["公司官方来源", "明确提及机器人融资"],
    },
    reason: "事件同时满足具身智能行业范围和融资事件定义。",
    model: "fixture-relevance-model",
  },
  extractedFacts: {
    companyName: "银河通用",
    round: null,
    amount: null,
    currency: null,
    amountDisclosed: false,
    investors: [],
    announcedAt: "2026-07-30",
    region: "中国",
    technologyTags: ["具身智能", "通用机器人"],
  },
  confidence: {
    level: "HIGH",
    score: 0.96,
    reasons: ["公司官方来源"],
  },
  duplicateOf: null,
  conflicts: [],
  reviewStatus: "PENDING",
} satisfies ResearchCandidate;

export const informationSourceFixture = {
  sourceId: "source-galbot-official-001",
  title: candidateFixture.title,
  url: candidateFixture.sourceUrl,
  publisher: candidateFixture.sourceName,
  sourceType: "COMPANY",
  sourceTier: "PRIMARY",
  publishedAt: candidateFixture.publishedAt,
  isPrimary: true,
  lastVerifiedAt: candidateFixture.discoveredAt,
} satisfies InformationSource;

export const fundingEventFixture = {
  eventId: "event-2026-001",
  companyId: companyFixture.companyId,
  round: null,
  amount: null,
  currency: null,
  amountDisclosed: false,
  investors: [],
  announcedAt: "2026-07-30",
  region: "中国",
  technologyTags: ["具身智能", "通用机器人"],
  publicSummary: "银河通用宣布完成新一轮融资，具体轮次和金额未披露。",
  publicWhyItMatters: "本次融资将支持通用具身智能技术的持续研发。",
  sourceIds: [informationSourceFixture.sourceId],
  confidence: {
    level: "HIGH",
    score: 0.96,
    reasons: ["公司官方来源"],
  },
  importanceScore: 5,
  importanceReason: "公司官方披露且属于重点具身智能企业融资。",
  publicationStatus: "PUBLISHED",
  isPublic: true,
} satisfies FundingEvent;

const developmentBase = {
  companyId: companyFixture.companyId,
  announcedAt: "2026-07-30",
  technologyTags: ["具身智能", "通用机器人"],
  sourceIds: [informationSourceFixture.sourceId],
  confidence: {
    level: "HIGH",
    score: 0.94,
    reasons: ["公司官方来源"],
  },
  importanceReason: "重点公司的公开进展。",
  publicationStatus: "PUBLISHED",
  isPublic: true,
} as const;

export const technologyDevelopmentFixture = {
  ...developmentBase,
  developmentId: "development-technology-001",
  category: "TECHNOLOGY",
  title: "银河通用发布新一代具身基础模型",
  publicSummary: "公司公布新一代具身基础模型技术进展。",
  publicWhyItMatters: "模型能力提升有助于通用机器人完成更多真实任务。",
  importanceScore: 5,
} satisfies CompanyDevelopment;

export const productDevelopmentFixture = {
  ...developmentBase,
  developmentId: "development-product-001",
  category: "PRODUCT",
  title: "银河通用发布通用机器人新产品",
  publicSummary: "公司发布面向真实场景的新一代通用机器人产品。",
  publicWhyItMatters: "产品发布推动技术能力进入可交付形态。",
  importanceScore: 4,
} satisfies CompanyDevelopment;

export const commercializationDevelopmentFixture = {
  ...developmentBase,
  developmentId: "development-commercialization-001",
  category: "COMMERCIALIZATION",
  title: "银河通用公布新商业化落地进展",
  publicSummary: "公司公布通用机器人在客户现场的商业化落地进展。",
  publicWhyItMatters: "真实客户部署验证产品的商业价值。",
  importanceScore: 4,
} satisfies CompanyDevelopment;

export const digestFixture = {
  digestId: "digest-2026-07-30",
  digestDate: "2026-07-30",
  title: "具身智能融资日报｜2026-07-30",
  fundingEventIds: [fundingEventFixture.eventId],
  technologyProductDevelopmentIds: [
    technologyDevelopmentFixture.developmentId,
    productDevelopmentFixture.developmentId,
  ],
  commercializationDevelopmentIds: [
    commercializationDevelopmentFixture.developmentId,
  ],
  sectionOrder: [
    {
      section: "TECHNOLOGY_PRODUCT",
      itemId: productDevelopmentFixture.developmentId,
      rank: 1,
    },
  ],
  marketObservation: "具身智能企业融资活动保持活跃。",
  reviewStatus: "APPROVED",
  publicationStatus: "PUBLISHED",
  publishedAt: "2026-07-30T01:00:00.000Z",
  autoPublished: false,
  correctionNote: null,
} satisfies DailyDigest;

export const watchItemFixture = {
  watchId: "watch-galbot",
  type: "COMPANY",
  name: "银河通用",
  queries: ["银河通用 融资", "Galbot funding"],
  region: "中国",
  technologyTags: ["具身智能"],
  priority: "HIGH",
  enabled: true,
} satisfies WatchItem;

export const internalAssessmentFixture = {
  assessmentId: "assessment-galbot",
  companyId: companyFixture.companyId,
  eventId: null,
  attentionLevel: "STRATEGIC",
  strategicAssessment: "仅供内部评估的战略协同判断。",
  followUpStatus: "RESEARCHING",
  owner: "内部负责人",
  internalNotes: "此内容不得进入公开 DTO。",
} satisfies InternalAssessment;

export const automationRunFixture = {
  runId: "run-2026-07-30-build-site",
  businessDate: "2026-07-30",
  jobType: "BUILD_SITE",
  status: "SUCCEEDED",
  attempt: 1,
  startedAt: "2026-07-30T00:50:00.000Z",
  finishedAt: "2026-07-30T00:51:00.000Z",
  errorCode: null,
  errorSummary: null,
  manualActionRequired: false,
} satisfies AutomationRun;

export const publicFundingEventFixture = {
  eventId: fundingEventFixture.eventId,
  companyId: fundingEventFixture.companyId,
  round: fundingEventFixture.round,
  amount: fundingEventFixture.amount,
  currency: fundingEventFixture.currency,
  amountDisclosed: fundingEventFixture.amountDisclosed,
  investors: fundingEventFixture.investors,
  announcedAt: fundingEventFixture.announcedAt,
  region: fundingEventFixture.region,
  technologyTags: fundingEventFixture.technologyTags,
  publicSummary: fundingEventFixture.publicSummary,
  publicWhyItMatters: fundingEventFixture.publicWhyItMatters,
  sourceEvidence: [
    {
      sourceUrl: informationSourceFixture.url,
      sourceName: informationSourceFixture.publisher,
      sourceType: informationSourceFixture.sourceType,
      sourceTier: informationSourceFixture.sourceTier,
      title: informationSourceFixture.title,
      publishedAt: informationSourceFixture.publishedAt,
    },
  ],
  confidence: fundingEventFixture.confidence,
  importanceScore: fundingEventFixture.importanceScore,
  importanceReason: fundingEventFixture.importanceReason,
  publicationStatus: "PUBLISHED",
} satisfies PublicFundingEvent;

export const publicTechnologyDevelopmentFixture = {
  developmentId: technologyDevelopmentFixture.developmentId,
  companyId: technologyDevelopmentFixture.companyId,
  category: technologyDevelopmentFixture.category,
  title: technologyDevelopmentFixture.title,
  announcedAt: technologyDevelopmentFixture.announcedAt,
  technologyTags: technologyDevelopmentFixture.technologyTags,
  publicSummary: technologyDevelopmentFixture.publicSummary,
  publicWhyItMatters: technologyDevelopmentFixture.publicWhyItMatters,
  sourceEvidence: publicFundingEventFixture.sourceEvidence,
  confidence: technologyDevelopmentFixture.confidence,
  importanceScore: technologyDevelopmentFixture.importanceScore,
  importanceReason: technologyDevelopmentFixture.importanceReason,
  publicationStatus: "PUBLISHED",
} satisfies PublicCompanyDevelopment;

export const publicCompanyFixture = {
  ...companyFixture,
  fundingEventIds: [fundingEventFixture.eventId],
  developmentIds: [
    technologyDevelopmentFixture.developmentId,
    productDevelopmentFixture.developmentId,
    commercializationDevelopmentFixture.developmentId,
  ],
} satisfies PublicCompany;

export const publicDigestFixture = {
  digestId: digestFixture.digestId,
  digestDate: digestFixture.digestDate,
  title: digestFixture.title,
  funding: [
    {
      itemId: fundingEventFixture.eventId,
      kind: "FUNDING",
      companyId: fundingEventFixture.companyId,
      title: candidateFixture.title,
      publicSummary: fundingEventFixture.publicSummary,
      importanceScore: fundingEventFixture.importanceScore,
      importanceReason: fundingEventFixture.importanceReason,
      sources: publicFundingEventFixture.sourceEvidence,
    },
  ],
  technologyProduct: [
    {
      itemId: technologyDevelopmentFixture.developmentId,
      kind: "TECHNOLOGY",
      companyId: technologyDevelopmentFixture.companyId,
      title: technologyDevelopmentFixture.title,
      publicSummary: technologyDevelopmentFixture.publicSummary,
      importanceScore: technologyDevelopmentFixture.importanceScore,
      importanceReason: technologyDevelopmentFixture.importanceReason,
      sources: publicTechnologyDevelopmentFixture.sourceEvidence,
    },
  ],
  commercialization: [
    {
      itemId: commercializationDevelopmentFixture.developmentId,
      kind: "COMMERCIALIZATION",
      companyId: commercializationDevelopmentFixture.companyId,
      title: commercializationDevelopmentFixture.title,
      publicSummary: commercializationDevelopmentFixture.publicSummary,
      importanceScore: commercializationDevelopmentFixture.importanceScore,
      importanceReason: commercializationDevelopmentFixture.importanceReason,
      sources: publicFundingEventFixture.sourceEvidence,
    },
  ],
  marketObservation: digestFixture.marketObservation,
  publicationStatus: "PUBLISHED",
  publishedAt: digestFixture.publishedAt,
  autoPublished: digestFixture.autoPublished,
  correctionNote: digestFixture.correctionNote,
} satisfies PublicDailyDigest;
