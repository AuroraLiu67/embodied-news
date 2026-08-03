export const relevanceErrorCodes = [
  "RELEVANCE_INPUT_INVALID",
  "RELEVANCE_OUTPUT_INVALID",
  "RELEVANCE_CLASSIFIER_FAILED",
] as const;

export type RelevanceErrorCode = (typeof relevanceErrorCodes)[number];

export class RelevanceError extends Error {
  readonly name = "RelevanceError";

  constructor(
    readonly code: RelevanceErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
