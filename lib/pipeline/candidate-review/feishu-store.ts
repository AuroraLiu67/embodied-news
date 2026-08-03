import type { FundingEvent } from "../../domain";
import type {
  FeishuRepositoryWriteResult,
} from "../../feishu";
import { CandidateReviewError } from "./errors";
import type { FundingEventStore, FundingEventStoreResult } from "./types";

interface RelationRepository {
  getByBusinessId(businessId: string): Promise<{ recordId: string }>;
}

interface FundingEventRow extends Readonly<Record<string, unknown>> {
  eventId: string;
  company: readonly string[];
  round: string | null;
  amount: string | null;
  currency: string | null;
  amountDisclosed: boolean;
  investors: readonly string[];
  announcedAt: string;
  region: string;
  technologyTags: readonly string[];
  publicSummary: string;
  publicWhyItMatters: string;
  sources: readonly string[];
  confidenceLevel: string;
  importanceScore: number;
  importanceReason: string;
  isPublic: boolean;
  publicationStatus: string;
}

interface FundingEventRepository {
  createOrUpdate(
    data: FundingEventRow,
  ): Promise<FeishuRepositoryWriteResult<FundingEventRow>>;
}

export class FeishuFundingEventStore implements FundingEventStore {
  constructor(
    private readonly events: FundingEventRepository,
    private readonly companies: RelationRepository,
    private readonly sources: RelationRepository,
  ) {}

  async persist(event: FundingEvent): Promise<FundingEventStoreResult> {
    const [company, ...sources] = await Promise.all([
      this.companies.getByBusinessId(event.companyId),
      ...event.sourceIds.map((sourceId) =>
        this.sources.getByBusinessId(sourceId),
      ),
    ]);
    const row: FundingEventRow = {
      eventId: event.eventId,
      company: [company.recordId],
      round: event.round,
      amount: event.amount,
      currency: event.currency,
      amountDisclosed: event.amountDisclosed,
      investors: event.investors,
      announcedAt: event.announcedAt,
      region: event.region,
      technologyTags: event.technologyTags,
      publicSummary: event.publicSummary,
      publicWhyItMatters: event.publicWhyItMatters,
      sources: sources.map((source) => source.recordId),
      confidenceLevel: event.confidence.level,
      importanceScore: event.importanceScore,
      importanceReason: event.importanceReason,
      isPublic: false,
      publicationStatus: "DRAFT",
    };

    const result = await this.events.createOrUpdate(row);
    if (result.action === "updated") {
      throw new CandidateReviewError(
        "CANDIDATE_REVIEW_EVENT_CHANGED",
        "审核转换不得覆盖已存在的正式融资事件",
      );
    }
    return { action: result.action === "created" ? "created" : "existing" };
  }
}

export type { FundingEventRow };
