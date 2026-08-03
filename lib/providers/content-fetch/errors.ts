export const safeContentErrorCodes = [
  "CONTENT_URL_INVALID",
  "CONTENT_ADDRESS_BLOCKED",
  "CONTENT_DNS_FAILED",
  "CONTENT_REDIRECT_INVALID",
  "CONTENT_REDIRECT_LIMIT",
  "CONTENT_TIMED_OUT",
  "CONTENT_TOO_LARGE",
  "CONTENT_TYPE_UNSUPPORTED",
  "CONTENT_HTTP_ERROR",
  "CONTENT_FETCH_FAILED",
] as const;

export type SafeContentErrorCode = (typeof safeContentErrorCodes)[number];

export class SafeContentError extends Error {
  readonly name = "SafeContentError";

  constructor(
    readonly code: SafeContentErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
