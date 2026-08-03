import type { ConfigSource } from "../lib/config/public";
import { createLiveFeishuClient } from "../lib/feishu/client";
import { loadFeishuSchemaMapping } from "../lib/feishu/schema-mapping";
import { validateFeishuSchema } from "../lib/feishu/schema-validator";
import { FeishuTableRepository } from "../lib/feishu/repository";
import {
  loadOverseasDiscoveryQueryFile,
  OverseasDiscoveryService,
  type OpenAIDiscoveredCandidate,
  type OverseasDiscoveryResult,
} from "../lib/pipeline/overseas-discovery";
import { createLiveOpenAIProvider } from "../lib/providers/openai";
import {
  importWorkBuddyCandidateFile,
  type ImportedResearchCandidate,
  type WorkBuddyImportResult,
} from "../lib/providers/workbuddy/importer";
import {
  loadFeishuCliConfig,
  loadOpenAIDiscoveryCliConfig,
} from "./config";
import { CliError, toCliError } from "./errors";
import {
  discoverMappingEntries,
  writeMappingToEnvironmentFile,
  type MappingBootstrapResult,
} from "./mapping-bootstrap";

export interface CliCheckResult {
  tableCount: number;
  fieldCount?: number;
}

export interface CliServices {
  checkConnection(): Promise<CliCheckResult>;
  checkSchema(): Promise<CliCheckResult>;
  bootstrapMapping(): Promise<MappingBootstrapResult>;
  importWorkBuddy(filePath: string): Promise<WorkBuddyImportResult>;
  discoverOpenAI(
    businessDate: string,
    queryFilePath: string,
  ): Promise<OverseasDiscoveryResult>;
}

