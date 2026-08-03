import { z } from "zod";

import { currencies, sourceTiers, sourceTypes } from "../common";
import { relevanceDecisions } from "../research-candidate";
import {
  automationRunSchema,
  companyDevelopmentSchema,
  companySchema,
  conflictSchema,
  confidenceSchema,
  dailyDigestSchema,
  fundingEventSchema,
  fundingFactsSchema,
  informationSourceSchema,
  internalAssessmentSchema,
  researchCandidateSchema,
  watchItemSchema,
} from "./domain";
import {
  boundedText,
  decimalStringSchema,
  isoDateSchema,
  isoDateTimeSchema,
  optionalBoundedText,
  safePublicHttpUrlSchema,
  stableIdSchema,
} from "./primitives";

export const workBuddyCandidateInputSchema = z
  .object({
    title: boundedText(500),
    sourceUrl: safePublicHttpUrlSchema,
    sourceName: boundedText(200),
    contentType: z.enum(["FUNDING", "TECHNOLOGY", "PRODUCT", "COMMERCIALIZATION"]),
    sourceType: z.enum(sourceTypes),
    sourceTier: z.enum(sourceTiers),
    publishedAt: isoDateTimeSchema.nullable(),
    queries: z.array(boundedText(300)).min(1).max(30),
    preliminarySummary: optionalBoundedText(2000),
    discoveredAt: isoDateTimeSchema,
  })
  .strict();

const openAiSourceSchema = z
  .object({
    sourceUrl: safePublicHttpUrlSchema,
    sourceName: boundedText(200),
    sourceType: z.enum(sourceTypes),
    sourceTier: z.enum(sourceTiers),
    title: boundedText(500),
    publishedAt: isoDateTimeSchema.nullable(),
    supportsFacts: z
      .array(
        z.enum([
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
      )
      .min(1)
      .max(9),
  })
  .strict();

export const openAiResearchOutputSchema = z
  .object({
    relevance: z
      .object({
        decision: z.enum(relevanceDecisions),
        confidence: confidenceSchema,
        reason: boundedText(1000),
      })
      .strict(),
    extractedFacts: fundingFactsSchema,
    conflicts: z.array(conflictSchema).max(30),
    sources: z.array(openAiSourceSchema).min(1).max(50),
    publicSummary: boundedText(2000),
    publicWhyItMatters: boundedText(1000),
  })
  .strict();

export const feishuRecordSchema = z.discriminatedUnion("table", [
  z
    .object({
      table: z.literal("研究候选"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: researchCandidateSchema,
    })
    .strict(),
  z
    .object({
      table: z.literal("融资事件"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: fundingEventSchema,
    })
    .strict(),
  z
    .object({
      table: z.literal("公司动态"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: companyDevelopmentSchema,
    })
    .strict(),
  z
    .object({
      table: z.literal("信息来源"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: informationSourceSchema,
    })
    .strict(),
  z
    .object({
      table: z.literal("公司"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: companySchema,
    })
    .strict(),
  z
    .object({
      table: z.literal("日报"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: dailyDigestSchema,
    })
    .strict(),
  z
    .object({
      table: z.literal("观察清单"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: watchItemSchema,
    })
    .strict(),
  z
    .object({
      table: z.literal("内部战投备注"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: internalAssessmentSchema,
    })
    .strict(),
  z
    .object({
      table: z.literal("自动化任务"),
      recordId: stableIdSchema,
      version: z.number().int().nonnegative(),
      updatedAt: isoDateTimeSchema,
      fields: automationRunSchema,
    })
    .strict(),
]);

const publicSourceEvidenceSchema = z
  .object({
    sourceUrl: safePublicHttpUrlSchema,
    sourceName: boundedText(200),
    sourceType: z.enum(sourceTypes),
    sourceTier: z.enum(sourceTiers),
    title: boundedText(500),
    publishedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

const publicFundingEventSchema = z
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
    sourceEvidence: z.array(publicSourceEvidenceSchema).min(1).max(50),
    confidence: confidenceSchema,
    importanceScore: z.number().int().min(1).max(5),
    importanceReason: boundedText(1000),
    publicationStatus: z.enum(["PUBLISHED", "CORRECTED"]),
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
  });

const publicCompanyDevelopmentSchema = z
  .object({
    developmentId: stableIdSchema,
    companyId: stableIdSchema,
    category: z.enum(["TECHNOLOGY", "PRODUCT", "COMMERCIALIZATION"]),
    title: boundedText(500),
    announcedAt: isoDateSchema,
    technologyTags: z.array(boundedText(100)).max(30),
    publicSummary: boundedText(2000),
    publicWhyItMatters: boundedText(1000),
    sourceEvidence: z.array(publicSourceEvidenceSchema).min(1).max(50),
    confidence: confidenceSchema,
    importanceScore: z.number().int().min(1).max(5),
    importanceReason: boundedText(1000),
    publicationStatus: z.enum(["PUBLISHED", "CORRECTED"]),
  })
  .strict();

const publicCompanySchema = z
  .object({
    companyId: stableIdSchema,
    nameZh: boundedText(300).nullable(),
    nameEn: boundedText(300).nullable(),
    aliases: z.array(boundedText(300)).max(50),
    website: safePublicHttpUrlSchema,
    region: boundedText(100),
    technologyTags: z.array(boundedText(100)).max(30),
    publicDescription: boundedText(2000),
    fundingEventIds: z.array(stableIdSchema).max(500),
    developmentIds: z.array(stableIdSchema).max(1000),
  })
  .strict();

const publicDigestEntrySchema = z
  .object({
    itemId: stableIdSchema,
    kind: z.enum(["FUNDING", "TECHNOLOGY", "PRODUCT", "COMMERCIALIZATION"]),
    companyId: stableIdSchema,
    title: boundedText(500),
    publicSummary: boundedText(2000),
    importanceScore: z.number().int().min(1).max(5),
    importanceReason: boundedText(1000),
    sources: z.array(publicSourceEvidenceSchema).min(1).max(50),
  })
  .strict();

const publicDailyDigestSchema = z
  .object({
    digestId: stableIdSchema,
    digestDate: isoDateSchema,
    title: boundedText(500),
    funding: z.array(publicDigestEntrySchema).max(200),
    technologyProduct: z.array(publicDigestEntrySchema).max(200),
    commercialization: z.array(publicDigestEntrySchema).max(200),
    marketObservation: optionalBoundedText(3000),
    publicationStatus: z.enum(["PUBLISHED", "CORRECTED"]),
    publishedAt: isoDateTimeSchema,
    autoPublished: z.boolean(),
    correctionNote: optionalBoundedText(2000).nullable(),
  })
  .strict();

export const publicSiteExportSchema = z
  .object({
    generatedAt: isoDateTimeSchema,
    events: z.array(publicFundingEventSchema).max(10000),
    developments: z.array(publicCompanyDevelopmentSchema).max(10000),
    companies: z.array(publicCompanySchema).max(10000),
    digests: z.array(publicDailyDigestSchema).max(5000),
  })
  .strict();

export const errorResponseSchema = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
    message: boundedText(500),
    retryable: z.boolean(),
    requestId: stableIdSchema.optional(),
  })
  .strict();
