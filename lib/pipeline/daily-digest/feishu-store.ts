import type { DailyDigest } from "../../domain";
import type { FeishuRepositoryWriteResult } from "../../feishu";
import { DailyDigestError } from "./errors";
import type { DailyDigestStore, DailyDigestStoreResult } from "./types";

interface RelationRepository {
  getByBusinessId(businessId: string): Promise<{ recordId: string }>;
}

interface DailyDigestRow extends Readonly<Record<string, unknown>> {
  digestId: string;
  digestDate: string;
  title: string;
  fundingEvents: readonly string[];
  technologyProductDevelopments: readonly string[];
  commercializationDevelopments: readonly string[];
  sectionOrder: string;
  reviewStatus: string;
  publicationStatus: string;
  publishedAt: string | null;
  autoPublished: boolean;
  correctionNote: string | null;
}

interface DailyDigestRepository {
  createOrUpdate(
    data: DailyDigestRow,
  ): Promise<FeishuRepositoryWriteResult<DailyDigestRow>>;
}

const resolveRecords = async (
  repository: RelationRepository,
  businessIds: readonly string[],
) =>
  Promise.all(
    businessIds.map((businessId) => repository.getByBusinessId(businessId)),
  );

export class FeishuDailyDigestStore implements DailyDigestStore {
  constructor(
    private readonly digests: DailyDigestRepository,
    private readonly fundingEvents: RelationRepository,
    private readonly developments: RelationRepository,
  ) {}

  async persist(digest: DailyDigest): Promise<DailyDigestStoreResult> {
    const [funding, technologyProduct, commercialization] = await Promise.all([
      resolveRecords(this.fundingEvents, digest.fundingEventIds),
      resolveRecords(
        this.developments,
        digest.technologyProductDevelopmentIds,
      ),
      resolveRecords(
        this.developments,
        digest.commercializationDevelopmentIds,
      ),
    ]);
    const row: DailyDigestRow = {
      digestId: digest.digestId,
      digestDate: digest.digestDate,
      title: digest.title,
      fundingEvents: funding.map((record) => record.recordId),
      technologyProductDevelopments: technologyProduct.map(
        (record) => record.recordId,
      ),
      commercializationDevelopments: commercialization.map(
        (record) => record.recordId,
      ),
      sectionOrder: JSON.stringify(digest.sectionOrder),
      reviewStatus: "PENDING",
      publicationStatus: "DRAFT",
      publishedAt: null,
      autoPublished: false,
      correctionNote: null,
    };

    const result = await this.digests.createOrUpdate(row);
    if (result.action === "updated") {
      throw new DailyDigestError(
        "DAILY_DIGEST_CHANGED",
        "日报生成不得静默覆盖已存在的日报草稿",
      );
    }
    return { action: result.action === "created" ? "created" : "existing" };
  }
}

export type { DailyDigestRow };

