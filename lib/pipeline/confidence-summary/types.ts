import type {
  FactConflict,
  FundingFacts,
  ResearchCandidate,
  SourceEvidence,
} from "../../domain";

export interface ConfidenceSummaryInput {
  candidate: ResearchCandidate;
  facts: FundingFacts;
  evidence: readonly SourceEvidence[];
  conflicts: readonly FactConflict[];
  accessibleSourceUrls: readonly string[];
}

export interface TraceableSummaryClaim {
  text: string;
  factFields: readonly (keyof FundingFacts)[];
  sourceUrls: readonly string[];
}

export interface ConfidenceSummaryResult {
  candidate: ResearchCandidate;
  publicSummary: string;
  claims: readonly TraceableSummaryClaim[];
  metrics: {
    sourceCount: number;
    authoritativeSourceCount: number;
    factCoverage: number;
    accessibleSourceRatio: number;
    conflictCount: number;
  };
}
