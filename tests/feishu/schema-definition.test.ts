import { describe, expect, it } from "vitest";

import {
  feishuFieldIdManifest,
  feishuTableByKey,
  feishuTableDefinitions,
  type FeishuViewDefinition,
} from "../../lib/feishu";
import {
  companyDesignRecord,
  digestDesignRecord,
  developmentDesignRecord,
  eventDesignRecord,
  feishuDesignRecords,
  sourceDesignRecord,
} from "../fixtures/feishu-design";

const requiredFieldsByTable = {
  funding_candidates: [
    "candidateId",
    "title",
    "sourceUrl",
    "sourceType",
    "sourceTier",
    "contentType",
    "regionScope",
    "discoveredBy",
    "discoveredAt",
    "extractedFacts",
    "relevanceDecision",
    "confidenceLevel",
    "duplicateCandidate",
    "conflictSummary",
    "reviewStatus",
  ],
  funding_events: [
    "eventId",
    "company",
    "round",
    "amount",
    "currency",
    "amountDisclosed",
    "investors",
    "announcedAt",
    "region",
    "technologyTags",
    "publicSummary",
    "sources",
    "confidenceLevel",
    "importanceScore",
    "importanceReason",
    "isPublic",
    "publicationStatus",
  ],
  company_developments: [
    "developmentId",
    "company",
    "category",
    "title",
    "announcedAt",
    "publicSummary",
    "sources",
    "importanceScore",
    "importanceReason",
    "isPublic",
    "publicationStatus",
  ],
  information_sources: [
    "sourceId",
    "title",
    "url",
    "publisher",
    "sourceType",
    "sourceTier",
    "isPrimary",
    "lastVerifiedAt",
  ],
  companies: [
    "companyId",
    "nameZh",
    "nameEn",
    "aliases",
    "website",
    "region",
    "technologyTags",
    "publicDescription",
    "fundingEvents",
    "developments",
  ],
  daily_digests: [
    "digestId",
    "digestDate",
    "title",
    "fundingEvents",
    "technologyProductDevelopments",
    "commercializationDevelopments",
    "sectionOrder",
    "reviewStatus",
    "publicationStatus",
    "autoPublished",
    "correctionNote",
  ],
  watch_items: [
    "type",
    "name",
    "queries",
    "region",
    "technologyTags",
    "sourceTier",
    "priority",
    "enabled",
  ],
  internal_assessments: [
    "company",
    "fundingEvent",
    "attentionLevel",
    "strategicAssessment",
    "followUpStatus",
    "owner",
    "internalNotes",
  ],
  automation_runs: [
    "runId",
    "businessDate",
    "jobType",
    "status",
    "attempt",
    "startedAt",
    "finishedAt",
    "errorSummary",
    "manualActionRequired",
  ],
} as const;

const matchesView = (
  record: Readonly<Record<string, unknown>>,
  view: FeishuViewDefinition,
  today = "2026-07-31",
) =>
  view.filters.every((filter) => {
    const value = record[filter.fieldKey];
    switch (filter.operator) {
      case "equals":
        return value === filter.value;
      case "in":
        return Array.isArray(filter.value) && filter.value.includes(String(value));
      case "isNotEmpty":
        return value !== null && value !== undefined && value !== "";
      case "dateIsToday":
        return typeof value === "string" && value.slice(0, 10) === today;
    }
  });

