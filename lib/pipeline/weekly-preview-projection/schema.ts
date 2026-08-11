import {z} from "zod";

import {safePublicHttpUrlSchema} from "../../domain/schemas/primitives";
import {WeeklyPreviewProjectionError} from "./errors";

export const MAX_WEEKLY_PREVIEW_FILE_BYTES = 5 * 1024 * 1024;

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const nullableText = (maximum: number) => requiredText(maximum).nullable();
const textList = (maximumItems: number, maximumLength = 1_000) =>
  z.array(requiredText(maximumLength)).max(maximumItems);
const sourceDate = requiredText(64).nullable();

const enrichmentEventSchema = z.object({
  eventKey: requiredText(128),
  regionScope: z.enum(["CHINA", "OVERSEAS"]).nullable(),
  relevanceTier: z.enum(["P1", "P2", "P3", "P4"]),
  relevanceRationale: requiredText(1_000),
  companyNameOriginal: requiredText(300),
  companyNameStandard: nullableText(300),
  companyEnglishName: nullableText(300),
  officialWebsite: safePublicHttpUrlSchema.nullable(),
  sourceUrls: z.array(safePublicHttpUrlSchema).min(1).max(100),
  sourcePublishedAt: z.record(safePublicHttpUrlSchema, sourceDate),
  eventDate: nullableText(64),
  financingStatus: requiredText(300),
  round: nullableText(300),
  amount: nullableText(500),
  currency: z.enum(["CNY", "USD", "HKD", "EUR"]).nullable(),
  leadInvestors: textList(100, 300),
  followInvestors: textList(100, 300),
  otherInvestors: textList(100, 300),
  financialAdviser: nullableText(500),
  companyBusiness: nullableText(2_000),
  products: textList(100, 1_000),
  coreTechnology: textList(100, 1_000),
  foundingTeam: textList(100, 1_000),
  useOfFunds: nullableText(2_000),
  valuation: nullableText(500),
  cumulativeFunding: nullableText(500),
  introduction: nullableText(2_000),
  fieldEvidence: z.record(requiredText(100), z.array(safePublicHttpUrlSchema).max(100)),
  missingFields: textList(100, 100),
  conflicts: textList(100, 2_000),
  accessLimitations: textList(100, 2_000),
  researchStatus: requiredText(100),
}).strict();

const excludedEventSchema = z.object({
  eventKey: requiredText(128),
  companyNameOriginal: requiredText(300),
  relevanceTier: z.literal("P4"),
}).strict();

export const weeklyEnrichmentSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  batch: requiredText(128),
  businessDates: z.array(z.iso.date()).min(1).max(31),
  generatedAt: z.iso.datetime({offset: true}),
  inputEventCount: z.number().int().nonnegative().max(5_000),
  sourceEventCount: z.number().int().nonnegative().max(5_000),
  excludedP4Count: z.number().int().nonnegative().max(5_000),
  events: z.array(enrichmentEventSchema).max(5_000),
  excludedP4: z.array(excludedEventSchema).max(5_000),
}).strict();

export const previewSourceSchema = z.object({
  url: safePublicHttpUrlSchema,
  publishedAt: sourceDate,
}).strict();

export const previewIndustryCategorySchema = z.enum([
  "SEMICONDUCTOR_ELECTRONICS",
  "ADVANCED_MANUFACTURING_MATERIALS",
  "AEROSPACE_LOW_ALTITUDE",
  "ENERGY_FUSION",
  "QUANTUM_TECH",
  "BIOTECH_HEALTHCARE",
  "OTHER_HARD_TECH",
]);

export const previewEventSchema = z.object({
  id: requiredText(128),
  companyStandardName: nullableText(300),
  companyDisplayName: requiredText(300),
  companyEnglishName: nullableText(300),
  regionScope: z.enum(["CHINA", "OVERSEAS"]).nullable(),
  relevanceTier: z.enum(["P1", "P2", "P3"]),
  relevanceSubcategory: requiredText(100),
  industryCategory: previewIndustryCategorySchema.nullable(),
  industryLabel: nullableText(100),
  businessLabel: nullableText(300),
  capitalEventLabel: nullableText(100),
  displayPriority: z.number().int().positive().max(5_000),
  priorityReason: requiredText(500),
  officialWebsite: safePublicHttpUrlSchema.nullable(),
  introduction: nullableText(2_000),
  companyBusiness: nullableText(2_000),
  products: textList(100, 1_000),
  coreTechnology: textList(100, 1_000),
  foundingTeam: textList(100, 1_000),
  financingStatus: requiredText(300),
  round: nullableText(300),
  amount: nullableText(500),
  currency: z.enum(["CNY", "USD", "HKD", "EUR"]).nullable(),
  leadInvestors: textList(100, 300),
  followInvestors: textList(100, 300),
  otherInvestors: textList(100, 300),
  financialAdviser: nullableText(500),
  useOfFunds: nullableText(2_000),
  valuation: nullableText(500),
  cumulativeFunding: nullableText(500),
  sources: z.array(previewSourceSchema).min(1).max(100),
}).strict();

export const weeklyPreviewProjectionSchema = z.object({
  schemaVersion: z.literal("1"),
  mode: z.literal("PREVIEW"),
  weekStart: z.iso.date(),
  weekEnd: z.iso.date(),
  counts: z.object({
    original: z.number().int().nonnegative(),
    excludedP4: z.number().int().nonnegative(),
    public: z.number().int().nonnegative(),
    P1: z.number().int().nonnegative(),
    P2: z.number().int().nonnegative(),
    P3: z.number().int().nonnegative(),
  }).strict(),
  events: z.array(previewEventSchema).max(5_000),
}).strict();

export type WeeklyEnrichment = z.infer<typeof weeklyEnrichmentSchema>;
export type EnrichmentEvent = z.infer<typeof enrichmentEventSchema>;
export type WeeklyPreviewProjection = z.infer<typeof weeklyPreviewProjectionSchema>;
export type PreviewEvent = z.infer<typeof previewEventSchema>;

export function parseWeeklyEnrichment(value: unknown, bytes?: number): WeeklyEnrichment {
  if (bytes !== undefined && bytes > MAX_WEEKLY_PREVIEW_FILE_BYTES) {
    throw new WeeklyPreviewProjectionError("PREVIEW_INPUT_TOO_LARGE", "预览投影输入超过5 MiB");
  }
  const result = weeklyEnrichmentSchema.safeParse(value);
  if (!result.success) {
    throw new WeeklyPreviewProjectionError(
      "PREVIEW_INPUT_INVALID",
      "预览投影输入未通过严格Schema",
      [...new Set(result.error.issues.map((issue) => issue.path.join(".")))].slice(0, 20),
    );
  }
  return result.data;
}
