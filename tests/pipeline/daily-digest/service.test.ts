import { describe, expect, it, vi } from "vitest";

import type { DailyDigest } from "../../../lib/domain";
import {
  DailyDigestService,
  shanghaiBusinessDate,
  type DailyDigestStore,
  type DigestContentSource,
} from "../../../lib/pipeline/daily-digest";

const fixedNow = () => new Date("2026-08-02T16:30:00.000Z");

const content = (
  funding: Awaited<ReturnType<DigestContentSource["listFundingItems"]>> = [],
  developments: Awaited<
    ReturnType<DigestContentSource["listDevelopmentItems"]>
  > = [],
): DigestContentSource => ({
  listFundingItems: vi.fn().mockResolvedValue(funding),
  listDevelopmentItems: vi.fn().mockResolvedValue(developments),
});

class InMemoryDigestStore implements DailyDigestStore {
  readonly digests = new Map<string, DailyDigest>();

  async persist(digest: DailyDigest) {
    if (this.digests.has(digest.digestId)) return { action: "existing" as const };
    this.digests.set(digest.digestId, digest);
    return { action: "created" as const };
  }
}

describe("DailyDigestService", () => {
  it("uses the Asia/Shanghai calendar date at the UTC boundary", () => {
    expect(shanghaiBusinessDate(new Date("2026-08-02T15:59:59.999Z"))).toBe(
      "2026-08-02",
    );
    expect(shanghaiBusinessDate(new Date("2026-08-02T16:00:00.000Z"))).toBe(
      "2026-08-03",
    );
  });

  it("creates three sections ordered by importance and stable ID", async () => {
    const source = content(
      [
        {
          eventId: "event-low",
          announcedAt: "2026-08-03",
          importanceScore: 2,
          publicationStatus: "DRAFT",
        },
        {
          eventId: "event-z-high",
          announcedAt: "2026-08-03",
          importanceScore: 5,
          publicationStatus: "READY",
        },
        {
          eventId: "event-a-high",
          announcedAt: "2026-08-03",
          importanceScore: 5,
          publicationStatus: "PUBLISHED",
        },
        {
          eventId: "event-withdrawn",
          announcedAt: "2026-08-03",
          importanceScore: 5,
          publicationStatus: "WITHDRAWN",
        },
      ],
      [
        {
          developmentId: "development-product",
          category: "PRODUCT",
          announcedAt: "2026-08-03",
          importanceScore: 3,
          publicationStatus: "DRAFT",
        },
        {
          developmentId: "development-technology",
          category: "TECHNOLOGY",
          announcedAt: "2026-08-03",
          importanceScore: 5,
          publicationStatus: "READY",
        },
        {
          developmentId: "development-commercial",
          category: "COMMERCIALIZATION",
          announcedAt: "2026-08-03",
          importanceScore: 4,
          publicationStatus: "DRAFT",
        },
        {
          developmentId: "development-yesterday",
          category: "TECHNOLOGY",
          announcedAt: "2026-08-02",
          importanceScore: 5,
          publicationStatus: "DRAFT",
        },
      ],
    );
    const store = new InMemoryDigestStore();
    const service = new DailyDigestService(source, store, { now: fixedNow });

    const result = await service.generate();

    expect(result.status).toBe("CREATED");
    expect(result.digest).toMatchObject({
      digestId: "digest-2026-08-03",
      digestDate: "2026-08-03",
      fundingEventIds: ["event-a-high", "event-z-high", "event-low"],
      technologyProductDevelopmentIds: [
        "development-technology",
        "development-product",
      ],
      commercializationDevelopmentIds: ["development-commercial"],
      reviewStatus: "PENDING",
      publicationStatus: "DRAFT",
      autoPublished: false,
    });
    expect(result.digest.sectionOrder).toEqual([
      { section: "FUNDING", itemId: "event-a-high", rank: 1 },
      { section: "FUNDING", itemId: "event-z-high", rank: 2 },
      { section: "FUNDING", itemId: "event-low", rank: 3 },
      {
        section: "TECHNOLOGY_PRODUCT",
        itemId: "development-technology",
        rank: 1,
      },
      {
        section: "TECHNOLOGY_PRODUCT",
        itemId: "development-product",
        rank: 2,
      },
      {
        section: "COMMERCIALIZATION",
        itemId: "development-commercial",
        rank: 1,
      },
    ]);
  });

  it("creates a valid empty digest", async () => {
    const store = new InMemoryDigestStore();
    const service = new DailyDigestService(content(), store, { now: fixedNow });

    const result = await service.generate();

    expect(result.status).toBe("CREATED");
    expect(result.digest).toMatchObject({
      fundingEventIds: [],
      technologyProductDevelopmentIds: [],
      commercializationDevelopmentIds: [],
      sectionOrder: [],
    });
    expect(store.digests).toHaveLength(1);
  });

  it("keeps exactly one digest when the same business date reruns", async () => {
    const store = new InMemoryDigestStore();
    const service = new DailyDigestService(content(), store, { now: fixedNow });

    const first = await service.generate();
    const repeated = await service.generate();

    expect(first.status).toBe("CREATED");
    expect(repeated.status).toBe("EXISTING");
    expect(repeated.digest.digestId).toBe(first.digest.digestId);
    expect(store.digests).toHaveLength(1);
  });

  it("rejects malformed formal content before writing a digest", async () => {
    const persist = vi.fn();
    const service = new DailyDigestService(
      content([
        {
          eventId: "event-invalid",
          announcedAt: "not-a-date",
          importanceScore: 9,
          publicationStatus: "DRAFT",
        },
      ]),
      { persist },
      { now: fixedNow },
    );

    await expect(service.generate()).rejects.toMatchObject({
      name: "DailyDigestError",
      code: "DAILY_DIGEST_CONTENT_INVALID",
    });
    expect(persist).not.toHaveBeenCalled();
  });
});

