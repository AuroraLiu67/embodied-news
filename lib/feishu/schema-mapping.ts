import type { ConfigSource } from "../config/public";
import { feishuFieldIdManifest } from "./field-id-manifest";
import type { FeishuTableKey } from "./schema-definition";

export interface FeishuTableSchemaMapping {
  tableId: string;
  fieldIds: Readonly<Record<string, string>>;
}

export type FeishuSchemaMapping = Readonly<
  Record<FeishuTableKey, FeishuTableSchemaMapping>
>;

export class FeishuSchemaMappingConfigError extends Error {
  readonly name = "FeishuSchemaMappingConfigError";
  readonly code = "FEISHU_SCHEMA_MAPPING_CONFIG_INVALID";

  constructor(readonly missingConfigKeys: readonly string[]) {
    super(`飞书字段映射配置不完整：缺少 ${missingConfigKeys.length} 项`);
  }
}

export const loadFeishuSchemaMapping = (
  source: ConfigSource = process.env,
): FeishuSchemaMapping => {
  const missingConfigKeys: string[] = [];
  const entries = feishuFieldIdManifest.map((table) => {
    const tableId = source[table.tableIdConfigKey];
    if (!tableId) missingConfigKeys.push(table.tableIdConfigKey);

    const fieldIds = Object.fromEntries(
      table.fields.map((field) => {
        const fieldId = source[field.fieldIdConfigKey];
        if (!fieldId) missingConfigKeys.push(field.fieldIdConfigKey);
        return [field.fieldKey, fieldId ?? ""];
      }),
    );

    return [table.tableKey, { tableId: tableId ?? "", fieldIds }];
  });

  if (missingConfigKeys.length > 0) {
    throw new FeishuSchemaMappingConfigError(missingConfigKeys);
  }

  return Object.fromEntries(entries) as FeishuSchemaMapping;
};
