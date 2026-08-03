import type {
  CompanyId,
  FundingEvent,
  ImportanceScore,
  InformationSourceId,
  ResearchCandidate,
  ReviewStatus,
} from "../../domain";

export interface ApprovedFundingEventInput {
  companyId: CompanyId;
  sourceIds: readonly InformationSourceId[];
  publicSummary: string;
  publicWhyItMatters: string;
  importanceScore: ImportanceScore;
  importanceReason: string;
}

export interface CandidateReviewInput {
  candidate: ResearchCandidate;
  approvedEvent?: ApprovedFundingEventInput;
}

export interface FundingEventStoreResult {
  action: "created" | "existing";
}

export interface FundingEventStore {
  persist(event: FundingEvent): Promise<FundingEventStoreResult>;
}

export type CandidateReviewResult =
  | {
      status: "SKIPPED";
      reviewStatus: Exclude<ReviewStatus, "APPROVED">;
      event: null;
    }
  | {
      status: "CREATED" | "EXISTING";
      reviewStatus: "APPROVED";
      event: FundingEvent;
    };

