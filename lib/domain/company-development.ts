import type {
  CompanyId,
  Confidence,
  DevelopmentId,
  ImportanceScore,
  InformationSourceId,
  IsoDate,
  PublicationStatus,
} from "./common";

export const companyDevelopmentCategories = [
  "TECHNOLOGY",
  "PRODUCT",
  "COMMERCIALIZATION",
] as const;
export type CompanyDevelopmentCategory =
  (typeof companyDevelopmentCategories)[number];

export interface CompanyDevelopment {
  developmentId: DevelopmentId;
  companyId: CompanyId;
  category: CompanyDevelopmentCategory;
  title: string;
  announcedAt: IsoDate;
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
