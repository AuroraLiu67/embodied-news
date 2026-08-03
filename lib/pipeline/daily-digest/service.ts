import { z } from "zod";

import type { DailyDigest, DigestItemOrder, DigestSection } from "../../domain";
import {
  companyDevelopmentCategories,
  dailyDigestSchema,
  importanceScoreSchema,
  isoDateSchema,
  publicationStatuses,
  stableIdSchema,
} from "../../domain";
import { DailyDigestError } from "./errors";
import type {
  DailyDigestGenerationResult,
  DailyDigestStore,
  DigestContentSource,
  DigestDevelopmentItem,
  DigestFundingItem,
} from "./types";

const fundingItemSchema = z
  .object({
    eventId: stableIdSchema,
    announcedAt: isoDateSchema,
    importanceScore: importanceScoreSchema,
    publicationStatus: z.enum(publicationStatuses),
  })
  .strict();

const developmentItemSchema = z
  .object({
    developmentId: stableIdSchema,
    category: z.enum(companyDevelopmentCategories),
    announcedAt: isoDateSchema,
    importanceScore: importanceScoreSchema,
    publicationStatus: z.enum(publicationStatuses),
  })
  .strict();

const shanghaiBusinessDate = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const sortByImportance = <Item extends { importanceScore: number }>(
  items: readonly Item[],
  id: (item: Item) => string,
): Item[] =>
  [...items].sort(
    (left, right) =>
      right.importanceScore - left.importanceScore ||
      id(left).localeCompare(id(right)),
  );

const orderFor = (
  section: DigestSection,
  itemIds: readonly string[],
): DigestItemOrder[] =>
  itemIds.map((itemId, index) => ({ section, itemId, rank: index + 1 }));

export interface DailyDigestServiceOptions {
  now?: () => Date;
}

export class DailyDigestService {
  private readonly now: () => Date;

  constructor(
    private readonly content: DigestContentSource,
    private readonly store: DailyDigestStore,
    options: DailyDigestServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async generate(): Promise<DailyDigestGenerationResult> {
    const digestDate = shanghaiBusinessDate(this.now());
    const [fundingInput, developmentInput] = await Promise.all([
      this.content.listFundingItems(),
      this.content.listDevelopmentItems(),
    ]);
    const funding = fundingInput.map((item) => fundingItemSchema.safeParse(item));
    const developments = developmentInput.map((item) =>
      developmentItemSchema.safeParse(item),
    );
    if (
      funding.some((result) => !result.success) ||
      developments.some((result) => !result.success)
    ) {
      throw new DailyDigestError(
        "DAILY_DIGEST_CONTENT_INVALID",
        "正式事件或公司动态不符合日报输入契约",
      );
    }

    const activeFunding = sortByImportance(
      funding
        .map((result) => result.data as DigestFundingItem)
        .filter(
          (item) =>
            item.announcedAt === digestDate &&
            item.publicationStatus !== "WITHDRAWN",
        ),
      (item) => item.eventId,
    );
    const activeDevelopments = developments
      .map((result) => result.data as DigestDevelopmentItem)
      .filter(
        (item) =>
          item.announcedAt === digestDate &&
          item.publicationStatus !== "WITHDRAWN",
      );
    const technologyProduct = sortByImportance(
      activeDevelopments.filter(
        (item) => item.category === "TECHNOLOGY" || item.category === "PRODUCT",
      ),
      (item) => item.developmentId,
    );
    const commercialization = sortByImportance(
      activeDevelopments.filter((item) => item.category === "COMMERCIALIZATION"),
      (item) => item.developmentId,
    );
    const fundingEventIds = activeFunding.map((item) => item.eventId);
    const technologyProductDevelopmentIds = technologyProduct.map(
      (item) => item.developmentId,
    );
    const commercializationDevelopmentIds = commercialization.map(
      (item) => item.developmentId,
    );
    const digestData = {
      digestId: `digest-${digestDate}`,
      digestDate,
      title: `具身智能公司动态日报｜${digestDate}`,
      fundingEventIds,
      technologyProductDevelopmentIds,
      commercializationDevelopmentIds,
      sectionOrder: [
        ...orderFor("FUNDING", fundingEventIds),
        ...orderFor("TECHNOLOGY_PRODUCT", technologyProductDevelopmentIds),
        ...orderFor("COMMERCIALIZATION", commercializationDevelopmentIds),
      ],
      marketObservation: "",
      reviewStatus: "PENDING",
      publicationStatus: "DRAFT",
      publishedAt: null,
      autoPublished: false,
      correctionNote: null,
    } satisfies DailyDigest;
    const digest = dailyDigestSchema.safeParse(digestData);
    if (!digest.success) {
      throw new DailyDigestError(
        "DAILY_DIGEST_CONTENT_INVALID",
        "生成的日报草稿不符合领域契约",
      );
    }

    const persisted = await this.store.persist(digestData);
    return {
      status: persisted.action === "created" ? "CREATED" : "EXISTING",
      digest: digestData,
    };
  }
}

export { shanghaiBusinessDate };

