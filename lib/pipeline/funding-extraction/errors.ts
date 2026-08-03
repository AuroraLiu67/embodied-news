export const fundingExtractionErrorCodes = [
  "FUNDING_EXTRACTION_INPUT_INVALID",
  "FUNDING_EXTRACTION_OUTPUT_INVALID",
  "FUNDING_EXTRACTION_PROVIDER_FAILED",
] as const;

export type FundingExtractionErrorCode =
  (typeof fundingExtractionErrorCodes)[number];

export class FundingExtractionError extends Error {
  readonly name = "FundingExtractionError";

  constructor(
    readonly code: FundingExtractionErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
