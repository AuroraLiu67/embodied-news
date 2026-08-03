import { describe, expect, it } from "vitest";

import type { FactConflict, SourceEvidence } from "../../../lib/domain";
import { ConfidenceSummaryService } from "../../../lib/pipeline/confidence-summary";
import { candidateFixture } from "../../fixtures/domain";

const primary: SourceEvidence = {
  sourceUrl: "https://example.com/company/funding",
  sourceName: "公司官网",
  sourceType: "COMPANY",
  sourceTier: "PRIMARY",
  title: "公司融资公告",
  publishedAt: "2026-07-30T01:00:00.000Z",
  accessedAt: "2026-08-01T01:00:00.000Z",
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
};

const secondary: SourceEvidence = {
  ...primary,
  sourceUrl: "https://media.example/funding",
  sourceName: "行业媒体",
  sourceType: "MEDIA",
  sourceTier: "SECONDARY",
};

const authoritative: SourceEvidence = {
  ...primary,
  sourceUrl: "https://investor.example/announcement",
  sourceName: "投资机构",
  sourceType: "INVESTOR",
  sourceTier: "AUTHORITATIVE",
};

const lead: SourceEvidence = {
  ...primary,
  sourceUrl: "https://search.example/snippet",
  sourceName: "搜索线索",
  sourceType: "SEARCH_SNIPPET",
  sourceTier: "LEAD",
};

const facts = {
  companyName: "银河通用",
  round: "A轮",
  amount: "100000000",
  currency: "CNY",
  amountDisclosed: true,
  investors: ["示例创投"],
  announcedAt: "2026-07-30",
  region: "中国",
  technologyTags: ["具身智能"],
} as const;

const evaluate = (
  evidence: readonly SourceEvidence[],
  accessibleSourceUrls = evidence.map((source) => source.sourceUrl),
  conflicts: readonly FactConflict[] = [],
) => new ConfidenceSummaryService().evaluate({
  candidate: candidateFixture,
  facts,
  evidence,
  conflicts,
  accessibleSourceUrls,
});

describe("confidence and traceable summary service", () => {
  it("assigns high confidence to complete accessible primary evidence", () => {
    const result = evaluate([primary]);
    expect(result.candidate.confidence).toMatchObject({
      level: "HIGH",
      score: 0.945,
    });
    expect(result.metrics).toEqual({
      sourceCount: 1,
      authoritativeSourceCount: 1,
      factCoverage: 1,
      accessibleSourceRatio: 1,
      conflictCount: 0,
    });
  });

  it("assigns medium confidence to complete secondary evidence", () => {
    const result = evaluate([secondary]);
    expect(result.candidate.confidence).toMatchObject({
      level: "MEDIUM",
      score: 0.78,
    });
  });

  it("keeps lead-only or inaccessible evidence low and pending research", () => {
    const leadOnly = evaluate([lead]);
    expect(leadOnly.candidate.confidence?.level).toBe("LOW");
    expect(leadOnly.candidate.reviewStatus).toBe("NEEDS_RESEARCH");

    const inaccessible = evaluate([primary], []);
    expect(inaccessible.candidate.confidence?.level).toBe("LOW");
    expect(inaccessible.metrics.accessibleSourceRatio).toBe(0);
  });

  it("never lowers confidence when an authoritative supporting source is added", () => {
    const before = evaluate([secondary]);
    const after = evaluate([secondary, authoritative]);
    expect(after.candidate.confidence!.score).toBeGreaterThanOrEqual(
      before.candidate.confidence!.score,
    );
    expect(after.candidate.confidence?.level).toBe("HIGH");
  });

  it("merges duplicate source URLs without order-dependent confidence loss", () => {
    const weakerDuplicate = {
      ...primary,
      sourceTier: "SECONDARY" as const,
      supportsFacts: ["companyName"] as const,
    };
    const first = evaluate([primary, weakerDuplicate]);
    const second = evaluate([weakerDuplicate, primary]);
    expect(first.candidate.confidence).toEqual(second.candidate.confidence);
    expect(first.metrics.sourceCount).toBe(1);
  });

  it("caps conflicts below high confidence and sends them for review", () => {
    const conflict: FactConflict = {
      field: "round",
      values: [
        { value: "A轮", sourceUrl: primary.sourceUrl },
        { value: "A+轮", sourceUrl: authoritative.sourceUrl },
      ],
    };
    const result = evaluate([primary, authoritative], undefined, [conflict]);
    expect(result.candidate.confidence?.level).toBe("MEDIUM");
    expect(result.candidate.confidence!.score).toBeLessThanOrEqual(0.69);
    expect(result.candidate.reviewStatus).toBe("NEEDS_RESEARCH");
    expect(result.publicSummary).not.toContain("A轮");
  });

  it("makes every summary claim traceable to evidence supporting its fields", () => {
    const result = evaluate([primary, authoritative]);
    expect(result.publicSummary).toContain("银河通用");
    expect(result.publicSummary).toContain("CNY 100000000");
    expect(result.claims.length).toBeGreaterThan(0);
    for (const claim of result.claims) {
      expect(claim.sourceUrls.length).toBeGreaterThan(0);
      for (const field of claim.factFields) {
        expect(
          [primary, authoritative].some(
            (source) =>
              claim.sourceUrls.includes(source.sourceUrl) &&
              source.supportsFacts.includes(field),
          ),
        ).toBe(true);
      }
    }
  });

  it("omits unsupported facts from the summary rather than inventing citations", () => {
    const limited = {
      ...primary,
      supportsFacts: ["companyName", "amountDisclosed"] as const,
    };
    const result = evaluate([limited]);
    expect(result.publicSummary).toContain("银河通用");
    expect(result.publicSummary).not.toContain("A轮");
    expect(result.publicSummary).not.toContain("示例创投");
    expect(result.candidate.confidence?.level).toBe("LOW");
  });

  it("rejects accessible URLs that are not part of the evidence set", () => {
    expect(() => evaluate([primary], ["https://unknown.example/source"])).toThrow(
      "置信度与摘要输入无效",
    );
  });
});
