import type {
  PublicCompany,
  PublicCompanyDevelopment,
  PublicDailyDigest,
  PublicFundingEvent,
  PublicSourceEvidence,
  ResearchCandidate,
} from "../../lib/domain";

type Assert<T extends true> = T;
type HasNone<T, Keys extends PropertyKey> = Extract<keyof T, Keys> extends never
  ? true
  : false;

type InternalOnlyKey =
  | "assessmentId"
  | "attentionLevel"
  | "strategicAssessment"
  | "followUpStatus"
  | "owner"
  | "internalNotes"
  | "reviewStatus"
  | "candidateId"
  | "rawExcerpt"
  | "duplicateOf"
  | "conflicts"
  | "isPublic";

export type FundingEventIsPublicOnly = Assert<
  HasNone<PublicFundingEvent, InternalOnlyKey>
>;
export type CompanyDevelopmentIsPublicOnly = Assert<
  HasNone<PublicCompanyDevelopment, InternalOnlyKey>
>;
export type CompanyIsPublicOnly = Assert<HasNone<PublicCompany, InternalOnlyKey>>;
export type DigestIsPublicOnly = Assert<
  HasNone<PublicDailyDigest, InternalOnlyKey>
>;
export type EvidenceOmitsInternalFactMap = Assert<
  HasNone<PublicSourceEvidence, "supportsFacts" | "accessedAt">
>;
export type CandidateRemainsInternal = Assert<
  "reviewStatus" extends keyof ResearchCandidate ? true : false
>;
