import type {
  CompanyDevelopmentCategory,
  DailyDigest,
  PublicationStatus,
} from "../../domain";

export interface DigestFundingItem {
  eventId: string;
  announcedAt: string;
  importanceScore: number;
  publicationStatus: PublicationStatus;
}

export interface DigestDevelopmentItem {
  developmentId: string;
  category: CompanyDevelopmentCategory;
  announcedAt: string;
  importanceScore: number;
  publicationStatus: PublicationStatus;
}

export interface DigestContentSource {
  listFundingItems(): Promise<readonly DigestFundingItem[]>;
  listDevelopmentItems(): Promise<readonly DigestDevelopmentItem[]>;
}

export interface DailyDigestStoreResult {
  action: "created" | "existing";
}

export interface DailyDigestStore {
  persist(digest: DailyDigest): Promise<DailyDigestStoreResult>;
}

export interface DailyDigestGenerationResult {
  status: "CREATED" | "EXISTING";
  digest: DailyDigest;
}

