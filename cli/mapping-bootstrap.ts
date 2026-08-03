import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { FeishuClient } from "../lib/feishu/client";
import type { FeishuFieldMetadata, FeishuTableMetadata } from "../lib/feishu/client-types";
import { feishuFieldIdManifest } from "../lib/feishu/field-id-manifest";
import { CliError } from "./errors";

const normalizeName = (value: string): string =>
  value.normalize("NFKC").replace(/[【】\[\]()（）｜|·・—_\-\s]/g, "").toLowerCase();

const tableAliases: Readonly<Record<string, readonly string[]>> = {
  funding_candidates: ["研究候选"],
  funding_events: ["融资事件"],
  company_developments: [
    "公司动态",
    "产品技术商业化",
    "产品技术商业化动态",
    "产品技术商业化公司动态",
  ],
  information_sources: ["信息来源"],
  companies: ["公司"],
  daily_digests: ["日报"],
  watch_items: ["观察清单", "重点关注"],
  internal_assessments: ["内部战投备注"],
  automation_runs: ["自动化任务"],
};

const fieldAliases: Readonly<Record<string, readonly string[]>> = {
  updatedAt: ["更新时间", "最后更新时间"],
  developments: ["关联公司动态", "关联产品/技术/商业化动态"],
};

export interface MappingBootstrapResult {
  tableCount: number;
  fieldCount: number;
  configEntryCount: number;
}

export type MappingEntries = Readonly<Record<string, string>>;

const findUniqueByName = <Item extends { name: string }>(
  items: readonly Item[],
  acceptedNames: readonly string[],
  missingDetail: string,
  ambiguousDetail: string,
): Item => {
  const accepted = new Set(acceptedNames.map(normalizeName));
  const matches = items.filter((item) => accepted.has(normalizeName(item.name)));
  if (matches.length !== 1) {
    throw new CliError("CLI_FEISHU_SCHEMA_INVALID", "无法安全生成字段映射", false, [
      matches.length === 0 ? missingDetail : ambiguousDetail,
    ]);
  }
  return matches[0];
};

export const discoverMappingEntries = async (
  client: Pick<FeishuClient, "listTables" | "listFields">,
): Promise<{ entries: MappingEntries; result: MappingBootstrapResult }> => {
  const tables = await client.listTables();
  const entries: Record<string, string> = {};
  let fieldCount = 0;

  for (const expectedTable of feishuFieldIdManifest) {
    const table = findUniqueByName<FeishuTableMetadata>(
      tables,
      tableAliases[expectedTable.tableKey] ?? [expectedTable.tableName],
      `MISSING_TABLE:${expectedTable.tableKey}`,
      `AMBIGUOUS_TABLE:${expectedTable.tableKey}`,
    );
    entries[expectedTable.tableIdConfigKey] = table.tableId;

    const fields = await client.listFields(table.tableId);
    for (const expectedField of expectedTable.fields) {
      const field = findUniqueByName<FeishuFieldMetadata>(
        fields,
        fieldAliases[expectedField.fieldKey] ?? [expectedField.fieldName],
        `MISSING_FIELD:${expectedTable.tableKey}.${expectedField.fieldKey}`,
        `AMBIGUOUS_FIELD:${expectedTable.tableKey}.${expectedField.fieldKey}`,
      );
      entries[expectedField.fieldIdConfigKey] = field.fieldId;
      fieldCount += 1;
    }
  }

  return {
    entries,
    result: {
      tableCount: feishuFieldIdManifest.length,
      fieldCount,
      configEntryCount: Object.keys(entries).length,
    },
  };
};

export const mergeEnvironmentContent = (content: string, entries: MappingEntries): string => {
  const pending = new Map(Object.entries(entries));
  const lines = content.split(/\r?\n/).map((line) => {
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(line);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1])!;
    pending.delete(match[1]);
    return `${match[1]}=${value}`;
  });

  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  if (pending.size > 0) {
    lines.push("", "# 飞书表与字段 ID（由 mapping-bootstrap 生成）");
    for (const [key, value] of pending) lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n")}\n`;
};

export const writeMappingToEnvironmentFile = async (
  entries: MappingEntries,
  filePath = resolve(process.cwd(), ".env.local"),
): Promise<void> => {
  const content = await readFile(filePath, "utf8");
  const temporaryPath = `${filePath}.mapping-${process.pid}.tmp`;
  await writeFile(temporaryPath, mergeEnvironmentContent(content, entries), {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, filePath);
};
