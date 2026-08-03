import { describe, expect, it } from "vitest";

import { loadOpenAIDiscoveryCliConfig } from "../../cli/config";

const requiredConfig = {
  FEISHU_APP_ID: "cli_test_app",
  FEISHU_APP_SECRET: "secret-value",
  FEISHU_BITABLE_APP_TOKEN: "base-token",
  OPENAI_API_KEY: "openai-key",
  OPENAI_MODEL: "configured-model",
};

describe("D05.1 OpenAI discovery CLI config", () => {
  it("loads dedicated discovery settings without requiring notification config", () => {
    expect(loadOpenAIDiscoveryCliConfig(requiredConfig)).toEqual({
      appId: "cli_test_app",
      appSecret: "secret-value",
      appToken: "base-token",
      openAiApiKey: "openai-key",
      openAiModel: "configured-model",
      openAiDailyRequestLimit: 100,
      openAiMaxInputCharacters: 20_000,
      openAiMaxOutputTokens: 4_000,
      openAiMaxRetries: 2,
      openAiTimeoutMs: 60_000,
    });
  });

  it("rejects missing or malformed OpenAI settings without exposing values", () => {
    expect(() =>
      loadOpenAIDiscoveryCliConfig({
        ...requiredConfig,
        OPENAI_API_KEY: undefined,
      }),
    ).toThrowError(/OPENAI_API_KEY/);

    let caught: unknown;
    try {
      loadOpenAIDiscoveryCliConfig({
        ...requiredConfig,
        OPENAI_TIMEOUT_MS: "secret-invalid-number",
      });
    } catch (error) {
      caught = error;
    }
    expect(String(caught)).toContain("OPENAI_TIMEOUT_MS");
    expect(String(caught)).not.toContain("secret-invalid-number");
  });
});
