import { describe, expect, it } from "vitest";

import {
  discoverMappingEntries,
  mergeEnvironmentContent,
} from "../../cli/mapping-bootstrap";
import type { FeishuFieldMetadata } from "../../lib/feishu/client-types";
import { feishuFieldIdManifest } from "../../lib/feishu/field-id-manifest";

const tableNames: Readonly<Record<string, string>> = {
  funding_candidates: "研究候选",
  funding_events: "【融资】事件",
  company_developments: "【产品｜技术｜商业化】公司动态",
  information_sources: "信息来源",
  companies: "【公司】",
  daily_digests: "【日报】",
  watch_items: "【重点关注】",
  internal_assessments: "内部战投备注",
  automation_runs: "自动化任务",
};

const mockClient = () => ({
  listTables: async () =>
    feishuFieldIdManifest.map((table) => ({
      tableId: `tbl_${table.tableKey}`,
      name: tableNames[table.tableKey],
    })),
  listFields: async (tableId: string): Promise<FeishuFieldMetadata[]> => {
    const tableKey = tableId.replace("tbl_", "");
    const table = feishuFieldIdManifest.find((item) => item.tableKey === tableKey)!;
    return table.fields.map((field, index) => ({
      fieldId: `fld_${tableKey}_${index}`,
      name:
        field.fieldKey === "updatedAt"
          ? "最后更新时间"
          : field.fieldName.replace(" ", ""),
      uiType: "Text",
      isPrimary: index === 0,
    }));
  },
});

describe("Feishu mapping bootstrap", () => {
  it("discovers unique tables and fields with approved display aliases", async () => {
    const discovered = await discoverMappingEntries(mockClient());

    expect(discovered.result.tableCount).toBe(9);
    expect(discovered.result.fieldCount).toBeGreaterThan(100);
    expect(discovered.entries.FEISHU_TABLE_COMPANIES_ID).toBe("tbl_companies");
    expect(discovered.entries.FEISHU_FIELD_COMPANIES_COMPANY_ID_ID).toBe(
      "fld_companies_0",
    );
  });

  it("stops without a partial mapping when a required table is missing", async () => {
    const client = mockClient();
    await expect(
      discoverMappingEntries({
        ...client,
        listTables: async () => (await client.listTables()).slice(1),
      }),
    ).rejects.toMatchObject({
      code: "CLI_FEISHU_SCHEMA_INVALID",
      details: ["MISSING_TABLE:funding_candidates"],
    });
  });

  it("preserves secrets while replacing and appending only mapping keys", () => {
    const original = [
      "FEISHU_APP_SECRET=secret-sentinel",
      "FEISHU_TABLE_COMPANIES_ID=old-table",
      "OPENAI_API_KEY=openai-secret-sentinel",
      "",
    ].join("\n");
    const merged = mergeEnvironmentContent(original, {
      FEISHU_TABLE_COMPANIES_ID: "new-table",
      FEISHU_FIELD_COMPANIES_COMPANY_ID_ID: "new-field",
    });

    expect(merged).toContain("FEISHU_APP_SECRET=secret-sentinel");
    expect(merged).toContain("OPENAI_API_KEY=openai-secret-sentinel");
    expect(merged).toContain("FEISHU_TABLE_COMPANIES_ID=new-table");
    expect(merged).toContain("FEISHU_FIELD_COMPANIES_COMPANY_ID_ID=new-field");
    expect(merged).not.toContain("old-table");
  });
});
