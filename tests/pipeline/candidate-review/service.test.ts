import { describe, expect, it, vi } from "vitest";

import type { ResearchCandidate, ReviewStatus } from "../../../lib/domain";
import {
  CandidateReviewError,
  CandidateReviewService,
  type ApprovedFundingEventInput,
  type FundingEventStore,
} from "../../../lib/pipeline/candidate-review";
import {
  candidateFixture,
  companyFixture,
  informationSourceFixture,
} from "../../fixtures/domain";

const approval = {
  companyId: companyFixture.companyId,
  sourceIds: [informationSourceFixture.sourceId],
  publicSummary: "银河通用宣布完成新一轮融资，金额未披露。",
  publicWhyItMatters: "本次融资将支持通用具身智能技术研发。",
  importanceScore: 5,
  importanceReason: "公司官方披露且属于重点具身智能企业融资。",
} satisfies ApprovedFundingEventInput;

const candidateWithStatus = (reviewStatus: ReviewStatus): ResearchCandidate => ({
  ...candidateFixture,
  reviewStatus,
});

class InMemoryEventStore implements FundingEventStore {
  readonly events = new Map<string, Parameters<FundingEventStore["persist"]>[0]>();

  async persist(event: Parameters<FundingEventStore["persist"]>[0]) {
    if (this.events.has(event.eventId)) return { action: "existing" as const };
    this.events.set(event.eventId, event);
    return { action: "created" as const };
  }
}

describe("CandidateReviewService", () => {
  it.each([
    "PENDING",
    "REJECTED",
    "NEEDS_RESEARCH",
    "DUPLICATE",
  ] satisfies ReviewStatus[])("does not convert %s candidates", async (reviewStatus) => {
    const persist = vi.fn();
    const service = new CandidateReviewService({ persist });

    await expect(
      service.convert({ candidate: candidateWithStatus(reviewStatus) }),
    ).resolves.toEqual({ status: "SKIPPED", reviewStatus, event: null });
    expect(persist).not.toHaveBeenCalled();
  });

  it("converts an approved candidate into a non-public draft event", async () => {
    const store = new InMemoryEventStore();
    const service = new CandidateReviewService(store);

    const result = await service.convert({
      candidate: candidateWithStatus("APPROVED"),
      approvedEvent: approval,
    });

    expect(result.status).toBe("CREATED");
    expect(result.event).toMatchObject({
      companyId: companyFixture.companyId,
      round: candidateFixture.extractedFacts?.round,
      amountDisclosed: false,
      announcedAt: "2026-07-30",
      sourceIds: [informationSourceFixture.sourceId],
      confidence: candidateFixture.confidence,
      publicationStatus: "DRAFT",
      isPublic: false,
    });
    expect(result.event?.eventId).toMatch(/^event-[a-f0-9]{24}$/);
    expect(store.events).toHaveLength(1);
  });

  it("returns the same event and does not create a second record on rerun", async () => {
    const store = new InMemoryEventStore();
    const service = new CandidateReviewService(store);
    const input = {
      candidate: candidateWithStatus("APPROVED"),
      approvedEvent: approval,
    } as const;

    const first = await service.convert(input);
    const repeated = await service.convert(input);

    expect(first.status).toBe("CREATED");
    expect(repeated.status).toBe("EXISTING");
    expect(repeated.event?.eventId).toBe(first.event?.eventId);
    expect(store.events).toHaveLength(1);
  });

  it.each([
    {
      label: "approval payload",
      candidate: candidateWithStatus("APPROVED"),
      approvedEvent: undefined,
    },
    {
      label: "funding facts",
      candidate: { ...candidateWithStatus("APPROVED"), extractedFacts: null },
      approvedEvent: approval,
    },
    {
      label: "announcement date",
      candidate: {
        ...candidateWithStatus("APPROVED"),
        extractedFacts: {
          ...candidateFixture.extractedFacts!,
          announcedAt: null,
        },
      },
      approvedEvent: approval,
    },
    {
      label: "confidence",
      candidate: { ...candidateWithStatus("APPROVED"), confidence: null },
      approvedEvent: approval,
    },
    {
      label: "source relation",
      candidate: candidateWithStatus("APPROVED"),
      approvedEvent: { ...approval, sourceIds: [] },
    },
  ])("rejects an approved candidate missing $label", async ({ candidate, approvedEvent }) => {
    const persist = vi.fn();
    const service = new CandidateReviewService({ persist });

    await expect(
      service.convert({ candidate, approvedEvent }),
    ).rejects.toMatchObject({
      name: "CandidateReviewError",
      code: "CANDIDATE_REVIEW_APPROVAL_INCOMPLETE",
    } satisfies Partial<CandidateReviewError>);
    expect(persist).not.toHaveBeenCalled();
  });
});

