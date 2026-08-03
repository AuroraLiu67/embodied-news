import type { FeishuClient } from "./client";
import type { FeishuRecord, FeishuRecordFields } from "./client-types";
import type { FeishuSchemaMapping } from "./schema-mapping";
import {
  feishuTableByKey,
  feishuTableDefinitions,
  type FeishuTableKey,
} from "./schema-definition";

export const feishuRepositoryErrorCodes = [
  "FEISHU_REPOSITORY_INVALID_RECORD",
  "FEISHU_REPOSITORY_MALFORMED_RECORD",
  "FEISHU_REPOSITORY_NOT_FOUND",
  "FEISHU_REPOSITORY_DUPLICATE_ID",
  "FEISHU_REPOSITORY_VERSION_CONFLICT",
] as const;

export type FeishuRepositoryErrorCode =
  (typeof feishuRepositoryErrorCodes)[number];

export class FeishuRepositoryError extends Error {
  readonly name = "FeishuRepositoryError";

  constructor(
    readonly code: FeishuRepositoryErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface FeishuRepositoryRecord<
  Data extends Readonly<Record<string, unknown>>,
> {
  recordId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: unknown;
  data: Data;
}

export interface FeishuRepositoryWriteResult<
  Data extends Readonly<Record<string, unknown>>,
> {
  action: "created" | "updated" | "unchanged";
  record: FeishuRepositoryRecord<Data>;
}

export interface FeishuRepositoryOptions {
  now?: () => Date;
  updatedBy?: unknown;
}

type RepositoryClient = Pick<
  FeishuClient,
  "listAllRecords" | "batchCreateRecords" | "batchUpdateRecords"
>;

const auditKeys = new Set(["version", "createdAt", "updatedAt", "updatedBy"]);

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export class FeishuTableRepository<
  Data extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, unknown>
  >,
> {
  private readonly definition;
  private readonly tableMapping;
  private readonly primaryFieldId: string;
  private readonly fieldKeyById: ReadonlyMap<string, string>;
  private readonly fieldTypeByKey: ReadonlyMap<
    string,
    (typeof this.definition.fields)[number]["type"]
  >;
  private readonly now: () => Date;

  constructor(
    private readonly client: RepositoryClient,
    mapping: FeishuSchemaMapping,
    readonly tableKey: FeishuTableKey,
    private readonly options: FeishuRepositoryOptions = {},
  ) {
    this.definition = feishuTableByKey[tableKey];
    this.tableMapping = mapping[tableKey];
    this.primaryFieldId = this.tableMapping.fieldIds[this.definition.primaryFieldKey];
    this.fieldKeyById = new Map(
      Object.entries(this.tableMapping.fieldIds).map(([key, id]) => [id, key]),
    );
    this.fieldTypeByKey = new Map(
      this.definition.fields.map((field) => [field.key, field.type]),
    );
    this.now = options.now ?? (() => new Date());
  }

  async list(): Promise<FeishuRepositoryRecord<Data>[]> {
    const records = await this.client.listAllRecords(this.tableMapping.tableId);
    return records.map((record) => this.decode(record));
  }

  async findByBusinessId(
    businessId: string,
  ): Promise<FeishuRepositoryRecord<Data> | null> {
    if (!businessId) this.invalid("稳定业务 ID 不能为空");
    const matches = (await this.client.listAllRecords(this.tableMapping.tableId))
      .filter((record) => record.fields[this.primaryFieldId] === businessId)
      .map((record) => this.decode(record));
    if (matches.length > 1) {
      throw new FeishuRepositoryError(
        "FEISHU_REPOSITORY_DUPLICATE_ID",
        "飞书中存在重复稳定业务 ID",
      );
    }
    return matches[0] ?? null;
  }

  async getByBusinessId(
    businessId: string,
  ): Promise<FeishuRepositoryRecord<Data>> {
    const record = await this.findByBusinessId(businessId);
    if (!record) {
      throw new FeishuRepositoryError(
        "FEISHU_REPOSITORY_NOT_FOUND",
        "未找到指定稳定业务 ID 的记录",
      );
    }
    return record;
  }

  async createOrUpdate(
    data: Data,
    expectedVersion?: number,
  ): Promise<FeishuRepositoryWriteResult<Data>> {
    const businessId = data[this.definition.primaryFieldKey];
    if (typeof businessId !== "string" || businessId.length === 0) {
      this.invalid(`缺少稳定业务 ID 字段 ${this.definition.primaryFieldKey}`);
    }
    this.assertKnownDataFields(data);

    const existing = await this.findByBusinessId(businessId);
    if (!existing) return this.create(data);

    if (stableSerialize(existing.data) === stableSerialize(data)) {
      return { action: "unchanged", record: existing };
    }
    if (expectedVersion === undefined || expectedVersion !== existing.version) {
      throw new FeishuRepositoryError(
        "FEISHU_REPOSITORY_VERSION_CONFLICT",
        "记录版本已变化，拒绝覆盖更新",
      );
    }
    return this.update(existing, data);
  }

  private async create(data: Data): Promise<FeishuRepositoryWriteResult<Data>> {
    const timestamp = this.now().toISOString();
    const fields = this.encode({
      ...data,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(this.options.updatedBy === undefined
        ? {}
        : { updatedBy: this.options.updatedBy }),
    });
    const [created] = await this.client.batchCreateRecords(
      this.tableMapping.tableId,
      [fields],
    );
    if (!created?.recordId) this.malformed("飞书创建响应缺少 recordId");
    return {
      action: "created",
      record: {
        recordId: created.recordId,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: this.options.updatedBy,
        data,
      },
    };
  }

  private async update(
    existing: FeishuRepositoryRecord<Data>,
    data: Data,
  ): Promise<FeishuRepositoryWriteResult<Data>> {
    const timestamp = this.now().toISOString();
    const version = existing.version + 1;
    const fields = this.encode({
      ...data,
      version,
      createdAt: existing.createdAt,
      updatedAt: timestamp,
      ...(this.options.updatedBy === undefined
        ? {}
        : { updatedBy: this.options.updatedBy }),
    });
    const [updated] = await this.client.batchUpdateRecords(
      this.tableMapping.tableId,
      [{ recordId: existing.recordId, fields }],
    );
    if (!updated?.recordId) this.malformed("飞书更新响应缺少 recordId");
    return {
      action: "updated",
      record: {
        recordId: existing.recordId,
        version,
        createdAt: existing.createdAt,
        updatedAt: timestamp,
        updatedBy: this.options.updatedBy,
        data,
      },
    };
  }

  private encode(values: Readonly<Record<string, unknown>>): FeishuRecordFields {
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => {
        const fieldId = this.tableMapping.fieldIds[key];
        if (!fieldId) this.invalid(`未知字段键 ${key}`);
        return [fieldId, this.encodeFieldValue(key, value)];
      }),
    );
  }

