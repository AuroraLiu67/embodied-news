import { z } from "zod";

import { ConfigurationError } from "./error";
import type { ConfigSource } from "./public";

const nonEmptySecret = z.string().min(1).max(500);
const positiveIntegerFromEnvironment = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const timeZoneSchema = z.string().min(1).max(100).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "必须是有效的 IANA 时区");

const rawServerConfigSchema = z
  .object({
    appEnvironment: z.enum(["local", "test", "production"]),
    providerMode: z.enum(["mock", "live"]),
    timeZone: timeZoneSchema,
    feishuAppId: nonEmptySecret.optional(),
    feishuAppSecret: nonEmptySecret.optional(),
    feishuBitableAppToken: nonEmptySecret.optional(),
    openAiApiKey: nonEmptySecret.optional(),
    openAiModel: z.string().min(1).max(100).optional(),
    openAiDailyRequestLimit: positiveIntegerFromEnvironment(100),
    openAiMaxInputCharacters: positiveIntegerFromEnvironment(20_000),
    openAiMaxOutputTokens: positiveIntegerFromEnvironment(4_000),
    openAiMaxRetries: z.coerce.number().int().min(0).max(5).default(2),
    openAiTimeoutMs: positiveIntegerFromEnvironment(60_000),
    feishuNotificationRecipientOpenId: nonEmptySecret.optional(),
  })
  .strict()
  .superRefine((config, context) => {
    if (config.appEnvironment === "test" && config.providerMode !== "mock") {
      context.addIssue({
        code: "custom",
        path: ["providerMode"],
        message: "测试环境只能使用 mock Provider",
      });
    }

    if (config.appEnvironment === "production" && config.providerMode !== "live") {
      context.addIssue({
        code: "custom",
        path: ["providerMode"],
        message: "生产环境必须使用 live Provider",
      });
    }

    if (config.providerMode === "live") {
      const requiredLiveFields = [
        "feishuAppId",
        "feishuAppSecret",
        "feishuBitableAppToken",
        "openAiApiKey",
        "openAiModel",
        "feishuNotificationRecipientOpenId",
      ] as const;

      for (const field of requiredLiveFields) {
        if (!config[field]) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: "live Provider 模式下为必填项",
          });
        }
      }
    }
  });

interface LiveProviderConfig {
  mode: "live";
  feishu: {
    appId: string;
    appSecret: string;
    bitableAppToken: string;
  };
  openAi: {
    apiKey: string;
    model: string;
    dailyRequestLimit: number;
    maxInputCharacters: number;
    maxOutputTokens: number;
    maxRetries: number;
    timeoutMs: number;
  };
  notification: {
    recipientOpenId: string;
  };
}

interface MockProviderConfig {
  mode: "mock";
}

export interface ServerConfig {
  appEnvironment: "local" | "test" | "production";
  timeZone: string;
  providers: LiveProviderConfig | MockProviderConfig;
}

export const loadServerConfig = (source: ConfigSource = process.env): ServerConfig => {
  const result = rawServerConfigSchema.safeParse({
    appEnvironment: source.APP_ENV ?? "local",
    providerMode: source.PROVIDER_MODE ?? "mock",
    timeZone: source.APP_TIME_ZONE ?? "Asia/Shanghai",
    feishuAppId: source.FEISHU_APP_ID,
    feishuAppSecret: source.FEISHU_APP_SECRET,
    feishuBitableAppToken: source.FEISHU_BITABLE_APP_TOKEN,
    openAiApiKey: source.OPENAI_API_KEY,
    openAiModel: source.OPENAI_MODEL,
    openAiDailyRequestLimit: source.OPENAI_DAILY_REQUEST_LIMIT,
    openAiMaxInputCharacters: source.OPENAI_MAX_INPUT_CHARACTERS,
    openAiMaxOutputTokens: source.OPENAI_MAX_OUTPUT_TOKENS,
    openAiMaxRetries: source.OPENAI_MAX_RETRIES,
    openAiTimeoutMs: source.OPENAI_TIMEOUT_MS,
    feishuNotificationRecipientOpenId:
      source.FEISHU_NOTIFICATION_RECIPIENT_OPEN_ID,
  });

  if (!result.success) {
    throw new ConfigurationError(result.error);
  }

  const config = result.data;
  if (config.providerMode === "mock") {
    return {
      appEnvironment: config.appEnvironment,
      timeZone: config.timeZone,
      providers: { mode: "mock" },
    };
  }

  return {
    appEnvironment: config.appEnvironment,
    timeZone: config.timeZone,
    providers: {
      mode: "live",
      feishu: {
        appId: config.feishuAppId!,
        appSecret: config.feishuAppSecret!,
        bitableAppToken: config.feishuBitableAppToken!,
      },
      openAi: {
        apiKey: config.openAiApiKey!,
        model: config.openAiModel!,
        dailyRequestLimit: config.openAiDailyRequestLimit,
        maxInputCharacters: config.openAiMaxInputCharacters,
        maxOutputTokens: config.openAiMaxOutputTokens,
        maxRetries: config.openAiMaxRetries,
        timeoutMs: config.openAiTimeoutMs,
      },
      notification: {
        recipientOpenId: config.feishuNotificationRecipientOpenId!,
      },
    },
  };
};
