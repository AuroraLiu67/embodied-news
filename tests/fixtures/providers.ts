import { candidateFixture } from "./domain";

export const workBuddyInputFixture = {
  title: candidateFixture.title,
  sourceUrl: candidateFixture.sourceUrl,
  sourceName: candidateFixture.sourceName,
  contentType: "FUNDING",
  sourceType: "COMPANY",
  sourceTier: "PRIMARY",
  publishedAt: candidateFixture.publishedAt,
  queries: ["银河通用 融资"],
  preliminarySummary: candidateFixture.rawExcerpt,
  discoveredAt: candidateFixture.discoveredAt,
};

export const openAiOutputFixture = {
  relevance: {
    decision: "RELEVANT",
    confidence: {
      level: "HIGH",
      score: 0.95,
      reasons: ["公司官方来源"],
    },
    reason: "属于具身智能融资事件。",
  },
  extractedFacts: {
    companyName: "Example Robotics",
    round: "Series A",
    amount: "25000000",
    currency: "USD",
    amountDisclosed: true,
    investors: ["Example Ventures"],
    announcedAt: "2026-07-29",
    region: "美国",
    technologyTags: ["具身智能"],
  },
  conflicts: [],
  sources: [
    {
      sourceUrl: "https://example.org/news/robotics-series-a",
      sourceName: "Example Robotics",
      sourceType: "COMPANY",
      sourceTier: "PRIMARY",
      title: "Example Robotics raises Series A",
      publishedAt: "2026-07-29T01:00:00.000Z",
      supportsFacts: [
        "companyName",
        "round",
        "amount",
        "currency",
        "amountDisclosed",
        "investors",
        "announcedAt",
        "region",
        "technologyTags",
      ],
    },
  ],
  publicSummary: "Example Robotics 宣布完成 A 轮融资。",
  publicWhyItMatters: "融资将支持具身智能产品研发。",
};

export const feishuRecordFixture = {
  table: "研究候选",
  recordId: "rec_candidate_001",
  version: 1,
  updatedAt: candidateFixture.discoveredAt,
  fields: candidateFixture,
};
