export type IsoDate = string;
export type IsoDateTime = string;
export type DecimalString = string;
export type HttpUrl = string;

export type CandidateId = string;
export type EventId = string;
export type DevelopmentId = string;
export type InformationSourceId = string;
export type CompanyId = string;
export type DigestId = string;
export type WatchId = string;
export type AssessmentId = string;
export type AutomationRunId = string;

export const sourceTypes = [
  "COMPANY",
  "INVESTOR",
  "REGULATOR",
  "GOVERNMENT",
  "FA",
  "MEDIA",
  "SOCIAL",
  "SEARCH_SNIPPET",
] as const;
export type SourceType = (typeof sourceTypes)[number];

export const sourceTiers = ["PRIMARY", "AUTHORITATIVE", "SECONDARY", "LEAD"] as const;
export type SourceTier = (typeof sourceTiers)[number];

export const regionScopes = ["CHINA", "OVERSEAS"] as const;
export type RegionScope = (typeof regionScopes)[number];

export const discoveryTools = ["WORKBUDDY", "OPENAI", "MANUAL"] as const;
export type DiscoveryTool = (typeof discoveryTools)[number];

export const reviewStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "NEEDS_RESEARCH",
  "DUPLICATE",
] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const publicationStatuses = [
  "DRAFT",
  "READY",
  "PUBLISHED",
  "CORRECTED",
  "WITHDRAWN",
] as const;
export type PublicationStatus = (typeof publicationStatuses)[number];

export const confidenceLevels = ["LOW", "MEDIUM", "HIGH"] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

export const currencies = ["CNY", "USD", "EUR", "GBP", "JPY", "KRW", "OTHER"] as const;
export type Currency = (typeof currencies)[number];

export interface Confidence {
  level: ConfidenceLevel;
  score: number;
  reasons: readonly string[];
}

export type ImportanceScore = 1 | 2 | 3 | 4 | 5;

export interface SourceEvidence {
  sourceUrl: HttpUrl;
  sourceName: string;
  sourceType: SourceType;
  sourceTier: SourceTier;
  title: string;
  publishedAt: IsoDateTime | null;
  accessedAt: IsoDateTime;
  supportsFacts: readonly string[];
}

export interface FundingFacts {
  companyName: string | null;
  round: string | null;
  amount: DecimalString | null;
  currency: Currency | null;
  amountDisclosed: boolean;
  investors: readonly string[];
  announcedAt: IsoDate | null;
  region: string | null;
  technologyTags: readonly string[];
}

export interface FactConflict {
  field: keyof FundingFacts;
  values: readonly {
    value: string;
    sourceUrl: HttpUrl;
  }[];
}
