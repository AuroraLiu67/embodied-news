import { z } from "zod";

import {
  confidenceLevels,
  currencies,
  discoveryTools,
  publicationStatuses,
  regionScopes,
  reviewStatuses,
  sourceTiers,
  sourceTypes,
} from "../common";
import { attentionLevels, followUpStatuses } from "../internal-assessment";
import { automationJobTypes, automationRunStatuses } from "../automation-run";
import { companyDevelopmentCategories } from "../company-development";
import { digestSections } from "../daily-digest";
import { relevanceDecisions } from "../research-candidate";
import { watchItemTypes, watchPriorities } from "../watch-item";
import {
  boundedText,
  decimalStringSchema,
  isoDateSchema,
  isoDateTimeSchema,
  optionalBoundedText,
  safePublicHttpUrlSchema,
  stableIdSchema,
} from "./primitives";

export const confidenceSchema = z
  .object({
    level: z.enum(confidenceLevels),
    score: z.number().min(0).max(1),
    reasons: z.array(boundedText(500)).max(20),
  })
  .strict();

export const fundingFactsSchema = z
  .object({
    companyName: boundedText(300).nullable(),
    round: boundedText(100).nullable(),
    amount: decimalStringSchema.nullable(),
    currency: z.enum(currencies).nullable(),
    amountDisclosed: z.boolean(),
    investors: z.array(boundedText(300)).max(100),
    announcedAt: isoDateSchema.nullable(),
    region: boundedText(100).nullable(),
    technologyTags: z.array(boundedText(100)).max(30),
  })
  .strict()
  .superRefine((facts, context) => {
    if (!facts.amountDisclosed && (facts.amount !== null || facts.currency !== null)) {
      context.addIssue({
        code: "custom",
        message: "金额未披露时 amount 和 currency 必须为 null",
      });
    }
    if (facts.amountDisclosed && (facts.amount === null || facts.currency === null)) {
      context.addIssue({
        code: "custom",
        message: "金额已披露时必须同时提供 amount 和 currency",
      });
    }
  });

export const sourceEvidenceSchema = z
  .object({
    sourceUrl: safePublicHttpUrlSchema,
    sourceName: boundedText(200),
    sourceType: z.enum(sourceTypes),
    sourceTier: z.enum(sourceTiers),
    title: boundedText(500),
    publishedAt: isoDateTimeSchema.nullable(),
    accessedAt: isoDateTimeSchema,
    supportsFacts: z.array(boundedText(200)).min(1).max(50),
  })
  .strict();

export const importanceScoreSchema = z.number().int().min(1).max(5);

export const informationSourceSchema = z
  .object({
    sourceId: stableIdSchema,
    title: boundedText(500),
    url: safePublicHttpUrlSchema,
    publisher: boundedText(200),
    sourceType: z.enum(sourceTypes),
    sourceTier: z.enum(sourceTiers),
    publishedAt: isoDateTimeSchema.nullable(),
    isPrimary: z.boolean(),
    lastVerifiedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export const conflictSchema = z
  .object({
    field: z.enum([
      "companyName",
      "round",
      "amount",
      "currency",
      "amountDisclosed",
      "investors",
      "announcedAt",
      "region",
      "technologyTags",
    ]),
    values: z
      .array(
        z
          .object({
            value: boundedText(500),
            sourceUrl: safePublicHttpUrlSchema,
          })
          .strict(),
      )
      .min(2)
      .max(20),
  })
  .strict();

export const researchCandidateSchema = z
  .object({
    candidateId: stableIdSchema,
    sourceUrl: safePublicHttpUrlSchema,
    canonicalUrl: safePublicHttpUrlSchema,
    title: boundedText(500),
    sourceName: boundedText(200),
    sourceType: z.enum(sourceTypes),
    sourceTier: z.enum(sourceTiers),
    regionScope: z.enum(regionScopes),
    discoveredBy: z.enum(discoveryTools),
    publishedAt: isoDateTimeSchema.nullable(),
    discoveredAt: isoDateTimeSchema,
    rawExcerpt: optionalBoundedText(5000),
    relevance: z
      .object({
        decision: z.enum(relevanceDecisions),
        confidence: confidenceSchema,
        reason: boundedText(1000),
        model: boundedText(100),
      })
      .strict()
      .nullable(),
    extractedFacts: fundingFactsSchema.nullable(),
    confidence: confidenceSchema.nullable(),
    duplicateOf: stableIdSchema.nullable(),
    conflicts: z.array(conflictSchema).max(30),
    reviewStatus: z.enum(reviewStatuses),
  })
  .strict();

export const fundingEventSchema = z
  .object({
    eventId: stableIdSchema,
    companyId: stableIdSchema,
    round: boundedText(100).nullable(),
    amount: decimalStringSchema.nullable(),
    currency: z.enum(currencies).nullable(),
    amountDisclosed: z.boolean(),
    investors: z.array(boundedText(300)).max(100),
    announcedAt: isoDateSchema,
    region: boundedText(100),
    technologyTags: z.array(boundedText(100)).max(30),
    publicSummary: boundedText(2000),
    publicWhyItMatters: boundedText(1000),
    sourceIds: z.array(stableIdSchema).max(50),
    confidence: confidenceSchema,
    importanceScore: importanceScoreSchema,
    importanceReason: boundedText(1000),
    publicationStatus: z.enum(publicationStatuses),
    isPublic: z.boolean(),
  })
  .strict()
  .superRefine((event, context) => {
    if (!event.amountDisclosed && (event.amount !== null || event.currency !== null)) {
      context.addIssue({
        code: "custom",
        message: "金额未披露时 amount 和 currency 必须为 null",
      });
    }
    if (event.amountDisclosed && (event.amount === null || event.currency === null)) {
      context.addIssue({
        code: "custom",
        message: "金额已披露时必须同时提供 amount 和 currency",
      });
    }
    if (
      event.isPublic &&
      ["READY", "PUBLISHED", "CORRECTED"].includes(event.publicationStatus) &&
      event.sourceIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceIds"],
        message: "允许公开的融资事件至少需要一个原始信息来源",
      });
    }
  });

