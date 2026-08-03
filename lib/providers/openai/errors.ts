export const openAIProviderErrorCodes = [
  "OPENAI_INPUT_INVALID",
  "OPENAI_DAILY_LIMIT_EXCEEDED",
  "OPENAI_RATE_LIMITED",
  "OPENAI_TIMED_OUT",
  "OPENAI_SERVICE_UNAVAILABLE",
  "OPENAI_REFUSED",
  "OPENAI_INCOMPLETE_RESPONSE",
  "OPENAI_INVALID_RESPONSE",
  "OPENAI_API_ERROR",
] as const;

export type OpenAIProviderErrorCode =
  (typeof openAIProviderErrorCodes)[number];

export class OpenAIProviderError extends Error {
  readonly name = "OpenAIProviderError";

  constructor(
    readonly code: OpenAIProviderErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  typeof error.status === "number"
    ? error.status
    : undefined;

export const mapOpenAIError = (error: unknown): OpenAIProviderError => {
  if (error instanceof OpenAIProviderError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new OpenAIProviderError(
      "OPENAI_TIMED_OUT",
      "OpenAI 请求超时",
      true,
    );
  }

  const status = statusOf(error);
  if (status === 429) {
    return new OpenAIProviderError(
      "OPENAI_RATE_LIMITED",
      "OpenAI 请求达到限流",
      true,
    );
  }
  if (status !== undefined && status >= 500) {
    return new OpenAIProviderError(
      "OPENAI_SERVICE_UNAVAILABLE",
      "OpenAI 服务暂时不可用",
      true,
    );
  }
  return new OpenAIProviderError(
    "OPENAI_API_ERROR",
    "OpenAI 请求失败",
    false,
  );
};
