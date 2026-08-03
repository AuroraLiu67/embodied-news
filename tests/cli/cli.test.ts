import { describe, expect, it, vi } from "vitest";

import { runCli, type CliServices } from "../../cli/app";
import { FeishuClientError } from "../../lib/feishu/client-error";
import { FeishuSchemaValidationError } from "../../lib/feishu/schema-validator";
import { OverseasDiscoveryError } from "../../lib/pipeline/overseas-discovery";
import { OpenAIProviderError } from "../../lib/providers/openai";

const services = (overrides: Partial<CliServices> = {}): CliServices => ({
  checkConnection: vi.fn().mockResolvedValue({ tableCount: 9 }),
  checkSchema: vi.fn().mockResolvedValue({ tableCount: 9, fieldCount: 127 }),
  bootstrapMapping: vi.fn().mockResolvedValue({
    tableCount: 9,
    fieldCount: 127,
    configEntryCount: 136,
  }),
  importWorkBuddy: vi.fn().mockResolvedValue({
    total: 2,
    created: 1,
    duplicates: 1,
  }),
  discoverOpenAI: vi.fn().mockResolvedValue({
    totalQueries: 3,
    created: 1,
    duplicates: 1,
    rejected: 1,
    failed: 0,
  }),
  ...overrides,
});

describe("project Feishu CLI", () => {
  it("returns a successful human-readable connection summary", async () => {
    const result = await runCli(["connection-check"], () => services());

    expect(result).toEqual({
      exitCode: 0,
      stdout: "飞书连接检查通过：可读取 9 张表",
      stderr: "",
    });
  });

  it("returns machine-readable schema results", async () => {
    const result = await runCli(["schema-check", "--json"], () => services());

    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      command: "schema-check",
      data: { tableCount: 9, fieldCount: 127 },
    });
    expect(result.exitCode).toBe(0);
  });

  it("maps permission errors to exit code 3", async () => {
    const result = await runCli(["connection-check", "--json"], () =>
      services({
        checkConnection: vi.fn().mockRejectedValue(
          new FeishuClientError(
            "FEISHU_PERMISSION_DENIED",
            "secret-app-token must never leak",
            false,
          ),
        ),
      }),
    );

    expect(result.exitCode).toBe(3);
    expect(JSON.parse(result.stdout).error.code).toBe(
      "CLI_FEISHU_PERMISSION_DENIED",
    );
    expect(result.stdout).not.toContain("secret-app-token");
  });

  it("maps missing fields to a distinct schema exit code", async () => {
    const result = await runCli(["schema-check"], () =>
      services({
        checkSchema: vi.fn().mockRejectedValue(
          new FeishuSchemaValidationError([
            { code: "UNKNOWN_FIELD_ID", tableKey: "companies", fieldKey: "nameZh" },
          ]),
        ),
      }),
    );

    expect(result.exitCode).toBe(5);
    expect(result.stderr).toContain("CLI_FEISHU_SCHEMA_INVALID");
    expect(result.stderr).toContain("UNKNOWN_FIELD_ID:companies.nameZh");
  });

  it("maps network failures to retryable exit code 4", async () => {
    const result = await runCli(["connection-check", "--json"], () =>
      services({
        checkConnection: vi.fn().mockRejectedValue(
          new FeishuClientError(
            "FEISHU_NETWORK_ERROR",
            "network error containing secret-value",
            true,
          ),
        ),
      }),
    );

    const output = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(4);
    expect(output.error).toMatchObject({
      code: "CLI_FEISHU_UNAVAILABLE",
      retryable: true,
    });
    expect(result.stdout).not.toContain("secret-value");
  });

  it("shows help without constructing live services", async () => {
    const getServices = vi.fn();
    const result = await runCli(["help"], getServices);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("connection-check");
    expect(result.stdout).toContain("schema-check");
    expect(getServices).not.toHaveBeenCalled();
  });

  it("accepts the conventional pnpm argument separator", async () => {
    const result = await runCli(["--", "help"], vi.fn());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("项目飞书 CLI");
  });

  it("rejects unknown commands with a usage exit code", async () => {
    const result = await runCli(["delete-everything"], () => services());

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("CLI_USAGE_ERROR");
  });

  it("imports a WorkBuddy file and reports created and duplicate counts", async () => {
    const mockServices = services();
    const result = await runCli(
      ["workbuddy-import", "candidates.json", "--json"],
      () => mockServices,
    );

    expect(mockServices.importWorkBuddy).toHaveBeenCalledWith("candidates.json");
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: "workbuddy-import",
      data: { total: 2, created: 1, duplicates: 1 },
    });
  });

  it("requires exactly one file path for WorkBuddy import", async () => {
    const result = await runCli(["workbuddy-import"], () => services());

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("CLI_USAGE_ERROR");
  });

  it("runs dated OpenAI discovery and reports safe machine-readable counts", async () => {
    const mockServices = services();
    const result = await runCli(
      [
        "openai-discover",
        "2026-08-02",
        "overseas-queries.json",
        "--json",
      ],
      () => mockServices,
    );

    expect(mockServices.discoverOpenAI).toHaveBeenCalledWith(
      "2026-08-02",
      "overseas-queries.json",
    );
    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      command: "openai-discover",
      data: {
        totalQueries: 3,
        created: 1,
        duplicates: 1,
        rejected: 1,
        failed: 0,
      },
    });
  });

  it("requires a business date and query file for OpenAI discovery", async () => {
    const result = await runCli(
      ["openai-discover", "2026-08-02"],
      () => services(),
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("CLI_USAGE_ERROR");
  });

  it("maps OpenAI discovery failures to a distinct retryable error", async () => {
    const result = await runCli(
      ["openai-discover", "2026-08-02", "queries.json", "--json"],
      () =>
        services({
          discoverOpenAI: vi.fn().mockRejectedValue(
            new OpenAIProviderError(
              "OPENAI_RATE_LIMITED",
              "secret provider response",
              true,
            ),
          ),
        }),
    );

    expect(result.exitCode).toBe(4);
    expect(JSON.parse(result.stdout).error).toMatchObject({
      code: "CLI_OPENAI_UNAVAILABLE",
      retryable: true,
    });
    expect(result.stdout).not.toContain("secret provider response");
  });

  it("maps an all-query discovery outage to a retryable OpenAI error", async () => {
    const result = await runCli(
      ["openai-discover", "2026-08-02", "queries.json", "--json"],
      () =>
        services({
          discoverOpenAI: vi.fn().mockRejectedValue(
            new OverseasDiscoveryError(
              "OVERSEAS_DISCOVERY_PROVIDER_UNAVAILABLE",
              "secret outage details",
            ),
          ),
        }),
    );

    expect(result.exitCode).toBe(4);
    expect(JSON.parse(result.stdout).error).toMatchObject({
      code: "CLI_OPENAI_UNAVAILABLE",
      retryable: true,
    });
    expect(result.stdout).not.toContain("secret outage details");
  });
});
