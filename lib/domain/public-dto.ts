import type {
  CompanyId,
  Confidence,
  Currency,
  DecimalString,
  DevelopmentId,
  DigestId,
  EventId,
  HttpUrl,
  IsoDate,
  IsoDateTime,
  ImportanceScore,
  SourceTier,
  SourceType,
} from "./common";
import type { CompanyDevelopmentCategory } from "./company-development";

export type PublicPublicationStatus = "PUBLISHED" | "CORRECTED";

export interface PublicSourceEvidence {
  sourceUrl: HttpUrl;
  sourceName: string;
  sourceType: SourceType;
  sourceTier: SourceTier;
  title: string;
  publishedAt: IsoDateTime | null;
}

export interface PublicFundingEvent {
  eventId: EventId;
  companyId: CompanyId;
  round: string | null;
  amount: DecimalString | null;
  currency: Currency | null;
  amountDisclosed: boolean;
  investors: readonly string[];
  announcedAt: IsoDate;
  region: string;
  technologyTags: readonly string[];
  publicSummary: string;
  publicWhyItMatters: string;
  sourceEvidence: readonly PublicSourceEvidence[];
  confidence: Confidence;
  importanceScore: ImportanceScore;
  importanceReason: string;
  publicationStatus: PublicPublicationStatus;
}

export interface PublicCompanyDevelopment {
  developmentId: DevelopmentId;
  companyId: CompanyId;
  category: CompanyDevelopmentCategory;
  title: string;
  announcedAt: IsoDate;
  technologyTags: readonly string[];
  publicSummary: string;
  publicWhyItMatters: string;
  sourceEvidence: readonly PublicSourceEvidence[];
  confidence: Confidence;
  importanceScore: ImportanceScore;
  importanceReason: string;
  publicationStatus: PublicPublicationStatus;
}

export interface PublicCompany {
  companyId: CompanyId;
  nameZh: string | null;
  nameEn: string | null;
  aliases: readonly string[];
  website: HttpUrl;
  region: string;
  technologyTags: readonly string[];
  publicDescription: string;
  fundingEventIds: readonly EventId[];
  developmentIds: readonly DevelopmentId[];
}

export type PublicDigestEntryKind =
  | "FUNDING"
  | "TECHNOLOGY"
  | "PRODUCT"
  | "COMMERCIALIZATION";

export interface PublicDigestEntry {
  itemId: EventId | DevelopmentId;
  kind: PublicDigestEntryKind;
  companyId: CompanyId;
  title: string;
  publicSummary: string;
  importanceScore: ImportanceScore;
  importanceReason: string;
  sources: readonly PublicSourceEvidence[];
}

export interface PublicDailyDigest {
  digestId: DigestId;
  digestDate: IsoDate;
  title: string;
  funding: readonly PublicDigestEntry[];
  technologyProduct: readonly PublicDigestEntry[];
  commercialization: readonly PublicDigestEntry[];
  marketObservation: string;
  publicationStatus: PublicPublicationStatus;
  publishedAt: IsoDateTime;
  autoPublished: boolean;
  correctionNote: string | null;
}
