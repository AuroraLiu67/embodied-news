import { z } from "zod";

import {
  confidenceSchema,
  relevanceDecisions,
  researchCandidateSchema,
} from "../../domain";
import { boundedText } from "../../domain/schemas/primitives";
import { RelevanceError } from "./errors";
import type {
  CandidateRelevanceInput,
  RelevanceClassifier,
  RelevanceClassifierOutput,
} from "./types";

const classifierOutputSchema = z
  .object({
    decision: z.enum(relevanceDecisions),
    confidence: confidenceSchema,
    reason: boundedText(1000),
  })
  .strict();

export interface CandidateRelevanceServiceOptions {
  lowConfidenceThreshold?: number;
  maxContentCharacters?: number;
}

export class CandidateRelevanceService {
  private readonly lowConfidenceThreshold: number;
  private readonly maxContentCharacters: number;

  constructor(
    private readonly classifier: RelevanceClassifier,
    options: CandidateRelevanceServiceOptions = {},
  ) {
    this.lowConfidenceThreshold = options.lowConfidenceThreshold ?? 0.6;
    this.maxContentCharacters = options.maxContentCharacters ?? 20_000;
    if (
      !classifier.model.trim() ||
      classifier.model.length > 100 ||
      this.lowConfidenceThreshold < 0 ||
      this.lowConfidenceThreshold > 1 ||
      this.maxContentCharacters < 1
    ) {
      throw new RelevanceError(
        "RELEVANCE_INPUT_INVALID",
        "相关性判断配置无效",
        false,
      );
    }
  }

  async assess(input: CandidateRelevanceInput) {
    const candidate = researchCandidateSchema.safeParse(input.candidate);
    if (!candidate.success || !input.content.text.trim()) {
      throw new RelevanceError(
        "RELEVANCE_INPUT_INVALID",
        "相关性判断输入无效",
        false,
      );
    }

    let rawOutput: unknown;
    try {
      rawOutput = await this.classifier.classify({
        title: candidate.data.title,
        sourceName: candidate.data.sourceName,
        sourceUrl: candidate.data.sourceUrl,
        content: input.content.text.slice(0, this.maxContentCharacters),
      });
    } catch {
      throw new RelevanceError(
        "RELEVANCE_CLASSIFIER_FAILED",
        "相关性判断服务失败",
        true,
      );
    }

    const output = classifierOutputSchema.safeParse(rawOutput);
    if (!output.success) {
      throw new RelevanceError(
        "RELEVANCE_OUTPUT_INVALID",
        "相关性判断结果未通过 Schema",
        false,
      );
    }

    const assessment = this.normalizeLowConfidence(output.data);
    const reviewStatus = candidate.data.reviewStatus === "DUPLICATE"
      ? "DUPLICATE"
      : assessment.decision === "UNCERTAIN"
        ? "NEEDS_RESEARCH"
        : "PENDING";

    return researchCandidateSchema.parse({
      ...candidate.data,
      relevance: {
        ...assessment,
        model: this.classifier.model,
      },
      reviewStatus,
    });
  }

  private normalizeLowConfidence(
    output: RelevanceClassifierOutput,
  ): RelevanceClassifierOutput {
    if (
      output.confidence.level === "LOW" ||
      output.confidence.score < this.lowConfidenceThreshold
    ) {
      return { ...output, decision: "UNCERTAIN" };
    }
    return output;
  }
}
