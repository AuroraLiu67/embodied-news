import { describe, expect, it } from "vitest";

import {
  FeishuSchemaMappingConfigError,
  FeishuSchemaValidationError,
  feishuFieldIdManifest,
  feishuTableDefinitions,
  loadFeishuSchemaMapping,
  validateFeishuSchema,
  type FeishuFieldMetadata,
  type FeishuFieldType,
  type FeishuSchemaMapping,
  type FeishuTableMetadata,
} from "../../lib/feishu";

const uiTypeByFieldType: Readonly<Record<FeishuFieldType, string>> = {
  text: "Text",
  longText: "Text",
  url: "Url",
  number: "Number",
  checkbox: "Checkbox",
  date: "DateTime",
  dateTime: "DateTime",
  singleSelect: "SingleSelect",
  multiSelect: "MultiSelect",
  textArray: "MultiSelect",
  relation: "DuplexLink",
  user: "User",
};

const createMapping = (): FeishuSchemaMapping =>
  Object.fromEntries(
    feishuTableDefinitions.map((table) => [
      table.key,
      {
        tableId: `tbl_${table.key}`,
        fieldIds: Object.fromEntries(
          table.fields.map((field) => [
            field.key,
            `fld_${table.key}_${field.key}`,
          ]),
        ),
      },
    ]),
  ) as FeishuSchemaMapping;

const createMetadata = (mapping: FeishuSchemaMapping) => {
  const tables: FeishuTableMetadata[] = feishuTableDefinitions.map((table) => ({
    tableId: mapping[table.key].tableId,
    name: table.displayName,
  }));
  const fields = Object.fromEntries(
    feishuTableDefinitions.map((table) => [
      mapping[table.key].tableId,
      table.fields.map(
        (field): FeishuFieldMetadata => ({
          fieldId: mapping[table.key].fieldIds[field.key],
          name: field.displayName,
          uiType: uiTypeByFieldType[field.type],
          isPrimary: field.key === table.primaryFieldKey,
          relationTableId: field.relationTable
            ? mapping[field.relationTable].tableId
            : undefined,
          multiple: field.multiple,
        }),
      ),
    ]),
  ) as Record<string, FeishuFieldMetadata[]>;
  return { tables, fields };
};

class FakeSchemaClient {
  constructor(
    readonly tables: readonly FeishuTableMetadata[],
    readonly fields: Readonly<Record<string, readonly FeishuFieldMetadata[]>>,
  ) {}

  async listTables() {
    return [...this.tables];
  }

  async listFields(tableId: string) {
    return [...(this.fields[tableId] ?? [])];
  }
}

const expectValidationIssue = async (
  action: () => Promise<unknown>,
  code: string,
) => {
  const error = await action().catch((caught) => caught);
  expect(error).toBeInstanceOf(FeishuSchemaValidationError);
  expect((error as FeishuSchemaValidationError).issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ code })]),
  );
};

describe("Feishu schema mapping configuration", () => {
  it("loads every table ID and field ID from the generated config manifest", () => {
    const source = Object.fromEntries(
      feishuFieldIdManifest.flatMap((table) => [
        [table.tableIdConfigKey, `tbl_${table.tableKey}`],
        ...table.fields.map((field) => [
          field.fieldIdConfigKey,
          `fld_${table.tableKey}_${field.fieldKey}`,
        ]),
      ]),
    );

    const mapping = loadFeishuSchemaMapping(source);
    expect(Object.keys(mapping)).toHaveLength(9);
    expect(mapping.funding_events.tableId).toBe("tbl_funding_events");
    expect(mapping.funding_events.fieldIds.eventId).toBe(
      "fld_funding_events_eventId",
    );
  });

  it("fails fast with stable missing config keys", () => {
    const error = (() => {
      try {
        loadFeishuSchemaMapping({});
      } catch (caught) {
        return caught;
      }
    })();
    expect(error).toBeInstanceOf(FeishuSchemaMappingConfigError);
    expect(error).toMatchObject({ code: "FEISHU_SCHEMA_MAPPING_CONFIG_INVALID" });
    expect((error as FeishuSchemaMappingConfigError).missingConfigKeys).toContain(
      "FEISHU_TABLE_FUNDING_EVENTS_ID",
    );
  });
});

