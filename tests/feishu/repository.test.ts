import { describe, expect, it } from "vitest";

import {
  FeishuRepositoryError,
  FeishuTableRepository,
  createFeishuRepositories,
  feishuTableDefinitions,
  type FeishuRecord,
  type FeishuRecordFields,
  type FeishuRecordUpdate,
  type FeishuSchemaMapping,
} from "../../lib/feishu";

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

class InMemoryRepositoryClient {
  readonly tables = new Map<string, FeishuRecord[]>();
  readonly listCalls: string[] = [];
  readonly createCalls: Array<{
    tableId: string;
    records: readonly FeishuRecordFields[];
  }> = [];
  readonly updateCalls: Array<{
    tableId: string;
    records: readonly FeishuRecordUpdate[];
  }> = [];
  private sequence = 0;

  async listAllRecords(tableId: string) {
    this.listCalls.push(tableId);
    return [...(this.tables.get(tableId) ?? [])];
  }

  async batchCreateRecords(
    tableId: string,
    records: readonly FeishuRecordFields[],
  ) {
    this.createCalls.push({ tableId, records });
    const current = this.tables.get(tableId) ?? [];
    const created = records.map((fields) => ({
      recordId: `rec-${++this.sequence}`,
      fields,
    }));
    this.tables.set(tableId, [...current, ...created]);
    return created;
  }

  async batchUpdateRecords(
    tableId: string,
    records: readonly FeishuRecordUpdate[],
  ) {
    this.updateCalls.push({ tableId, records });
    const updates = new Map(records.map((record) => [record.recordId, record]));
    this.tables.set(
      tableId,
      (this.tables.get(tableId) ?? []).map(
        (record) => updates.get(record.recordId) ?? record,
      ),
    );
    return [...records];
  }
}

const mapping = createMapping();
const fixedNow = () => new Date("2026-07-31T15:00:00.000Z");
const event = {
  eventId: "event-001",
  publicSummary: "示例融资事件",
  importanceScore: 5,
} as const;

const expectRepositoryError = async (
  action: () => Promise<unknown>,
  code: FeishuRepositoryError["code"],
) => {
  await expect(action()).rejects.toMatchObject({
    name: "FeishuRepositoryError",
    code,
  });
};

