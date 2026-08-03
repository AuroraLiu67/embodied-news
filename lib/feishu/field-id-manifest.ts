import {
  feishuTableDefinitions,
  type FeishuTableKey,
} from "./schema-definition";

const toEnvironmentSegment = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toUpperCase();

export interface FeishuFieldIdManifestEntry {
  tableKey: FeishuTableKey;
  tableName: string;
  tableIdConfigKey: string;
  fields: readonly {
    fieldKey: string;
    fieldName: string;
    fieldIdConfigKey: string;
  }[];
}

export const feishuFieldIdManifest: readonly FeishuFieldIdManifestEntry[] =
  feishuTableDefinitions.map((table) => {
    const tableSegment = toEnvironmentSegment(table.key);
    return {
      tableKey: table.key,
      tableName: table.displayName,
      tableIdConfigKey: `FEISHU_TABLE_${tableSegment}_ID`,
      fields: table.fields.map((field) => ({
        fieldKey: field.key,
        fieldName: field.displayName,
        fieldIdConfigKey: `FEISHU_FIELD_${tableSegment}_${toEnvironmentSegment(field.key)}_ID`,
      })),
    };
  });
