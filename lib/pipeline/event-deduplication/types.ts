import type {
  CandidateId,
  CompanyId,
  FactConflict,
  FundingFacts,
  ResearchCandidate,
  SourceEvidence,
} from "../../domain";

export interface ProcessedFundingCandidate {
  candidateId: CandidateId;
  canonicalUrl: string;
  companyId: CompanyId;
  facts: FundingFacts;
  evidence: readonly SourceEvidence[];
  conflicts: readonly FactConflict[];
}

export interface ProcessedCandidateDirectory {
  listProcessedCandidates(): Promise<readonly ProcessedFundingCandidate[]>;
}

export interface EventDeduplicationInput {
  candidate: ResearchCandidate;
  companyId: CompanyId;
  facts: FundingFacts;
  evidence: readonly SourceEvidence[];
  conflicts: readonly FactConflict[];
}

export interface EventDeduplicationResult {
  status:
    | "NEW"
    | "EXISTING"
    | "URL_DUPLICATE"
    | "EVENT_DUPLICATE"
    | "CONFLICT";
  candidate: ResearchCandidate;
  duplicateOf: CandidateId | null;
  evidence: readonly SourceEvidence[];
  conflicts: readonly FactConflict[];
}
