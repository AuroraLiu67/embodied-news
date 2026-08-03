import type { OpenAIResearchProvider } from "../../providers/openai";
import type {
  FeishuRepositoryRecord,
  FeishuRepositoryWriteResult,
} from "../../feishu";

export interface OverseasDiscoveryQuery {
  queryId: string;
  query: string;
}

export interface OverseasDiscoveryQueryFile {
  schemaVersion: "1";
  queries: readonly OverseasDiscoveryQuery[];
}

export interface OpenAIDiscoveredCandidate
  extends Readonly<Record<string, unknown>> {
  candidateId: string;
  title: string;
  sourceUrl: string;
  canonicalUrl: string;
  sourceType:
    | "COMPANY"
    | "INVESTOR"
    | "REGULATOR"
    | "GOVERNMENT"
    | "FA"
    | "MEDIA"
    | "SOCIAL";
  sourceTier: "PRIMARY" | "AUTHORITATIVE" | "SECONDARY";
  contentType: "FUNDING";
  regionScope: "OVERSEAS";
  discoveredBy: "OPENAI";
  publishedAt: string;
  discoveredAt: string;
  rawExcerpt: string;
  extractedFacts: string;
  relevanceDecision: "RELEVANT" | "UNCERTAIN";
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  confidenceScore: number;
  conflictSummary: string;
  reviewStatus: "PENDING";
}

export interface OverseasCandidateRepository {
  list(): Promise<FeishuRepositoryRecord<OpenAIDiscoveredCandidate>[]>;
  createOrUpdate(
    data: OpenAIDiscoveredCandidate,
  ): Promise<FeishuRepositoryWriteResult<OpenAIDiscoveredCandidate>>;
}

export interface OverseasDiscoveryOptions {
  provider: OpenAIResearchProvider;
  repository: OverseasCandidateRepository;
  model: string;
  now?: () => Date;
  timeZone?: string;
}

export interface OverseasDiscoveryResult {
  totalQueries: number;
  created: number;
  duplicates: number;
  rejected: number;
  failed: number;
}
