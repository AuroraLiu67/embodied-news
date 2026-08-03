import type { FundingEvent, ResearchCandidate } from "../../lib/domain";
import { candidateFixture, fundingEventFixture } from "./domain";

export const domesticCandidateFixture = candidateFixture;

export const overseasCandidateFixture = {
  ...candidateFixture,
  candidateId: "candidate-overseas-001",
  sourceUrl: "https://example.org/news/robotics-series-a",
  canonicalUrl: "https://example.org/news/robotics-series-a",
  title: "Example Robotics raises Series A",
  sourceName: "Example Robotics",
  regionScope: "OVERSEAS",
  discoveredBy: "OPENAI",
  rawExcerpt: "The company announced a Series A financing round.",
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
} satisfies ResearchCandidate;

export const undisclosedAmountEventFixture = fundingEventFixture;

export const multiSourceEventFixture = {
  ...fundingEventFixture,
  eventId: "event-multi-source-001",
  round: "A轮",
  amount: "100000000",
  currency: "CNY",
  amountDisclosed: true,
  investors: ["示例创投"],
  sourceIds: [...fundingEventFixture.sourceIds, "source-investor-001"],
} satisfies FundingEvent;

export const conflictingCandidateFixture = {
  ...candidateFixture,
  candidateId: "candidate-conflict-001",
  sourceUrl: "https://example.com/news/conflicting-round",
  canonicalUrl: "https://example.com/news/conflicting-round",
  conflicts: [
    {
      field: "round",
      values: [
        {
          value: "A轮",
          sourceUrl: "https://example.com/news/conflicting-round",
        },
        {
          value: "A+轮",
          sourceUrl: "https://example.net/investor/portfolio-news",
        },
      ],
    },
  ],
  reviewStatus: "NEEDS_RESEARCH",
} satisfies ResearchCandidate;

export const duplicateCandidateFixture = {
  ...candidateFixture,
  candidateId: "candidate-duplicate-001",
  sourceUrl: "https://example.net/repost/galbot-funding",
  canonicalUrl: "https://example.net/repost/galbot-funding",
  duplicateOf: candidateFixture.candidateId,
  reviewStatus: "DUPLICATE",
} satisfies ResearchCandidate;

export const lowConfidenceCandidateFixture = {
  ...candidateFixture,
  candidateId: "candidate-low-confidence-001",
  sourceUrl: "https://example.net/search/possible-funding",
  canonicalUrl: "https://example.net/search/possible-funding",
  sourceName: "搜索线索",
  sourceType: "SEARCH_SNIPPET",
  sourceTier: "LEAD",
  confidence: {
    level: "LOW",
    score: 0.25,
    reasons: ["只有搜索摘要", "缺少官方来源"],
  },
  relevance: {
    decision: "UNCERTAIN",
    confidence: {
      level: "LOW",
      score: 0.3,
      reasons: ["行业关联尚不明确"],
    },
    reason: "需要补充原始来源和公司信息。",
    model: "fixture-relevance-model",
  },
  reviewStatus: "NEEDS_RESEARCH",
} satisfies ResearchCandidate;

export const candidateScenarioFixtures = [
  domesticCandidateFixture,
  overseasCandidateFixture,
  conflictingCandidateFixture,
  duplicateCandidateFixture,
  lowConfidenceCandidateFixture,
] as const;

export const fundingEventScenarioFixtures = [
  undisclosedAmountEventFixture,
  multiSourceEventFixture,
] as const;