describe("FeishuTableRepository", () => {
  it("creates repositories for all nine frozen tables", () => {
    const repositories = createFeishuRepositories(
      new InMemoryRepositoryClient(),
      mapping,
      { now: fixedNow },
    );
    expect(Object.keys(repositories)).toEqual(
      feishuTableDefinitions.map((table) => table.key),
    );
  });

  it("creates with field IDs and audit fields, then reads by stable business ID", async () => {
    const client = new InMemoryRepositoryClient();
    const repository = new FeishuTableRepository<typeof event>(
      client,
      mapping,
      "funding_events",
      { now: fixedNow, updatedBy: "automation" },
    );

    const result = await repository.createOrUpdate(event);
    expect(result).toMatchObject({
      action: "created",
      record: {
        version: 1,
        createdAt: "2026-07-31T15:00:00.000Z",
        updatedAt: "2026-07-31T15:00:00.000Z",
        data: event,
      },
    });
    const sentFields = client.createCalls[0].records[0];
    expect(sentFields).toEqual({
      [mapping.funding_events.fieldIds.eventId]: event.eventId,
      [mapping.funding_events.fieldIds.publicSummary]: event.publicSummary,
      [mapping.funding_events.fieldIds.importanceScore]: event.importanceScore,
      [mapping.funding_events.fieldIds.version]: 1,
      [mapping.funding_events.fieldIds.createdAt]: 1785510000000,
      [mapping.funding_events.fieldIds.updatedAt]: 1785510000000,
      [mapping.funding_events.fieldIds.updatedBy]: "automation",
    });

    await expect(repository.getByBusinessId(event.eventId)).resolves.toMatchObject({
      version: 1,
      data: event,
    });
    await expect(repository.list()).resolves.toHaveLength(1);
  });

  it("encodes Feishu date fields as millisecond timestamps and decodes domain strings", async () => {
    const client = new InMemoryRepositoryClient();
    const datedEvent = {
      ...event,
      announcedAt: "2026-08-02",
    } as const;
    const repository = new FeishuTableRepository<typeof datedEvent>(
      client,
      mapping,
      "funding_events",
      { now: fixedNow },
    );

    await repository.createOrUpdate(datedEvent);

    expect(client.createCalls[0].records[0]).toMatchObject({
      [mapping.funding_events.fieldIds.announcedAt]: 1785600000000,
      [mapping.funding_events.fieldIds.createdAt]: 1785510000000,
      [mapping.funding_events.fieldIds.updatedAt]: 1785510000000,
    });
    await expect(repository.getByBusinessId(event.eventId)).resolves.toMatchObject({
      createdAt: "2026-07-31T15:00:00.000Z",
      updatedAt: "2026-07-31T15:00:00.000Z",
      data: datedEvent,
    });
  });

  it("rejects invalid domain dates and malformed Feishu date values", async () => {
    const client = new InMemoryRepositoryClient();
    const repository = new FeishuTableRepository(
      client,
      mapping,
      "funding_events",
      { now: fixedNow },
    );

    await expectRepositoryError(
      () =>
        repository.createOrUpdate({
          ...event,
          announcedAt: "not-a-date",
        }),
      "FEISHU_REPOSITORY_INVALID_RECORD",
    );

    const ids = mapping.funding_events.fieldIds;
    client.tables.set(mapping.funding_events.tableId, [
      {
        recordId: "rec-invalid-date",
        fields: {
          [ids.eventId]: "event-invalid-date",
          [ids.version]: 1,
          [ids.createdAt]: "2026-07-31T15:00:00.000Z",
          [ids.updatedAt]: 1785510000000,
        },
      },
    ]);
    await expectRepositoryError(
      () => repository.getByBusinessId("event-invalid-date"),
      "FEISHU_REPOSITORY_MALFORMED_RECORD",
    );
  });

  it("treats an identical repeated create as unchanged", async () => {
    const client = new InMemoryRepositoryClient();
    const repository = new FeishuTableRepository<typeof event>(
      client,
      mapping,
      "funding_events",
      { now: fixedNow },
    );

    await repository.createOrUpdate(event);
    const repeated = await repository.createOrUpdate(event);
    expect(repeated.action).toBe("unchanged");
    expect(client.createCalls).toHaveLength(1);
    expect(client.updateCalls).toHaveLength(0);
    expect(await repository.list()).toHaveLength(1);
  });

  it("updates with the current version and increments audit version", async () => {
    const client = new InMemoryRepositoryClient();
    let currentTime = "2026-07-31T15:00:00.000Z";
    const repository = new FeishuTableRepository<{
      eventId: string;
      publicSummary: string;
      importanceScore: number;
    }>(client, mapping, "funding_events", {
      now: () => new Date(currentTime),
    });

    await repository.createOrUpdate(event);
    currentTime = "2026-07-31T16:00:00.000Z";
    const updatedData = { ...event, publicSummary: "更新后的融资摘要" };
    const updated = await repository.createOrUpdate(updatedData, 1);

    expect(updated).toMatchObject({
      action: "updated",
      record: {
        version: 2,
        createdAt: "2026-07-31T15:00:00.000Z",
        updatedAt: "2026-07-31T16:00:00.000Z",
        data: updatedData,
      },
    });
    await expect(repository.getByBusinessId(event.eventId)).resolves.toMatchObject({
      version: 2,
      data: updatedData,
    });
  });

  it("rejects missing or stale versions before updating", async () => {
    const client = new InMemoryRepositoryClient();
    const repository = new FeishuTableRepository(
      client,
      mapping,
      "funding_events",
      { now: fixedNow },
    );
    await repository.createOrUpdate(event);
    const changed = { ...event, publicSummary: "发生变化" };

    await expectRepositoryError(
      () => repository.createOrUpdate(changed),
      "FEISHU_REPOSITORY_VERSION_CONFLICT",
    );
    await expectRepositoryError(
      () => repository.createOrUpdate(changed, 0),
      "FEISHU_REPOSITORY_VERSION_CONFLICT",
    );
    expect(client.updateCalls).toHaveLength(0);
  });

  it("returns stable errors for missing, duplicate, malformed, and unknown-field records", async () => {
    const client = new InMemoryRepositoryClient();
    const repository = new FeishuTableRepository(
      client,
      mapping,
      "funding_events",
      { now: fixedNow },
    );
    await expectRepositoryError(
      () => repository.getByBusinessId("missing"),
      "FEISHU_REPOSITORY_NOT_FOUND",
    );
    await expectRepositoryError(
      () => repository.createOrUpdate({ eventId: "event-002", forbidden: true }),
      "FEISHU_REPOSITORY_INVALID_RECORD",
    );

    const tableId = mapping.funding_events.tableId;
    const primaryId = mapping.funding_events.fieldIds.eventId;
    client.tables.set(tableId, [
      { recordId: "rec-a", fields: { [primaryId]: "duplicate" } },
      { recordId: "rec-b", fields: { [primaryId]: "duplicate" } },
    ]);
    await expectRepositoryError(
      () => repository.findByBusinessId("duplicate"),
      "FEISHU_REPOSITORY_MALFORMED_RECORD",
    );

    const audit = mapping.funding_events.fieldIds;
    client.tables.set(tableId, [
      {
        recordId: "rec-a",
        fields: {
          [primaryId]: "duplicate",
          [audit.version]: 1,
          [audit.createdAt]: 1785510000000,
          [audit.updatedAt]: 1785510000000,
        },
      },
      {
        recordId: "rec-b",
        fields: {
          [primaryId]: "duplicate",
          [audit.version]: 1,
          [audit.createdAt]: 1785510000000,
          [audit.updatedAt]: 1785510000000,
        },
      },
    ]);
    await expectRepositoryError(
      () => repository.findByBusinessId("duplicate"),
      "FEISHU_REPOSITORY_DUPLICATE_ID",
    );
  });
});
