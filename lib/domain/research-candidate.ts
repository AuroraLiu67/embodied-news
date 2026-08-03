import type {
  CandidateId,
  Confidence,
  DiscoveryTool,
  FactConflict,
  FundingFacts,
  HttpUrl,
  IsoDateTime,
  RegionScope,
  ReviewStatus,
  SourceTier,
  SourceType,
} from "./common";

export const relevanceDecisions = ["RELEVANT", "NOT_RELEVANT", "UNCERTAIN"] as const;
export type RelevanceDecision = (typeof relevanceDecisions)[number];

export interface RelevanceAssessment {
  decision: RelevanceDecision;
  confidence: Confidence;
  reason: string;
  model: string;
}

export interface ResearchCandidate {
  candidateId: CandidateId;
  sourceUrl: HttpUrl;
  canonicalUrl: HttpUrl;
  title: string;
  sourceName: string;
  sourceType: SourceType;
  sourceTier: SourceTier;
  regionScope: RegionScope;
  discoveredBy: DiscoveryTool;
  publishedAt: IsoDateTime | null;
  discoveredAt: IsoDateTime;
  rawExcerpt: string;
  relevance: RelevanceAssessment | null;
  extractedFacts: FundingFacts | null;
  confidence: Confidence | null;
  duplicateOf: CandidateId | null;
  conflicts: readonly FactConflict[];
  reviewStatus: ReviewStatus;
}
