import { describe, expect, it, vi } from "vitest";

import type { FeishuRepositoryWriteResult } from "../../../lib/feishu";
import {
  FeishuDailyDigestStore,
  type DailyDigestRow,
} from "../../../lib/pipeline/daily-digest";
import { digestFixture } from "../../fixtures/domain";

const result = (
  action: "created" | "updated" | "unchanged",
  data: DailyDigestRow,
): FeishuRepositoryWriteResult<DailyDigestRow> => ({
  action,
  record: {
    recordId: "rec-digest",
    version: 1,
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    data,
  },
});

describe("FeishuDailyDigestStore", () => {
  it("resolves section business IDs to Feishu relation records", async () => {
    const createOrUpdate = vi.fn(async (row: DailyDigestRow) =>
      result("created", row),
    );
    const fundingEvents = {
      getByBusinessId: vi.fn().mockResolvedValue({ recordId: "rec-funding" }),
    };
    const developments = {
      getByBusinessId: vi
        .fn()
        .mockResolvedValueOnce({ recordId: "rec-technology" })
        .mockResolvedValueOnce({ recordId: "rec-product" })
        .mockResolvedValueOnce({ recordId: "rec-commercial" }),
    };
    const store = new FeishuDailyDigestStore(
      { createOrUpdate },
      fundingEvents,
      developments,
    );

    await expect(store.persist(digestFixture)).resolves.toEqual({
      action: "created",
    });
    expect(createOrUpdate).toHaveBeenCalledWith({
      digestId: digestFixture.digestId,
      digestDate: digestFixture.digestDate,
      title: digestFixture.title,
      fundingEvents: ["rec-funding"],
      technologyProductDevelopments: ["rec-technology", "rec-product"],
      commercializationDevelopments: ["rec-commercial"],
      sectionOrder: JSON.stringify(digestFixture.sectionOrder),
      reviewStatus: "PENDING",
      publicationStatus: "DRAFT",
      publishedAt: null,
      autoPublished: false,
      correctionNote: null,
    });
  });

  it("supports empty relation sections and maps unchanged to existing", async () => {
    const createOrUpdate = vi.fn(async (row: DailyDigestRow) =>
      result("unchanged", row),
    );
    const relation = { getByBusinessId: vi.fn() };
    const store = new FeishuDailyDigestStore(
      { createOrUpdate },
      relation,
      relation,
    );

    await expect(
      store.persist({
        ...digestFixture,
        fundingEventIds: [],
        technologyProductDevelopmentIds: [],
        commercializationDevelopmentIds: [],
        sectionOrder: [],
      }),
    ).resolves.toEqual({ action: "existing" });
    expect(relation.getByBusinessId).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing digest with regenerated content", async () => {
    const createOrUpdate = vi.fn(async (row: DailyDigestRow) =>
      result("updated", row),
    );
    const relation = {
      getByBusinessId: vi.fn().mockResolvedValue({ recordId: "rec-related" }),
    };
    const store = new FeishuDailyDigestStore(
      { createOrUpdate },
      relation,
      relation,
    );

    await expect(store.persist(digestFixture)).rejects.toMatchObject({
      name: "DailyDigestError",
      code: "DAILY_DIGEST_CHANGED",
    });
  });
});

