import type {
  CompanyId,
  Confidence,
  Currency,
  DecimalString,
  EventId,
  InformationSourceId,
  ImportanceScore,
  IsoDate,
  PublicationStatus,
} from "./common";

export interface FundingEvent {
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
  sourceIds: readonly InformationSourceId[];
  confidence: Confidence;
  importanceScore: ImportanceScore;
  importanceReason: string;
  publicationStatus: PublicationStatus;
  isPublic: boolean;
}
