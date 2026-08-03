import { describe, expect, it } from "vitest";

import {
  ConfigurationError,
  loadPublicConfig,
  loadServerConfig,
} from "../../lib/config";

const liveConfig = {
  APP_ENV: "production",
  PROVIDER_MODE: "live",
  APP_TIME_ZONE: "Asia/Shanghai",
  FEISHU_APP_ID: "cli_example",
  FEISHU_APP_SECRET: "server-secret-sentinel",
  FEISHU_BITABLE_APP_TOKEN: "bitable-token-sentinel",
  FEISHU_NOTIFICATION_RECIPIENT_OPEN_ID: "ou_person_example",
  OPENAI_API_KEY: "openai-secret-sentinel",
  OPENAI_MODEL: "configured-model",
};

describe("server configuration", () => {
  it("defaults local development to mock providers", () => {
    expect(loadServerConfig({})).toEqual({
      appEnvironment: "local",
      timeZone: "Asia/Shanghai",
      providers: { mode: "mock" },
    });
  });

  it("accepts a complete production live configuration", () => {
    const config = loadServerConfig({
      ...liveConfig,
      OPENAI_DAILY_REQUEST_LIMIT: "7",
      OPENAI_MAX_INPUT_CHARACTERS: "12000",
      OPENAI_MAX_OUTPUT_TOKENS: "2300",
      OPENAI_MAX_RETRIES: "3",
      OPENAI_TIMEOUT_MS: "45000",
    });
    expect(config.appEnvironment).toBe("production");
    expect(config.providers.mode).toBe("live");
    if (config.providers.mode !== "live") throw new Error("expected live config");
    expect(config.providers.openAi).toMatchObject({
      model: "configured-model",
      dailyRequestLimit: 7,
      maxInputCharacters: 12000,
      maxOutputTokens: 2300,
      maxRetries: 3,
      timeoutMs: 45000,
    });
    expect(config.providers.notification).toEqual({
      recipientOpenId: "ou_person_example",
    });
  });

  it("rejects invalid OpenAI budget limits", () => {
    expect(() =>
      loadServerConfig({ ...liveConfig, OPENAI_MAX_RETRIES: "6" }),
    ).toThrow(ConfigurationError);
    expect(() =>
      loadServerConfig({ ...liveConfig, OPENAI_DAILY_REQUEST_LIMIT: "0" }),
    ).toThrow(ConfigurationError);
  });

  it("reports every missing live credential without exposing values", () => {
    expect(() =>
      loadServerConfig({
        APP_ENV: "production",
        PROVIDER_MODE: "live",
      }),
    ).toThrow(ConfigurationError);

    try {
      loadServerConfig({
        APP_ENV: "production",
        PROVIDER_MODE: "live",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(String(error)).toContain("feishuAppSecret");
      expect(String(error)).toContain("openAiApiKey");
      expect(String(error)).not.toContain("server-secret-sentinel");
    }
  });

  it("does not accept a group chat ID as the notification recipient", () => {
    const withoutDirectRecipient: Record<string, string> = { ...liveConfig };
    delete withoutDirectRecipient.FEISHU_NOTIFICATION_RECIPIENT_OPEN_ID;
    expect(() =>
      loadServerConfig({
        ...withoutDirectRecipient,
        FEISHU_NOTIFICATION_CHAT_ID: "oc_group_chat",
      }),
    ).toThrow("feishuNotificationRecipientOpenId");
  });

  it("prevents live providers in the test environment", () => {
    expect(() =>
      loadServerConfig({ ...liveConfig, APP_ENV: "test" }),
    ).toThrow("测试环境只能使用 mock Provider");
  });

  it("prevents mock providers in production", () => {
    expect(() =>
      loadServerConfig({
        APP_ENV: "production",
        PROVIDER_MODE: "mock",
      }),
    ).toThrow("生产环境必须使用 live Provider");
  });

  it("rejects an invalid business time zone", () => {
    expect(() =>
      loadServerConfig({
        APP_ENV: "local",
        PROVIDER_MODE: "mock",
        APP_TIME_ZONE: "Mars/Olympus",
      }),
    ).toThrow("必须是有效的 IANA 时区");
  });
});

describe("public configuration", () => {
  it("accepts root and GitHub Pages project paths", () => {
    expect(loadPublicConfig({})).toEqual({ siteBasePath: "" });
    expect(
      loadPublicConfig({ NEXT_PUBLIC_SITE_BASE_PATH: "/embodied-news-4Galbot" }),
    ).toEqual({ siteBasePath: "/embodied-news-4Galbot" });
  });

  it("rejects malformed or trailing-slash base paths", () => {
    expect(() =>
      loadPublicConfig({ NEXT_PUBLIC_SITE_BASE_PATH: "missing-leading-slash" }),
    ).toThrow(ConfigurationError);
    expect(() =>
      loadPublicConfig({ NEXT_PUBLIC_SITE_BASE_PATH: "/repository/" }),
    ).toThrow(ConfigurationError);
  });

  it("never returns server credentials", () => {
    const publicConfig = loadPublicConfig({
      ...liveConfig,
      NEXT_PUBLIC_SITE_BASE_PATH: "/public-site",
    });
    const serialized = JSON.stringify(publicConfig);

    expect(serialized).toBe('{"siteBasePath":"/public-site"}');
    expect(serialized).not.toContain(liveConfig.FEISHU_APP_SECRET);
    expect(serialized).not.toContain(liveConfig.OPENAI_API_KEY);
  });
});
