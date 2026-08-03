import type { ConfigSource } from "../lib/config/public";
import { CliError } from "./errors";

export interface FeishuCliConfig {
  appId: string;
  appSecret: string;
  appToken: string;
}

export interface OpenAIDiscoveryCliConfig extends FeishuCliConfig {
  openAiApiKey: string;
  openAiModel: string;
  openAiDailyRequestLimit: number;
  openAiMaxInputCharacters: number;
  openAiMaxOutputTokens: number;
  openAiMaxRetries: number;
  openAiTimeoutMs: number;
}

const requiredKeys = [
  "FEISHU_APP_ID",
  "FEISHU_APP_SECRET",
  "FEISHU_BITABLE_APP_TOKEN",
] as const;

export const loadFeishuCliConfig = (
  source: ConfigSource = process.env,
): FeishuCliConfig => {
  const missing = requiredKeys.filter((key) => !source[key]?.trim());
  if (missing.length > 0) {
    throw new CliError(
      "CLI_CONFIG_INVALID",
      `飞书 CLI 配置不完整，缺少：${missing.join(", ")}`,
    );
  }

  const tooLong = requiredKeys.filter((key) => source[key]!.length > 500);
  if (tooLong.length > 0) {
    throw new CliError("CLI_CONFIG_INVALID", "飞书 CLI 配置长度不合法");
  }

  return {
    appId: source.FEISHU_APP_ID!,
    appSecret: source.FEISHU_APP_SECRET!,
    appToken: source.FEISHU_BITABLE_APP_TOKEN!,
  };
};

const integerSetting = (
  source: ConfigSource,
  key: string,
  fallback: number,
  minimum: number,
): number => {
  const raw = source[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new CliError(
      "CLI_CONFIG_INVALID",
      `海外发现配置不合法：${key}`,
    );
  }
  return value;
};

export const loadOpenAIDiscoveryCliConfig = (
  source: ConfigSource = process.env,
): OpenAIDiscoveryCliConfig => {
  const feishu = loadFeishuCliConfig(source);
  const missing = ["OPENAI_API_KEY", "OPENAI_MODEL"].filter(
    (key) => !source[key]?.trim(),
  );
  if (missing.length > 0) {
    throw new CliError(
      "CLI_CONFIG_INVALID",
      `海外发现配置不完整，缺少：${missing.join(", ")}`,
    );
  }
  if (
    source.OPENAI_API_KEY!.length > 500 ||
    source.OPENAI_MODEL!.length > 100
  ) {
    throw new CliError("CLI_CONFIG_INVALID", "海外发现配置长度不合法");
  }
  return {
    ...feishu,
    openAiApiKey: source.OPENAI_API_KEY!,
    openAiModel: source.OPENAI_MODEL!,
    openAiDailyRequestLimit: integerSetting(
      source,
      "OPENAI_DAILY_REQUEST_LIMIT",
      100,
      1,
    ),
    openAiMaxInputCharacters: integerSetting(
      source,
      "OPENAI_MAX_INPUT_CHARACTERS",
      20_000,
      1,
    ),
    openAiMaxOutputTokens: integerSetting(
      source,
      "OPENAI_MAX_OUTPUT_TOKENS",
      4_000,
      1,
    ),
    openAiMaxRetries: integerSetting(
      source,
      "OPENAI_MAX_RETRIES",
      2,
      0,
    ),
    openAiTimeoutMs: integerSetting(
      source,
      "OPENAI_TIMEOUT_MS",
      60_000,
      1,
    ),
  };
};