export const companyDevelopmentSchema = z
  .object({
    developmentId: stableIdSchema,
    companyId: stableIdSchema,
    category: z.enum(companyDevelopmentCategories),
    title: boundedText(500),
    announcedAt: isoDateSchema,
    technologyTags: z.array(boundedText(100)).max(30),
    publicSummary: boundedText(2000),
    publicWhyItMatters: boundedText(1000),
    sourceIds: z.array(stableIdSchema).max(50),
    confidence: confidenceSchema,
    importanceScore: importanceScoreSchema,
    importanceReason: boundedText(1000),
    publicationStatus: z.enum(publicationStatuses),
    isPublic: z.boolean(),
  })
  .strict()
  .superRefine((development, context) => {
    if (
      development.isPublic &&
      ["READY", "PUBLISHED", "CORRECTED"].includes(development.publicationStatus) &&
      development.sourceIds.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceIds"],
        message: "允许公开的公司动态至少需要一个原始信息来源",
      });
    }
  });

export const companySchema = z
  .object({
    companyId: stableIdSchema,
    nameZh: boundedText(300).nullable(),
    nameEn: boundedText(300).nullable(),
    aliases: z.array(boundedText(300)).max(50),
    website: safePublicHttpUrlSchema,
    region: boundedText(100),
    technologyTags: z.array(boundedText(100)).max(30),
    publicDescription: boundedText(2000),
  })
  .strict()
  .refine((company) => company.nameZh !== null || company.nameEn !== null, {
    message: "公司至少需要一个中文名或英文名",
  });

const digestItemOrderSchema = z
  .object({
    section: z.enum(digestSections),
    itemId: stableIdSchema,
    rank: z.number().int().positive(),
  })
  .strict();

export const dailyDigestSchema = z
  .object({
    digestId: stableIdSchema,
    digestDate: isoDateSchema,
    title: boundedText(500),
    fundingEventIds: z.array(stableIdSchema).max(200),
    technologyProductDevelopmentIds: z.array(stableIdSchema).max(200),
    commercializationDevelopmentIds: z.array(stableIdSchema).max(200),
    sectionOrder: z.array(digestItemOrderSchema).max(600),
    marketObservation: optionalBoundedText(3000),
    reviewStatus: z.enum(reviewStatuses),
    publicationStatus: z.enum(publicationStatuses),
    publishedAt: isoDateTimeSchema.nullable(),
    autoPublished: z.boolean(),
    correctionNote: optionalBoundedText(2000).nullable(),
  })
  .strict();

export const watchItemSchema = z
  .object({
    watchId: stableIdSchema,
    type: z.enum(watchItemTypes),
    name: boundedText(300),
    queries: z.array(boundedText(300)).min(1).max(30),
    region: boundedText(100),
    technologyTags: z.array(boundedText(100)).max(30),
    priority: z.enum(watchPriorities),
    enabled: z.boolean(),
  })
  .strict();

const assessmentFields = {
  assessmentId: stableIdSchema,
  attentionLevel: z.enum(attentionLevels),
  strategicAssessment: optionalBoundedText(5000),
  followUpStatus: z.enum(followUpStatuses),
  owner: boundedText(200),
  internalNotes: optionalBoundedText(10000),
};

export const internalAssessmentSchema = z.union([
  z.object({ ...assessmentFields, companyId: stableIdSchema, eventId: z.null() }).strict(),
  z.object({ ...assessmentFields, companyId: z.null(), eventId: stableIdSchema }).strict(),
]);

export const automationRunSchema = z
  .object({
    runId: stableIdSchema,
    businessDate: isoDateSchema,
    jobType: z.enum(automationJobTypes),
    status: z.enum(automationRunStatuses),
    attempt: z.number().int().min(0).max(100),
    startedAt: isoDateTimeSchema.nullable(),
    finishedAt: isoDateTimeSchema.nullable(),
    errorCode: optionalBoundedText(100).nullable(),
    errorSummary: optionalBoundedText(1000).nullable(),
    manualActionRequired: z.boolean(),
  })
  .strict();