export interface CliExecution {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ParsedArguments {
  command:
    | "help"
    | "connection-check"
    | "schema-check"
    | "mapping-bootstrap"
    | "workbuddy-import"
    | "openai-discover";
  json: boolean;
  filePath?: string;
  businessDate?: string;
}

const helpText = `项目飞书 CLI

用法：pnpm cli -- <命令> [--json]

命令：
  help              显示帮助
  connection-check  检查应用能否读取目标多维表格
  schema-check      检查九张表和固定字段 ID 是否符合契约
  mapping-bootstrap 只读发现表和字段 ID，并安全写入 .env.local
  workbuddy-import   校验候选 JSON 并导入“研究候选”表
  openai-discover    按指定业务日期运行海外融资发现并写入“研究候选”表

选项：
  --json            输出机器可读 JSON`;

const parseArguments = (arguments_: readonly string[]): ParsedArguments => {
  const json = arguments_.includes("--json");
  const positional = arguments_.filter((argument) => argument !== "--json");
  const command = positional[0] ?? "help";
  if (!(["help", "connection-check", "schema-check", "mapping-bootstrap", "workbuddy-import", "openai-discover"] as const).includes(
    command as ParsedArguments["command"],
  )) {
    throw new CliError("CLI_USAGE_ERROR", "未知命令，请查看 help");
  }
  if (command === "workbuddy-import") {
    if (positional.length !== 2) {
      throw new CliError(
        "CLI_USAGE_ERROR",
        "workbuddy-import 必须提供一个候选 JSON 文件路径",
      );
    }
    return {
      command: "workbuddy-import",
      json,
      filePath: positional[1],
    };
  }
  if (command === "openai-discover") {
    if (positional.length !== 3) {
      throw new CliError(
        "CLI_USAGE_ERROR",
        "openai-discover 必须提供业务日期和查询 JSON 文件路径",
      );
    }
    return {
      command: "openai-discover",
      json,
      businessDate: positional[1],
      filePath: positional[2],
    };
  }
  if (positional.length > 1) {
    throw new CliError("CLI_USAGE_ERROR", "命令参数过多，请查看 help");
  }
  return { command: command as ParsedArguments["command"], json };
};

const successText = (
  command: ParsedArguments["command"],
  result:
    | CliCheckResult
    | MappingBootstrapResult
    | WorkBuddyImportResult
    | OverseasDiscoveryResult,
) => {
  if (command === "workbuddy-import") {
    const imported = result as WorkBuddyImportResult;
    return `WorkBuddy 候选导入完成：共 ${imported.total} 条，新建 ${imported.created} 条，重复 ${imported.duplicates} 条`;
  }
  if (command === "openai-discover") {
    const discovered = result as OverseasDiscoveryResult;
    return `OpenAI 海外候选发现完成：查询 ${discovered.totalQueries} 条，新建 ${discovered.created} 条，重复 ${discovered.duplicates} 条，拒绝 ${discovered.rejected} 条，失败 ${discovered.failed} 条`;
  }
  const checked = result as CliCheckResult | MappingBootstrapResult;
  if (command === "connection-check") {
    return `飞书连接检查通过：可读取 ${checked.tableCount} 张表`;
  }
  if (command === "mapping-bootstrap") {
    return `飞书字段映射已写入 .env.local：${checked.tableCount} 张表，${checked.fieldCount ?? 0} 个字段`;
  }
  return `飞书 Schema 检查通过：${checked.tableCount} 张表，${checked.fieldCount ?? 0} 个字段`;
};

export const createLiveCliServices = (
  source: ConfigSource = process.env,
): CliServices => {
  const config = loadFeishuCliConfig(source);
  const client = createLiveFeishuClient(config);
  return {
    async checkConnection() {
      const tables = await client.listTables();
      return { tableCount: tables.length };
    },
    async checkSchema() {
      return validateFeishuSchema(client, loadFeishuSchemaMapping(source));
    },
    async bootstrapMapping() {
      const discovered = await discoverMappingEntries(client);
      await writeMappingToEnvironmentFile(discovered.entries);
      return discovered.result;
    },
    async importWorkBuddy(filePath) {
      const mapping = loadFeishuSchemaMapping(source);
      await validateFeishuSchema(client, mapping);
      const repository = new FeishuTableRepository<ImportedResearchCandidate>(
        client,
        mapping,
        "funding_candidates",
      );
      return importWorkBuddyCandidateFile(filePath, repository);
    },
    async discoverOpenAI(businessDate, queryFilePath) {
      const discoveryConfig = loadOpenAIDiscoveryCliConfig(source);
      const mapping = loadFeishuSchemaMapping(source);
      await validateFeishuSchema(client, mapping);
      const repository = new FeishuTableRepository<OpenAIDiscoveredCandidate>(
        client,
        mapping,
        "funding_candidates",
      );
      const provider = createLiveOpenAIProvider({
        apiKey: discoveryConfig.openAiApiKey,
        model: discoveryConfig.openAiModel,
        dailyRequestLimit: discoveryConfig.openAiDailyRequestLimit,
        maxInputCharacters: discoveryConfig.openAiMaxInputCharacters,
        maxOutputTokens: discoveryConfig.openAiMaxOutputTokens,
        maxRetries: discoveryConfig.openAiMaxRetries,
        timeoutMs: discoveryConfig.openAiTimeoutMs,
      });
      const service = new OverseasDiscoveryService({
        provider,
        repository,
        model: discoveryConfig.openAiModel,
      });
      return service.discover(
        businessDate,
        await loadOverseasDiscoveryQueryFile(queryFilePath),
      );
    },
  };
};

export const runCli = async (
  arguments_: readonly string[],
  getServices: () => CliServices = () => createLiveCliServices(),
): Promise<CliExecution> => {
  const normalizedArguments = arguments_.filter((argument) => argument !== "--");
  let command =
    normalizedArguments.find((argument) => argument !== "--json") ?? "help";
  const jsonRequested = normalizedArguments.includes("--json");
  try {
    const parsed = parseArguments(normalizedArguments);
    command = parsed.command;
    if (parsed.command === "help") {
      return parsed.json
        ? {
            exitCode: 0,
            stdout: JSON.stringify({ ok: true, command: "help", help: helpText }),
            stderr: "",
          }
        : { exitCode: 0, stdout: helpText, stderr: "" };
    }

    const services = getServices();
    const result =
      parsed.command === "workbuddy-import"
        ? await services.importWorkBuddy(parsed.filePath!)
        : parsed.command === "openai-discover"
          ? await services.discoverOpenAI(
              parsed.businessDate!,
              parsed.filePath!,
            )
        : parsed.command === "connection-check"
        ? await services.checkConnection()
        : parsed.command === "schema-check"
          ? await services.checkSchema()
          : await services.bootstrapMapping();
    return parsed.json
      ? {
          exitCode: 0,
          stdout: JSON.stringify({ ok: true, command: parsed.command, data: result }),
          stderr: "",
        }
      : { exitCode: 0, stdout: successText(parsed.command, result), stderr: "" };
  } catch (error) {
    const safeError = toCliError(error);
    if (jsonRequested) {
      return {
        exitCode: safeError.exitCode,
        stdout: JSON.stringify({
          ok: false,
          command,
          error: {
            code: safeError.code,
            message: safeError.message,
            retryable: safeError.retryable,
            ...(safeError.details ? { details: safeError.details } : {}),
          },
        }),
        stderr: "",
      };
    }
    return {
      exitCode: safeError.exitCode,
      stdout: "",
      stderr: [
        `${safeError.code}: ${safeError.message}`,
        ...(safeError.details ?? []).map((detail) => `- ${detail}`),
      ].join("\n"),
    };
  }
};
