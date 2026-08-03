import type {
  Confidence,
  FundingFacts,
  SourceEvidence,
  SourceTier,
} from "../../domain";
import {
  conflictSchema,
  fundingFactsSchema,
  researchCandidateSchema,
  safePublicHttpUrlSchema,
  sourceEvidenceSchema,
} from "../../domain";
import { ConfidenceSummaryError } from "./errors";
import type {
  ConfidenceSummaryInput,
  ConfidenceSummaryResult,
  TraceableSummaryClaim,
} from "./types";

const sourceWeights: Record<SourceTier, number> = {
  PRIMARY: 0.9,
  AUTHORITATIVE: 0.8,
  SECONDARY: 0.6,
  LEAD: 0.3,
};

const factFields: readonly (keyof FundingFacts)[] = [
  "companyName",
  "round",
  "amount",
  "currency",
  "amountDisclosed",
  "investors",
  "announcedAt",
  "region",
  "technologyTags",
];

const isPopulated = (facts: FundingFacts, field: keyof FundingFacts) => {
  const value = facts[field];
  if (Array.isArray(value)) return value.length > 0;
  if (field === "amountDisclosed") return true;
  return value !== null;
};

const uniqueEvidence = (sources: readonly SourceEvidence[]) => {
  const byUrl = new Map<string, SourceEvidence>();
  for (const source of sources) {
    const existing = byUrl.get(source.sourceUrl);
    if (!existing) {
      byUrl.set(source.sourceUrl, source);
      continue;
    }
    const stronger = sourceWeights[source.sourceTier] > sourceWeights[existing.sourceTier]
      ? source
      : existing;
    byUrl.set(source.sourceUrl, {
      ...stronger,
      supportsFacts: [...new Set([...existing.supportsFacts, ...source.supportsFacts])],
      accessedAt: existing.accessedAt > source.accessedAt
        ? existing.accessedAt
        : source.accessedAt,
    });
  }
  return [...byUrl.values()];
};

const roundMetric = (value: number) => Math.round(value * 1000) / 1000;

const sourcesFor = (
  evidence: readonly SourceEvidence[],
  fields: readonly (keyof FundingFacts)[],
) => [...new Set(
  evidence
    .filter((source) => fields.some((field) => source.supportsFacts.includes(field)))
    .map((source) => source.sourceUrl),
)].sort();