  private encodeFieldValue(key: string, value: unknown): unknown {
    const fieldType = this.fieldTypeByKey.get(key);
    if (value === undefined || value === null) return value;
    if (fieldType === "dateTime") {
      if (typeof value !== "string") {
        this.invalid(`日期时间字段 ${key} 必须是 ISO 8601 字符串`);
      }
      const timestamp = Date.parse(value as string);
      if (!Number.isFinite(timestamp)) {
        this.invalid(`日期时间字段 ${key} 不是有效的 ISO 8601 时间`);
      }
      return timestamp;
    }
    if (fieldType === "date") {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        this.invalid(`日期字段 ${key} 必须是 YYYY-MM-DD 字符串`);
      }
      const timestamp = Date.parse(`${value}T00:00:00+08:00`);
      if (!Number.isFinite(timestamp)) {
        this.invalid(`日期字段 ${key} 不是有效的 Asia/Shanghai 业务日期`);
      }
      return timestamp;
    }
    return value;
  }

  private decode(record: FeishuRecord): FeishuRepositoryRecord<Data> {
    const values: Record<string, unknown> = {};
    for (const [fieldId, value] of Object.entries(record.fields)) {
      const fieldKey = this.fieldKeyById.get(fieldId);
      if (fieldKey) values[fieldKey] = this.decodeFieldValue(fieldKey, value);
    }

    const version = values.version;
    const createdAt = values.createdAt;
    const updatedAt = values.updatedAt;
    const businessId = values[this.definition.primaryFieldKey];
    if (
      typeof businessId !== "string" ||
      !Number.isInteger(version) ||
      typeof createdAt !== "string" ||
      typeof updatedAt !== "string"
    ) {
      this.malformed("飞书记录缺少业务 ID、版本或审计时间");
    }

    const data = Object.fromEntries(
      Object.entries(values).filter(([key]) => !auditKeys.has(key)),
    ) as Data;
    return {
      recordId: record.recordId,
      version: version as number,
      createdAt,
      updatedAt,
      updatedBy: values.updatedBy,
      data,
    };
  }

  private decodeFieldValue(key: string, value: unknown): unknown {
    const fieldType = this.fieldTypeByKey.get(key);
    if (value === undefined || value === null) return value;
    if (fieldType !== "date" && fieldType !== "dateTime") return value;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      this.malformed(`飞书日期字段 ${key} 不是毫秒时间戳`);
    }
    const date = new Date(value as number);
    if (Number.isNaN(date.getTime())) {
      this.malformed(`飞书日期字段 ${key} 不是有效时间`);
    }
    if (fieldType === "dateTime") return date.toISOString();
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  private assertKnownDataFields(data: Data): void {
    const allowed = new Set(
      this.definition.fields
        .map((field) => field.key)
        .filter((key) => !auditKeys.has(key)),
    );
    for (const key of Object.keys(data)) {
      if (!allowed.has(key)) this.invalid(`未知字段键 ${key}`);
    }
  }

  private invalid(message: string): never {
    throw new FeishuRepositoryError(
      "FEISHU_REPOSITORY_INVALID_RECORD",
      message,
    );
  }

  private malformed(message: string): never {
    throw new FeishuRepositoryError(
      "FEISHU_REPOSITORY_MALFORMED_RECORD",
      message,
    );
  }
}

export const createFeishuRepositories = (
  client: RepositoryClient,
  mapping: FeishuSchemaMapping,
  options: FeishuRepositoryOptions = {},
): Readonly<Record<FeishuTableKey, FeishuTableRepository>> =>
  Object.fromEntries(
    feishuTableDefinitions.map((table) => [
      table.key,
      new FeishuTableRepository(client, mapping, table.key, options),
    ]),
  ) as Readonly<Record<FeishuTableKey, FeishuTableRepository>>;