describe("Feishu schema definition", () => {
  it("defines exactly the nine frozen tables", () => {
    expect(feishuTableDefinitions.map((table) => table.displayName)).toEqual([
      "研究候选",
      "融资事件",
      "公司动态",
      "信息来源",
      "公司",
      "日报",
      "观察清单",
      "内部战投备注",
      "自动化任务",
    ]);
  });

  it("contains every PRD-required field and audit fields", () => {
    for (const table of feishuTableDefinitions) {
      const keys = new Set(table.fields.map((field) => field.key));
      for (const requiredKey of requiredFieldsByTable[table.key]) {
        expect(keys.has(requiredKey), `${table.displayName}.${requiredKey}`).toBe(true);
      }
      for (const auditKey of ["version", "createdAt", "updatedAt", "updatedBy"]) {
        expect(keys.has(auditKey), `${table.displayName}.${auditKey}`).toBe(true);
      }
      expect(keys.has(table.primaryFieldKey)).toBe(true);
    }
  });

  it("keeps internal assessments and candidate workflow fields non-public", () => {
    expect(
      feishuTableByKey.internal_assessments.fields.every(
        (field) => field.visibility !== "PUBLIC",
      ),
    ).toBe(true);

    const candidatePublicFields =
      feishuTableByKey.funding_candidates.fields.filter(
        (field) => field.visibility === "PUBLIC",
      );
    expect(candidatePublicFields).toEqual([]);

    for (const key of ["isPublic", "publicationStatus"]) {
      expect(
        feishuTableByKey.funding_events.fields.find((field) => field.key === key)
          ?.visibility,
      ).toBe("INTERNAL");
    }
  });

  it("uses valid relation targets and valid view field references", () => {
    for (const table of feishuTableDefinitions) {
      const fieldKeys = new Set(table.fields.map((field) => field.key));
      for (const field of table.fields) {
        if (field.type === "relation") {
          expect(field.relationTable).toBeDefined();
          expect(feishuTableByKey[field.relationTable!]).toBeDefined();
        }
      }
      for (const view of table.views) {
        for (const fieldKey of [
          ...view.columns,
          ...view.filters.map((filter) => filter.fieldKey),
          ...(view.sort ?? []).map((sort) => sort.fieldKey),
        ]) {
          expect(fieldKeys.has(fieldKey), `${table.displayName}.${view.name}.${fieldKey}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("creates a complete and unique field ID mapping checklist", () => {
    expect(feishuFieldIdManifest).toHaveLength(9);
    const configKeys = feishuFieldIdManifest.flatMap((entry) => [
      entry.tableIdConfigKey,
      ...entry.fields.map((field) => field.fieldIdConfigKey),
    ]);
    expect(new Set(configKeys).size).toBe(configKeys.length);
    expect(configKeys.every((key) => /^FEISHU_(TABLE|FIELD)_[A-Z0-9_]+_ID$/.test(key))).toBe(
      true,
    );
  });
});

describe("cross-table relation and view acceptance", () => {
  it("contains company, event, development, source and digest samples", () => {
    expect(feishuDesignRecords.map((record) => record.tableKey)).toEqual([
      "companies",
      "funding_events",
      "information_sources",
      "company_developments",
      "daily_digests",
    ]);
  });

  it("resolves company, content, source and digest business-ID relations", () => {
    expect(companyDesignRecord.fields.fundingEvents).toContain(
      eventDesignRecord.fields.eventId,
    );
    expect(eventDesignRecord.fields.company).toContain(
      companyDesignRecord.fields.companyId,
    );
    expect(companyDesignRecord.fields.developments).toContain(
      developmentDesignRecord.fields.developmentId,
    );
    expect(developmentDesignRecord.fields.company).toContain(
      companyDesignRecord.fields.companyId,
    );
    expect(eventDesignRecord.fields.sources).toContain(
      sourceDesignRecord.fields.sourceId,
    );
    expect(developmentDesignRecord.fields.sources).toContain(
      sourceDesignRecord.fields.sourceId,
    );
    expect(digestDesignRecord.fields.fundingEvents).toContain(
      eventDesignRecord.fields.eventId,
    );
    expect(digestDesignRecord.fields.technologyProductDevelopments).toContain(
      developmentDesignRecord.fields.developmentId,
    );
  });

  it("requires inline sources and importance scores for every publishable item", () => {
    for (const tableKey of ["funding_events", "company_developments"] as const) {
      const fields = feishuTableByKey[tableKey].fields;
      expect(fields.find((field) => field.key === "sources")?.required).toBe(true);
      expect(fields.find((field) => field.key === "importanceScore")?.required).toBe(true);
    }
    expect(sourceDesignRecord.fields.url).toMatch(/^https:\/\//);
  });

  it("supports focus companies and focus tracks in the watch list", () => {
    const typeField = feishuTableByKey.watch_items.fields.find(
      (field) => field.key === "type",
    );
    expect(typeField?.options).toEqual(
      expect.arrayContaining(["FOCUS_COMPANY", "FOCUS_TRACK"]),
    );
  });

  it("uses the three fixed digest sections", () => {
    const digestFields = feishuTableByKey.daily_digests.fields.map(
      (field) => field.key,
    );
    expect(digestFields).toEqual(
      expect.arrayContaining([
        "fundingEvents",
        "technologyProductDevelopments",
        "commercializationDevelopments",
      ]),
    );
  });

  it("sorts publishable funding and company developments by importance descending", () => {
    for (const tableKey of ["funding_events", "company_developments"] as const) {
      const publicView = feishuTableByKey[tableKey].views.find(
        (view) => view.name === "公开已发布",
      );
      expect(publicView?.sort).toContainEqual({
        fieldKey: "importanceScore",
        direction: "desc",
      });
    }
  });

  it("places published samples into the public event and digest archive views", () => {
    const publicEventView = feishuTableByKey.funding_events.views.find(
      (view) => view.name === "公开已发布",
    );
    const digestArchiveView = feishuTableByKey.daily_digests.views.find(
      (view) => view.name === "已发布归档",
    );

    expect(publicEventView).toBeDefined();
    expect(digestArchiveView).toBeDefined();
    expect(matchesView(eventDesignRecord.fields, publicEventView!)).toBe(true);
    expect(matchesView(digestDesignRecord.fields, digestArchiveView!)).toBe(true);
  });
});

describe("D01 research candidate review views", () => {
  const candidateViews = Object.fromEntries(
    feishuTableByKey.funding_candidates.views.map((view) => [view.name, view]),
  ) as Readonly<Record<string, FeishuViewDefinition>>;

  const candidate = (
    overrides: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> => ({
    candidateId: "candidate-view-001",
    title: "脱敏候选",
    sourceUrl: "https://example.com/news/candidate-view-001",
    sourceTier: "PRIMARY",
    discoveredAt: "2026-07-31T00:30:00.000Z",
    confidenceLevel: "MEDIUM",
    confidenceScore: 0.65,
    duplicateCandidate: null,
    conflictSummary: "",
    reviewStatus: "PENDING",
    ...overrides,
  });

  it("routes each candidate status into the intended review view", () => {
    expect(matchesView(candidate({}), candidateViews["今日待审核"]!)).toBe(true);
    expect(
      matchesView(
        candidate({
          discoveredAt: "2026-07-30T00:30:00.000Z",
          confidenceLevel: "HIGH",
          confidenceScore: 0.94,
        }),
        candidateViews["高置信度"]!,
      ),
    ).toBe(true);
    expect(
      matchesView(
        candidate({ confidenceLevel: "LOW", confidenceScore: 0.31 }),
        candidateViews["低置信度"]!,
      ),
    ).toBe(true);
    expect(
      matchesView(
        candidate({
          reviewStatus: "NEEDS_RESEARCH",
          conflictSummary: "轮次存在冲突",
        }),
        candidateViews["待复核"]!,
      ),
    ).toBe(true);
    expect(
      matchesView(
        candidate({
          reviewStatus: "DUPLICATE",
          duplicateCandidate: "candidate-existing-001",
        }),
        candidateViews["重复候选"]!,
      ),
    ).toBe(true);
  });

  it("does not place rejected or approved candidates into pending views", () => {
    for (const status of ["APPROVED", "REJECTED"] as const) {
      const reviewed = candidate({ reviewStatus: status, confidenceLevel: "HIGH" });
      expect(matchesView(reviewed, candidateViews["今日待审核"]!)).toBe(false);
      expect(matchesView(reviewed, candidateViews["高置信度"]!)).toBe(false);
    }
  });

  it("shows source and conflict context without exposing system payload columns", () => {
    const forbiddenColumns = new Set([
      "canonicalUrl",
      "rawExcerpt",
      "extractedFacts",
      "version",
      "createdAt",
      "updatedAt",
      "updatedBy",
    ]);

    for (const view of Object.values(candidateViews)) {
      expect(view.columns).toContain("sourceUrl");
      expect(view.columns).toContain("sourceTier");
      expect(view.columns).toContain("conflictSummary");
      expect(view.columns.some((column) => forbiddenColumns.has(column))).toBe(false);
    }
  });
});
