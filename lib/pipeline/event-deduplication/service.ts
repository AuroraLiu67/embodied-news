import { z } from "zod";

import type {
  FactConflict,
  FundingFacts,
  SourceEvidence,
} from "../../domain";
import {
  fundingFactsSchema,
  conflictSchema,
  researchCandidateSchema,
  safePublicHttpUrlSchema,
  sourceEvidenceSchema,
  stableIdSchema,
} from "../../domain";
import { EventDeduplicationError } from "./errors";
import type {
  EventDeduplicationInput,
  EventDeduplicationResult,
  ProcessedCandidateDirectory,
  ProcessedFundingCandidate,
} from "./types";

const normalizeText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("en-US").trim().replace(/\s+/g, " ");

const processedCandidateSchema = z
  .object({
    candidateId: stableIdSchema,
    canonicalUrl: safePublicHttpUrlSchema,
    companyId: stableIdSchema,
    facts: fundingFactsSchema,
    evidence: z.array(sourceEvidenceSchema).min(1).max(50),
    conflicts: z.array(conflictSchema).max(30),
  })
  .strict();

const deduplicationInputSchema = z
  .object({
    companyId: stableIdSchema,
    facts: fundingFactsSchema,
    evidence: z.array(sourceEvidenceSchema).min(1).max(50),
    conflicts: z.array(conflictSchema).max(30),
  })
  .strict();

const sameNullableText = (left: string | null, right: string | null) =>
  left !== null && right !== null && normalizeText(left) === normalizeText(right);

const sameAmount = (left: FundingFacts, right: FundingFacts) =>
  left.amountDisclosed &&
  right.amountDisclosed &&
  left.amount === right.amount &&
  left.currency === right.currency;

const evidenceFor = (
  evidence: readonly SourceEvidence[],
  field: keyof FundingFacts,
) => evidence.find((source) => source.supportsFacts.includes(field))?.sourceUrl;

const valueOf = (facts: FundingFacts, field: keyof FundingFacts) => {
  const value = facts[field];
  return Array.isArray(value) ? value.join(", ") : String(value);
};

const mergeEvidence = (
  left: readonly SourceEvidence[],
  right: readonly SourceEvidence[],
) => {
  const byUrl = new Map<string, SourceEvidence>();
  for (const source of [...left, ...right]) {
    const existing = byUrl.get(source.sourceUrl);
    if (!existing) {
      byUrl.set(source.sourceUrl, source);
      continue;
    }
    byUrl.set(source.sourceUrl, {
      ...existing,
      supportsFacts: [...new Set([...existing.supportsFacts, ...source.supportsFacts])],
      accessedAt: existing.accessedAt > source.accessedAt
        ? existing.accessedAt
        : source.accessedAt,
    });
  }
  return [...byUrl.values()].sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
};

const conflictFields = (
  left: FundingFacts,
  right: FundingFacts,
): (keyof FundingFacts)[] => {
  const fields: (keyof FundingFacts)[] = [];
  if (left.round && right.round && !sameNullableText(left.round, right.round)) fields.push("round");
  if (
    left.amountDisclosed &&
    right.amountDisclosed &&
    (left.amount !== right.amount || left.currency !== right.currency)
  ) {
    if (left.amount !== right.amount) fields.push("amount");
    if (left.currency !== right.currency) fields.push("currency");
  }
  if (left.announcedAt && right.announcedAt && left.announcedAt !== right.announcedAt) {
    fields.push("announcedAt");
  }
  return fields;
};

const buildConflicts = (
  existing: ProcessedFundingCandidate,
  input: EventDeduplicationInput,
  fields: readonly (keyof FundingFacts)[],
): FactConflict[] => fields.map((field) => {
  const existingUrl = evidenceFor(existing.evidence, field);
  const incomingUrl = evidenceFor(input.evidence, field);
  if (!existingUrl || !incomingUrl) throw new EventDeduplicationError();
  return {
    field,
    values: [
      { value: valueOf(existing.facts, field), sourceUrl: existingUrl },
      { value: valueOf(input.facts, field), sourceUrl: incomingUrl },
    ],
  };
});

export class EventDeduplicationService {
  constructor(private readonly directory: ProcessedCandidateDirectory) {}

  async evaluate(input: EventDeduplicationInput): Promise<EventDeduplicationResult> {
    const candidate = researchCandidateSchema.safeParse(input.candidate);
    const envelope = deduplicationInputSchema.safeParse({
      companyId: input.companyId,
      facts: input.facts,
      evidence: input.evidence,
      conflicts: input.conflicts,
    });
    if (!candidate.success || !envelope.success) {
      throw new EventDeduplicationError();
    }

    const existingResult = z
      .array(processedCandidateSchema)
      .safeParse(await this.directory.listProcessedCandidates());
    if (!existingResult.success) throw new EventDeduplicationError();
    const existing = existingResult.data;
    const rerun = existing.find((item) => item.candidateId === candidate.data.candidateId);
    if (rerun) {
      return {
        status: "EXISTING",
        candidate: candidate.data,
        duplicateOf: candidate.data.duplicateOf,
        evidence: mergeEvidence(rerun.evidence, input.evidence),
        conflicts: rerun.conflicts,
      };
    }

    const urlDuplicate = existing.find(
      (item) => item.canonicalUrl === candidate.data.canonicalUrl,
    );
    if (urlDuplicate) return this.duplicateResult("URL_DUPLICATE", urlDuplicate, input);

    for (const item of existing.filter((entry) => entry.companyId === input.companyId)) {
      const sameDate = sameNullableText(item.facts.announcedAt, envelope.data.facts.announcedAt);
      const sameRound = sameNullableText(item.facts.round, envelope.data.facts.round);
      const amountEqual = sameAmount(item.facts, envelope.data.facts);
      const conflicts = conflictFields(item.facts, envelope.data.facts);

      if (sameDate && conflicts.length > 0) {
        const combinedConflicts = [
          ...item.conflicts,
          ...input.conflicts,
          ...buildConflicts(item, input, conflicts),
        ];
        return {
          status: "CONFLICT",
          candidate: researchCandidateSchema.parse({
            ...candidate.data,
            duplicateOf: item.candidateId,
            conflicts: combinedConflicts,
            reviewStatus: "NEEDS_RESEARCH",
          }),
          duplicateOf: item.candidateId,
          evidence: mergeEvidence(item.evidence, input.evidence),
          conflicts: combinedConflicts,
        };
      }

      const signals = [sameDate, sameRound, amountEqual].filter(Boolean).length;
      if (signals >= 2 || (!item.facts.announcedAt && !envelope.data.facts.announcedAt && sameRound && amountEqual)) {
        return this.duplicateResult("EVENT_DUPLICATE", item, input);
      }
    }

    return {
      status: "NEW",
      candidate: candidate.data,
      duplicateOf: null,
      evidence: input.evidence,
      conflicts: input.conflicts,
    };
  }

  private duplicateResult(
    status: "URL_DUPLICATE" | "EVENT_DUPLICATE",
    existing: ProcessedFundingCandidate,
    input: EventDeduplicationInput,
  ): EventDeduplicationResult {
    const conflicts = [...existing.conflicts, ...input.conflicts];
    return {
      status,
      candidate: researchCandidateSchema.parse({
        ...input.candidate,
        duplicateOf: existing.candidateId,
        conflicts,
        reviewStatus: "DUPLICATE",
      }),
      duplicateOf: existing.candidateId,
      evidence: mergeEvidence(existing.evidence, input.evidence),
      conflicts,
    };
  }
}
