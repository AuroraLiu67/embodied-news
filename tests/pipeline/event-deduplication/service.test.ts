import { describe, expect, it, vi } from "vitest";

import type { SourceEvidence } from "../../../lib/domain";
import {
  EventDeduplicationService,
  type ProcessedCandidateDirectory,
  type ProcessedFundingCandidate,
} from "../../../lib/pipeline/event-deduplication";
import { candidateFixture } from "../../fixtures/domain";

const officialEvidence: SourceEvidence = {
  sourceUrl: "https://example.com/news/galbot-funding",
  sourceName: "公司官网",
  sourceType: "COMPANY",
  sourceTier: "PRIMARY",
  title: candidateFixture.title,
  publishedAt: candidateFixture.publishedAt,
  accessedAt: "2026-08-01T01:00:00.000Z",
  supportsFacts: [
    "companyName",
    "round",
    "amount",
    "currency",
    "amountDisclosed",
    "investors",
    "announcedAt",
  ],
};

const existingCandidate: ProcessedFundingCandidate = {
  candidateId: "candidate-existing-001",
  canonicalUrl: "https://example.com/news/galbot-series-a",
  companyId: "company-galbot",
  facts: {
    companyName: "银河通用",
    round: "A轮",
    amount: "100000000",
    currency: "CNY",
    amountDisclosed: true,
    investors: ["示例创投"],
    announcedAt: "2026-07-30",
    region: "中国",
    technologyTags: ["具身智能"],
  },
  evidence: [{
    ...officialEvidence,
    sourceUrl: "https://example.com/news/galbot-series-a",
  }],
  conflicts: [],
};

const directory = (
  records: readonly ProcessedFundingCandidate[],
): ProcessedCandidateDirectory => ({
  listProcessedCandidates: vi.fn().mockResolvedValue(records),
});

const incoming = (overrides: Partial<Parameters<EventDeduplicationService["evaluate"]>[0]> = {}) => ({
  candidate: {
    ...candidateFixture,
    candidateId: "candidate-incoming-001",
    sourceUrl: "https://media.example/galbot-series-a",
    canonicalUrl: "https://media.example/galbot-series-a",
  },
  companyId: "company-galbot",
  facts: existingCandidate.facts,
  evidence: [{
    ...officialEvidence,
    sourceUrl: "https://media.example/galbot-series-a",
    sourceName: "权威媒体",
    sourceType: "MEDIA" as const,
    sourceTier: "AUTHORITATIVE" as const,
  }],
  conflicts: [],
  ...overrides,
});

describe("event deduplication service", () => {
  it("marks the same canonical URL as a strong duplicate", async () => {
    const result = await new EventDeduplicationService(
      directory([existingCandidate]),
    ).evaluate(incoming({
      candidate: {
        ...candidateFixture,
        candidateId: "candidate-incoming-001",
        canonicalUrl: existingCandidate.canonicalUrl,
      },
    }));
    expect(result).toMatchObject({
      status: "URL_DUPLICATE",
      duplicateOf: existingCandidate.candidateId,
      candidate: { reviewStatus: "DUPLICATE" },
    });
  });

  it("merges repost sources for the same company, date, round, and amount", async () => {
    const result = await new EventDeduplicationService(
      directory([existingCandidate]),
    ).evaluate(incoming());
    expect(result.status).toBe("EVENT_DUPLICATE");
    expect(result.duplicateOf).toBe(existingCandidate.candidateId);
    expect(result.evidence.map((source) => source.sourceUrl)).toEqual([
      "https://example.com/news/galbot-series-a",
      "https://media.example/galbot-series-a",
    ]);
  });

  it("does not merge a distinct later financing by the same company", async () => {
    const result = await new EventDeduplicationService(
      directory([existingCandidate]),
    ).evaluate(incoming({
      facts: {
        ...existingCandidate.facts,
        round: "B轮",
        amount: "300000000",
        announcedAt: "2026-12-01",
      },
    }));
    expect(result).toMatchObject({
      status: "NEW",
      duplicateOf: null,
    });
  });

  it("keeps conflicting round and amount values with sources for review", async () => {
    const result = await new EventDeduplicationService(
      directory([existingCandidate]),
    ).evaluate(incoming({
      facts: {
        ...existingCandidate.facts,
        round: "A+轮",
        amount: "120000000",
      },
    }));
    expect(result.status).toBe("CONFLICT");
    expect(result.candidate.reviewStatus).toBe("NEEDS_RESEARCH");
    expect(result.candidate.duplicateOf).toBe(existingCandidate.candidateId);
    expect(result.conflicts.map((conflict) => conflict.field)).toEqual([
      "round",
      "amount",
    ]);
    expect(result.conflicts[0].values).toEqual([
      {
        value: "A轮",
        sourceUrl: "https://example.com/news/galbot-series-a",
      },
      {
        value: "A+轮",
        sourceUrl: "https://media.example/galbot-series-a",
      },
    ]);
  });

  it("treats a rerun of the same candidate ID as existing", async () => {
    const rerun = {
      ...existingCandidate,
      candidateId: candidateFixture.candidateId,
      canonicalUrl: candidateFixture.canonicalUrl,
    };
    const result = await new EventDeduplicationService(
      directory([rerun]),
    ).evaluate({
      candidate: candidateFixture,
      companyId: rerun.companyId,
      facts: rerun.facts,
      evidence: rerun.evidence,
      conflicts: [],
    });
    expect(result).toMatchObject({ status: "EXISTING" });
    expect(result.candidate.reviewStatus).toBe(candidateFixture.reviewStatus);
  });

  it("keeps the same event at different companies separate", async () => {
    const result = await new EventDeduplicationService(
      directory([existingCandidate]),
    ).evaluate(incoming({ companyId: "company-different" }));
    expect(result.status).toBe("NEW");
  });

  it("rejects malformed evidence before comparing records", async () => {
    await expect(
      new EventDeduplicationService(directory([])).evaluate(incoming({
        evidence: [{ ...officialEvidence, sourceUrl: "http://127.0.0.1/private" }],
      })),
    ).rejects.toMatchObject({
      name: "EventDeduplicationError",
      code: "EVENT_DEDUPLICATION_INPUT_INVALID",
    });
  });

  it("rejects malformed historical directory records", async () => {
    const malformed = {
      ...existingCandidate,
      canonicalUrl: "http://169.254.169.254/metadata",
    };
    await expect(
      new EventDeduplicationService(directory([malformed])).evaluate(incoming()),
    ).rejects.toMatchObject({
      code: "EVENT_DEDUPLICATION_INPUT_INVALID",
    });
  });
});