describe("Feishu live schema validator", () => {
  it("accepts a complete mapping with matching field types and relations", async () => {
    const mapping = createMapping();
    const metadata = createMetadata(mapping);
    const client = new FakeSchemaClient(metadata.tables, metadata.fields);

    await expect(validateFeishuSchema(client, mapping)).resolves.toEqual({
      tableCount: 9,
      fieldCount: feishuTableDefinitions.reduce(
        (total, table) => total + table.fields.length,
        0,
      ),
    });
  });

  it("fails with UNKNOWN_TABLE_ID when a mapping points to the wrong table", async () => {
    const mapping = createMapping();
    const metadata = createMetadata(mapping);
    const wrongMapping = {
      ...mapping,
      funding_events: {
        ...mapping.funding_events,
        tableId: "tbl_not_in_this_base",
      },
    } satisfies FeishuSchemaMapping;

    await expectValidationIssue(
      () => validateFeishuSchema(new FakeSchemaClient(metadata.tables, metadata.fields), wrongMapping),
      "UNKNOWN_TABLE_ID",
    );
  });

  it("fails with UNKNOWN_FIELD_ID when a configured field was deleted", async () => {
    const mapping = createMapping();
    const metadata = createMetadata(mapping);
    const tableId = mapping.funding_events.tableId;
    metadata.fields[tableId] = metadata.fields[tableId].filter(
      (field) => field.fieldId !== mapping.funding_events.fieldIds.eventId,
    );

    await expectValidationIssue(
      () => validateFeishuSchema(new FakeSchemaClient(metadata.tables, metadata.fields), mapping),
      "UNKNOWN_FIELD_ID",
    );
  });

  it("fails with FIELD_TYPE_MISMATCH when a field type changes", async () => {
    const mapping = createMapping();
    const metadata = createMetadata(mapping);
    const tableId = mapping.funding_events.tableId;
    metadata.fields[tableId] = metadata.fields[tableId].map((field) =>
      field.fieldId === mapping.funding_events.fieldIds.importanceScore
        ? { ...field, uiType: "Text" }
        : field,
    );

    await expectValidationIssue(
      () => validateFeishuSchema(new FakeSchemaClient(metadata.tables, metadata.fields), mapping),
      "FIELD_TYPE_MISMATCH",
    );
  });

  it("fails when a relation points to the wrong table", async () => {
    const mapping = createMapping();
    const metadata = createMetadata(mapping);
    const tableId = mapping.funding_events.tableId;
    metadata.fields[tableId] = metadata.fields[tableId].map((field) =>
      field.fieldId === mapping.funding_events.fieldIds.company
        ? { ...field, relationTableId: mapping.daily_digests.tableId }
        : field,
    );

    await expectValidationIssue(
      () => validateFeishuSchema(new FakeSchemaClient(metadata.tables, metadata.fields), mapping),
      "RELATION_TARGET_MISMATCH",
    );
  });

  it("does not depend on editable table or field display names", async () => {
    const mapping = createMapping();
    const metadata = createMetadata(mapping);
    const renamedTables = metadata.tables.map((table) => ({
      ...table,
      name: `【重命名】${table.name}`,
    }));
    const renamedFields = Object.fromEntries(
      Object.entries(metadata.fields).map(([tableId, fields]) => [
        tableId,
        fields.map((field) => ({ ...field, name: `重命名-${field.name}` })),
      ]),
    );

    await expect(
      validateFeishuSchema(
        new FakeSchemaClient(renamedTables, renamedFields),
        mapping,
      ),
    ).resolves.toMatchObject({ tableCount: 9 });
  });
});
