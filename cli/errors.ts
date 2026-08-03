import { FeishuClientError } from "../lib/feishu/client-error";
import { FeishuSchemaMappingConfigError } from "../lib/feishu/schema-mapping";
import { FeishuSchemaValidationError } from "../lib/feishu/schema-validator";
import { OverseasDiscoveryError } from "../lib/pipeline/overseas-discovery";
import { OpenAIProviderError } from "../lib/providers/openai";
import { WorkBuddyImportError } from "../lib/providers/workbuddy/importer";

export const cliErrorCodes = [
  "CLI_USAGE_ERROR",
  "CLI_CONFIG_INVALID",
  "CLI_INPUT_INVALID",
  "CLI_FEISHU_PERMISSION_DENIED",
  "CLI_FEISHU_UNAVAILABLE",
  "CLI_OPENAI_UNAVAILABLE",
  "CLI_FEISHU_SCHEMA_INVALID",
  "CLI_UNEXPECTED_ERROR",
] as const;

export type CliErrorCode = (typeof cliErrorCodes)[number];

const exitCodes: Readonly<Record<CliErrorCode, number>> = {
  CLI_UNEXPECTED_ERROR: 1,
  CLI_USAGE_ERROR: 2,
  CLI_CONFIG_INVALID: 2,
  CLI_INPUT_INVALID: 2,
  CLI_FEISHU_PERMISSION_DENIED: 3,
  CLI_FEISHU_UNAVAILABLE: 4,
  CLI_OPENAI_UNAVAILABLE: 4,
  CLI_FEISHU_SCHEMA_INVALID: 5,
};

export class CliError extends Error {
  readonly name = "CliError";
  readonly exitCode: number;

  constructor(
    readonly code: CliErrorCode,
    message: string,
    readonly retryable = false,
    readonly details?: readonly string[],
  ) {
    super(message);
    this.exitCode = exitCodes[code];
  }
}

export const toCliError = (error: unknown): CliError => {
  if (error instanceof CliError) return error;

  if (error instanceof WorkBuddyImportError) {
    return new CliError(
      "CLI_INPUT_INVALID",
      error.message,
      false,
      [error.code, ...error.issuePaths],
    );
  }

  if (error instanceof OverseasDiscoveryError) {
    if (error.code === "OVERSEAS_DISCOVERY_PROVIDER_UNAVAILABLE") {
      return new CliError(
        "CLI_OPENAI_UNAVAILABLE",
        "海外研究服务暂时不可用，请稍后重试",
        true,
        [error.code],
      );
    }
    return new CliError(
      "CLI_INPUT_INVALID",
      error.message,
      false,
      [error.code, ...error.issuePaths],
    );
  }

  if (error instanceof OpenAIProviderError) {
    return new CliError(
      error.retryable ? "CLI_OPENAI_UNAVAILABLE" : "CLI_INPUT_INVALID",
      "海外研究服务未能完成候选发现",
      error.retryable,
      [error.code],
    );
  }

  if (
    error instanceof FeishuSchemaMappingConfigError
  ) {
    return new CliError(
      "CLI_FEISHU_SCHEMA_INVALID",
      "飞书 Schema 映射配置不完整",
      false,
      error.missingConfigKeys,
    );
  }

  if (error instanceof FeishuSchemaValidationError) {
    return new CliError(
      "CLI_FEISHU_SCHEMA_INVALID",
      "飞书实际结构不符合项目契约",
      false,
      error.issues.map(
        (issue) =>
          `${issue.code}:${issue.tableKey}${issue.fieldKey ? `.${issue.fieldKey}` : ""}`,
      ),
    );
  }

  if (error instanceof FeishuClientError) {
    if (
      error.code === "FEISHU_AUTH_FAILED" ||
      error.code === "FEISHU_PERMISSION_DENIED"
    ) {
      return new CliError(
        "CLI_FEISHU_PERMISSION_DENIED",
        "飞书应用认证失败或没有目标多维表格权限",
      );
    }
    if (
      error.code === "FEISHU_NETWORK_ERROR" ||
      error.code === "FEISHU_RATE_LIMITED"
    ) {
      return new CliError(
        "CLI_FEISHU_UNAVAILABLE",
        "暂时无法连接飞书，请检查网络后重试",
        true,
      );
    }
  }

  return new CliError("CLI_UNEXPECTED_ERROR", "CLI 执行失败");
};
