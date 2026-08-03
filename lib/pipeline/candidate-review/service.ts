import { createHash } from "node:crypto";

import { z } from "zod";

import type { FundingEvent } from "../../domain";
import {
  fundingEventSchema,
  researchCandidateSchema,
  stableIdSchema,
} from "../../domain";
import { CandidateReviewError } from "./errors";
import type {
  ApprovedFundingEventInput,
  CandidateReviewInput,
  CandidateReviewResult,
  FundingEventStore,
} from "./types";

const approvedFundingEventInputSchema = z
  .object({
    companyId: stableIdSchema,
    sourceIds: z.array(stableIdSchema).min(1).max(50),
    publicSummary: z.string().trim().min(1).max(2000),
    publicWhyItMatters: z.string().trim().min(1).max(1000),
    importanceScore: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    importanceReason: z.string().trim().min(1).max(1000),
  })
  .strict();

const eventIdForCandidate = (candidateId: string): string =>
  `event-${createHash("sha256").update(candidateId).digest("hex").slice(0, 24)}`;

export class CandidateReviewService {
  constructor(private readonly eventStore: FundingEventStore) {}

  async convert(input: CandidateReviewInput): Promise<CandidateReviewResult> {
    const candidate = researchCandidateSchema.safeParse(input.candidate);
    if (!candidate.success) {
      throw new CandidateReviewError(
        "CANDIDATE_REVIEW_INPUT_INVALID",
        "候选记录不符合审核转换契约",
      );
    }

    if (candidate.data.reviewStatus !== "APPROVED") {
      return {
        status: "SKIPPED",
        reviewStatus: candidate.data.reviewStatus,
        event: null,
      };
    }

    const approvedEvent = approvedFundingEventInputSchema.safeParse(
      input.approvedEvent,
    );
    if (!approvedEvent.success) {
      throw new CandidateReviewError(
        "CANDIDATE_REVIEW_APPROVAL_INCOMPLETE",
        "审核通过候选缺少正式事件所需的审核字段",
      );
    }
    const facts = candidate.data.extractedFacts;
    if (!facts) {
      throw new CandidateReviewError(
        "CANDIDATE_REVIEW_APPROVAL_INCOMPLETE",
        "审核通过候选缺少融资事实",
      );
    }
    const announcedAt = facts.announcedAt;
    if (!announcedAt) {
      throw new CandidateReviewError(
        "CANDIDATE_REVIEW_APPROVAL_INCOMPLETE",
        "审核通过候选缺少融资日期",
      );
    }
    const region = facts.region;
    if (!region) {
      throw new CandidateReviewError(
        "CANDIDATE_REVIEW_APPROVAL_INCOMPLETE",
        "审核通过候选缺少地区",
      );
    }
    const confidence = candidate.data.confidence;
    if (!confidence) {
      throw new CandidateReviewError(
        "CANDIDATE_REVIEW_APPROVAL_INCOMPLETE",
        "审核通过候选缺少置信度",
      );
    }

    const approval: ApprovedFundingEventInput = approvedEvent.data;
    const eventData = {
      eventId: eventIdForCandidate(candidate.data.candidateId),
      companyId: approval.companyId,
      round: facts.round,
      amount: facts.amount,
      currency: facts.currency,
      amountDisclosed: facts.amountDisclosed,
      investors: facts.investors,
      announcedAt,
      region,
      technologyTags: facts.technologyTags,
      publicSummary: approval.publicSummary,
      publicWhyItMatters: approval.publicWhyItMatters,
      sourceIds: [...new Set(approval.sourceIds)],
      confidence,
      importanceScore: approval.importanceScore,
      importanceReason: approval.importanceReason,
      publicationStatus: "DRAFT",
      isPublic: false,
    } satisfies FundingEvent;
    const event = fundingEventSchema.safeParse(eventData);
    if (!event.success) {
      throw new CandidateReviewError(
        "CANDIDATE_REVIEW_APPROVAL_INCOMPLETE",
        "正式融资事件字段不完整或不合法",
      );
    }

    const persisted = await this.eventStore.persist(eventData);
    return {
      status: persisted.action === "created" ? "CREATED" : "EXISTING",
      reviewStatus: "APPROVED",
      event: eventData,
    };
  }
}
