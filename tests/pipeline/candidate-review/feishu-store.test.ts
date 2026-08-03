import { describe, expect, it, vi } from "vitest";

import type { FeishuRepositoryWriteResult } from "../../../lib/feishu";
import {
  CandidateReviewError,
  FeishuFundingEventStore,
  type FundingEventRow,
} from "../../../lib/pipeline/candidate-review";
import { fundingEventFixture } from "../../fixtures/domain";

const writeResult = (
  action: "created" | "updated" | "unchanged",
  data: FundingEventRow,
): FeishuRepositoryWriteResult<FundingEventRow> => ({
  action,
  record: {
    recordId: "rec-event",
    version: 1,
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    data,
  },
});

describe("FeishuFundingEventStore", () => {
  it("resolves business IDs to Feishu relation record IDs and writes a draft", async () => {
    const createOrUpdate = vi.fn(async (row: FundingEventRow) =>
      writeResult("created", row),
    );
    const companies = {
      getByBusinessId: vi.fn().mockResolvedValue({ recordId: "rec-company" }),
    };
    const sources = {
      getByBusinessId: vi.fn().mockResolvedValue({ recordId: "rec-source" }),
    };
    const store = new FeishuFundingEventStore(
      { createOrUpdate },
      companies,
      sources,
    );

    await expect(store.persist(fundingEventFixture)).resolves.toEqual({
      action: "created",
    });
    expect(companies.getByBusinessId).toHaveBeenCalledWith(
      fundingEventFixture.companyId,
    );
    expect(sources.getByBusinessId).toHaveBeenCalledWith(
      fundingEventFixture.sourceIds[0],
    );
    expect(createOrUpdate).toHaveBeenCalledWith({
      eventId: fundingEventFixture.eventId,
      company: ["rec-company"],
      round: fundingEventFixture.round,
      amount: fundingEventFixture.amount,
      currency: fundingEventFixture.currency,
      amountDisclosed: fundingEventFixture.amountDisclosed,
      investors: fundingEventFixture.investors,
      announcedAt: fundingEventFixture.announcedAt,
      region: fundingEventFixture.region,
      technologyTags: fundingEventFixture.technologyTags,
      publicSummary: fundingEventFixture.publicSummary,
      publicWhyItMatters: fundingEventFixture.publicWhyItMatters,
      sources: ["rec-source"],
      confidenceLevel: fundingEventFixture.confidence.level,
      importanceScore: fundingEventFixture.importanceScore,
      importanceReason: fundingEventFixture.importanceReason,
      isPublic: false,
      publicationStatus: "DRAFT",
    });
  });

  it("maps an unchanged repository write to an existing event", async () => {
    const createOrUpdate = vi.fn(async (row: FundingEventRow) =>
      writeResult("unchanged", row),
    );
    const relation = {
      getByBusinessId: vi.fn().mockResolvedValue({ recordId: "rec-related" }),
    };
    const store = new FeishuFundingEventStore(
      { createOrUpdate },
      relation,
      relation,
    );

    await expect(store.persist(fundingEventFixture)).resolves.toEqual({
      action: "existing",
    });
  });

  it("refuses any adapter result that would update an existing formal event", async () => {
    const createOrUpdate = vi.fn(async (row: FundingEventRow) =>
      writeResult("updated", row),
    );
    const relation = {
      getByBusinessId: vi.fn().mockResolvedValue({ recordId: "rec-related" }),
    };
    const store = new FeishuFundingEventStore(
      { createOrUpdate },
      relation,
      relation,
    );

    await expect(store.persist(fundingEventFixture)).rejects.toMatchObject({
      name: "CandidateReviewError",
      code: "CANDIDATE_REVIEW_EVENT_CHANGED",
    } satisfies Partial<CandidateReviewError>);
  });
});

