import type {
  FactConflict,
  FundingFacts,
  ResearchCandidate,
  SourceEvidence,
} from "../../domain";
import type { FetchedContent } from "../../providers/content-fetch";

export interface FundingResearchProvider {
  research(query: string): Promise<unknown>;
}

export interface FundingExtractionInput {
  candidate: ResearchCandidate;
  content: FetchedContent;
}

export interface FundingExtractionResult {
  candidate: ResearchCandidate;
  facts: FundingFacts;
  evidence: readonly SourceEvidence[];
  conflicts: readonly FactConflict[];
  model: string;
}