export class ConfidenceSummaryService {
  evaluate(input: ConfidenceSummaryInput): ConfidenceSummaryResult {
    const candidate = researchCandidateSchema.safeParse(input.candidate);
    const facts = fundingFactsSchema.safeParse(input.facts);
    const evidenceResults = input.evidence.map((source) => sourceEvidenceSchema.safeParse(source));
    const conflictResults = input.conflicts.map((conflict) => conflictSchema.safeParse(conflict));
    const accessibleResults = input.accessibleSourceUrls.map((url) => safePublicHttpUrlSchema.safeParse(url));
    if (
      !candidate.success ||
      !facts.success ||
      evidenceResults.some((result) => !result.success) ||
      conflictResults.some((result) => !result.success) ||
      accessibleResults.some((result) => !result.success)
    ) {
      throw new ConfidenceSummaryError();
    }

    const evidence = uniqueEvidence(input.evidence);
    if (evidence.length === 0) throw new ConfidenceSummaryError();
    const evidenceUrls = new Set(evidence.map((source) => source.sourceUrl));
    if (input.accessibleSourceUrls.some((url) => !evidenceUrls.has(url))) {
      throw new ConfidenceSummaryError();
    }

    const populated = factFields.filter((field) => isPopulated(facts.data, field));
    const supported = populated.filter((field) =>
      evidence.some((source) => source.supportsFacts.includes(field)),
    );
    const factCoverage = populated.length === 0 ? 0 : supported.length / populated.length;
    const accessibleSourceRatio = new Set(input.accessibleSourceUrls).size / evidence.length;
    const highestQuality = Math.max(...evidence.map((source) => sourceWeights[source.sourceTier]));
    const quantityBoost = Math.min(Math.max(evidence.length - 1, 0), 3) * 0.04;
    const conflictPenalty = Math.min(input.conflicts.length * 0.12, 0.36);
    let score =
      highestQuality * 0.55 +
      factCoverage * 0.25 +
      accessibleSourceRatio * 0.2 +
      quantityBoost -
      conflictPenalty;
    if (evidence.every((source) => source.sourceTier === "LEAD")) score = Math.min(score, 0.49);
    if (accessibleSourceRatio === 0 || factCoverage < 0.5) score = Math.min(score, 0.49);
    if (input.conflicts.length > 0) score = Math.min(score, 0.69);
    score = roundMetric(Math.max(0, Math.min(1, score)));

    const confidence: Confidence = {
      level: score >= 0.8 ? "HIGH" : score >= 0.55 ? "MEDIUM" : "LOW",
      score,
      reasons: [
        `${evidence.length} 个去重来源，最高等级 ${evidence.reduce((best, source) => sourceWeights[source.sourceTier] > sourceWeights[best] ? source.sourceTier : best, evidence[0].sourceTier)}`,
        `事实证据覆盖率 ${Math.round(factCoverage * 100)}%`,
        `原文可访问率 ${Math.round(accessibleSourceRatio * 100)}%`,
        ...(input.conflicts.length > 0 ? [`存在 ${input.conflicts.length} 个待复核冲突`] : []),
      ],
    };

    const claims = this.buildClaims(facts.data, evidence, input.conflicts.map((item) => item.field));
    if (claims.length === 0 || claims.some((claim) => claim.sourceUrls.length === 0)) {
      throw new ConfidenceSummaryError();
    }
    const reviewStatus = candidate.data.reviewStatus === "DUPLICATE"
      ? "DUPLICATE"
      : input.conflicts.length > 0 || confidence.level === "LOW"
        ? "NEEDS_RESEARCH"
        : candidate.data.reviewStatus;

    return {
      candidate: researchCandidateSchema.parse({
        ...candidate.data,
        confidence,
        conflicts: input.conflicts,
        reviewStatus,
      }),
      publicSummary: claims.map((claim) => claim.text).join(" "),
      claims,
      metrics: {
        sourceCount: evidence.length,
        authoritativeSourceCount: evidence.filter((source) =>
          source.sourceTier === "PRIMARY" || source.sourceTier === "AUTHORITATIVE",
        ).length,
        factCoverage: roundMetric(factCoverage),
        accessibleSourceRatio: roundMetric(accessibleSourceRatio),
        conflictCount: input.conflicts.length,
      },
    };
  }

  private buildClaims(
    facts: FundingFacts,
    evidence: readonly SourceEvidence[],
    conflicted: readonly (keyof FundingFacts)[],
  ): TraceableSummaryClaim[] {
    const safe = (field: keyof FundingFacts) => !conflicted.includes(field);
    const claims: TraceableSummaryClaim[] = [];
    if (facts.companyName && safe("companyName")) {
      claims.push({
        text: `${facts.companyName}披露了一项融资进展。`,
        factFields: ["companyName"],
        sourceUrls: sourcesFor(evidence, ["companyName"]),
      });
    }
    if (facts.round && safe("round")) {
      claims.push({
        text: `融资轮次为${facts.round}。`,
        factFields: ["round"],
        sourceUrls: sourcesFor(evidence, ["round"]),
      });
    }
    if (facts.amountDisclosed && facts.amount && facts.currency && safe("amount") && safe("currency")) {
      claims.push({
        text: `披露金额为 ${facts.currency} ${facts.amount}。`,
        factFields: ["amount", "currency", "amountDisclosed"],
        sourceUrls: sourcesFor(evidence, ["amount", "currency", "amountDisclosed"]),
      });
    } else if (!facts.amountDisclosed) {
      claims.push({
        text: "融资金额未披露。",
        factFields: ["amountDisclosed"],
        sourceUrls: sourcesFor(evidence, ["amountDisclosed"]),
      });
    }
    if (facts.investors.length > 0 && safe("investors")) {
      claims.push({
        text: `披露投资方包括${facts.investors.join("、")}。`,
        factFields: ["investors"],
        sourceUrls: sourcesFor(evidence, ["investors"]),
      });
    }
    if (facts.announcedAt && safe("announcedAt")) {
      claims.push({
        text: `公告日期为 ${facts.announcedAt}。`,
        factFields: ["announcedAt"],
        sourceUrls: sourcesFor(evidence, ["announcedAt"]),
      });
    }
    if (facts.technologyTags.length > 0 && safe("technologyTags")) {
      claims.push({
        text: `相关技术方向包括${facts.technologyTags.join("、")}。`,
        factFields: ["technologyTags"],
        sourceUrls: sourcesFor(evidence, ["technologyTags"]),
      });
    }
    return claims.filter((claim) => claim.sourceUrls.length > 0);
  }
}
