import type { FeishuClient } from "./client";
import type { FeishuFieldMetadata } from "./client-types";
import type { FeishuSchemaMapping } from "./schema-mapping";
import {
  feishuTableDefinitions,
  type FeishuFieldType,
  type FeishuTableKey,
} from "./schema-definition";

export const feishuSchemaIssueCodes = [
  "DUPLICATE_TABLE_ID",
  "DUPLICATE_FIELD_ID",
  "UNKNOWN_TABLE_ID",
  "UNKNOWN_FIELD_ID",
  "FIELD_TYPE_MISMATCH",
  "PRIMARY_FIELD_MISMATCH",
  "RELATION_TARGET_MISMATCH",
  "RELATION_CARDINALITY_MISMATCH",
] as const;

export type FeishuSchemaIssueCode = (typeof feishuSchemaIssueCodes)[number];

export interface FeishuSchemaIssue {
  code: FeishuSchemaIssueCode;
  tableKey: FeishuTableKey;
  fieldKey?: string;
}

export class FeishuSchemaValidationError extends Error {
  readonly name = "FeishuSchemaValidationError";
  readonly code = "FEISHU_SCHEMA_INVALID";

  constructor(readonly issues: readonly FeishuSchemaIssue[]) {
    super(`飞书 Schema 校验失败：发现 ${issues.length} 个问题`);
  }
}

export interface FeishuSchemaValidationResult {
  tableCount: number;
  fieldCount: number;
}

const acceptedUiTypes: Readonly<Record<FeishuFieldType, readonly string[]>> = {
  text: ["Text", "AutoNumber"],
  longText: ["Text"],
  url: ["Url"],
  number: ["Number", "Progress", "Currency", "Rating"],
  checkbox: ["Checkbox"],
  date: ["DateTime"],
  dateTime: ["DateTime", "CreatedTime", "ModifiedTime"],
  singleSelect: ["SingleSelect"],
  multiSelect: ["MultiSelect"],
  textArray: ["Text", "MultiSelect"],
  relation: ["SingleLink", "DuplexLink"],
  user: ["User", "CreatedUser", "ModifiedUser"],
};

const hasDuplicates = (values: readonly string[]): boolean =>
  new Set(values).size !== values.length;

const validateField = (
  tableKey: FeishuTableKey,
  fieldKey: string,
  expectedType: FeishuFieldType,
  expectedPrimary: boolean,
  expectedRelationTableId: string | undefined,
  expectedMultiple: boolean | undefined,
  actual: FeishuFieldMetadata,
): FeishuSchemaIssue[] => {
  const issues: FeishuSchemaIssue[] = [];
  if (!acceptedUiTypes[expectedType].includes(actual.uiType)) {
    issues.push({ code: "FIELD_TYPE_MISMATCH", tableKey, fieldKey });
  }
  if (expectedPrimary !== actual.isPrimary) {
    issues.push({ code: "PRIMARY_FIELD_MISMATCH", tableKey, fieldKey });
  }
  if (
    expectedType === "relation" &&
    expectedRelationTableId !== actual.relationTableId
  ) {
    issues.push({ code: "RELATION_TARGET_MISMATCH", tableKey, fieldKey });
  }
  if (
    expectedType === "relation" &&
    expectedMultiple !== undefined &&
    actual.multiple !== undefined &&
    expectedMultiple !== actual.multiple
  ) {
    issues.push({ code: "RELATION_CARDINALITY_MISMATCH", tableKey, fieldKey });
  }
  return issues;
};

export const validateFeishuSchema = async (
  client: Pick<FeishuClient, "listTables" | "listFields">,
  mapping: FeishuSchemaMapping,
): Promise<FeishuSchemaValidationResult> => {
  const issues: FeishuSchemaIssue[] = [];
  const tables = await client.listTables();
  const actualTableIds = new Set(tables.map((table) => table.tableId));
  const configuredTableIds = feishuTableDefinitions.map(
    (table) => mapping[table.key].tableId,
  );

  if (hasDuplicates(configuredTableIds)) {
    for (const table of feishuTableDefinitions) {
      issues.push({ code: "DUPLICATE_TABLE_ID", tableKey: table.key });
    }
  }

  let fieldCount = 0;
  for (const table of feishuTableDefinitions) {
    const tableMapping = mapping[table.key];
    if (!actualTableIds.has(tableMapping.tableId)) {
      issues.push({ code: "UNKNOWN_TABLE_ID", tableKey: table.key });
      continue;
    }

    const configuredFieldIds = table.fields.map(
      (field) => tableMapping.fieldIds[field.key],
    );
    if (hasDuplicates(configuredFieldIds)) {
      issues.push({ code: "DUPLICATE_FIELD_ID", tableKey: table.key });
    }

    const fields = await client.listFields(tableMapping.tableId);
    fieldCount += fields.length;
    const actualById = new Map(fields.map((field) => [field.fieldId, field]));

    for (const expected of table.fields) {
      const actual = actualById.get(tableMapping.fieldIds[expected.key]);
      if (!actual) {
        issues.push({
          code: "UNKNOWN_FIELD_ID",
          tableKey: table.key,
          fieldKey: expected.key,
        });
        continue;
      }
      const relationTargetId = expected.relationTable
        ? mapping[expected.relationTable].tableId
        : undefined;
      issues.push(
        ...validateField(
          table.key,
          expected.key,
          expected.type,
          expected.key === table.primaryFieldKey,
          relationTargetId,
          expected.multiple,
          actual,
        ),
      );
    }
  }

  if (issues.length > 0) throw new FeishuSchemaValidationError(issues);
  return { tableCount: feishuTableDefinitions.length, fieldCount };
};
