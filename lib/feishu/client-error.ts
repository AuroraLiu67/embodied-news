export const feishuClientErrorCodes = [
  "FEISHU_AUTH_FAILED",
  "FEISHU_PERMISSION_DENIED",
  "FEISHU_RATE_LIMITED",
  "FEISHU_NOT_FOUND",
  "FEISHU_INVALID_REQUEST",
  "FEISHU_MALFORMED_RESPONSE",
  "FEISHU_NETWORK_ERROR",
  "FEISHU_API_ERROR",
] as const;

export type FeishuClientErrorCode = (typeof feishuClientErrorCodes)[number];

export class FeishuClientError extends Error {
  readonly name = "FeishuClientError";

  constructor(
    readonly code: FeishuClientErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly causeCode?: number,
  ) {
    super(message);
  }
}

const authCodes = new Set([99991661, 99991663, 99991668]);
const permissionCodes = new Set([91403, 99991672, 1254302]);
const rateLimitCodes = new Set([99991400, 1254290, 1254291]);
const notFoundCodes = new Set([1254040, 1254041, 1254042, 1254043, 1254044]);
const invalidRequestCodes = new Set([1254000, 1254001, 1254002, 1254003, 1254004]);

export const mapFeishuApiError = (
  code: number,
  message?: string,
): FeishuClientError => {
  const safeMessage = `飞书 API 请求失败（code=${code}）`;
  if (authCodes.has(code)) {
    return new FeishuClientError("FEISHU_AUTH_FAILED", safeMessage, false, code);
  }
  if (permissionCodes.has(code)) {
    return new FeishuClientError(
      "FEISHU_PERMISSION_DENIED",
      safeMessage,
      false,
      code,
    );
  }
  if (rateLimitCodes.has(code) || /rate.?limit|too many/i.test(message ?? "")) {
    return new FeishuClientError("FEISHU_RATE_LIMITED", safeMessage, true, code);
  }
  if (notFoundCodes.has(code)) {
    return new FeishuClientError("FEISHU_NOT_FOUND", safeMessage, false, code);
  }
  if (invalidRequestCodes.has(code)) {
    return new FeishuClientError("FEISHU_INVALID_REQUEST", safeMessage, false, code);
  }
  return new FeishuClientError("FEISHU_API_ERROR", safeMessage, false, code);
};

export const mapFeishuThrownError = (error: unknown): FeishuClientError => {
  if (error instanceof FeishuClientError) return error;

  const status =
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "status" in error.response &&
    typeof error.response.status === "number"
      ? error.response.status
      : undefined;

  if (status === 429 || (status !== undefined && status >= 500)) {
    return new FeishuClientError(
      status === 429 ? "FEISHU_RATE_LIMITED" : "FEISHU_NETWORK_ERROR",
      "飞书请求暂时失败",
      true,
      status,
    );
  }

  return new FeishuClientError(
    "FEISHU_NETWORK_ERROR",
    "飞书网络请求失败",
    true,
  );
};
