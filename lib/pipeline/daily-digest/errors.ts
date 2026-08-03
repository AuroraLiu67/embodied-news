export const dailyDigestErrorCodes = [
  "DAILY_DIGEST_CONTENT_INVALID",
  "DAILY_DIGEST_CHANGED",
] as const;

export type DailyDigestErrorCode = (typeof dailyDigestErrorCodes)[number];

export class DailyDigestError extends Error {
  readonly name = "DailyDigestError";

  constructor(
    readonly code: DailyDigestErrorCode,
    message: string,
  ) {
    super(message);
  }
}

