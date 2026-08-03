import {
  FeishuClientError,
  mapFeishuApiError,
  mapFeishuThrownError,
} from "./client-error";
import type {
  FeishuApiResponse,
  FeishuApiTransport,
  FeishuBatchRecordsData,
  FeishuClientLogEvent,
  FeishuRecord,
  FeishuFieldMetadata,
  FeishuRecordFields,
  FeishuRecordUpdate,
  FeishuRetryPolicy,
  FeishuTableMetadata,
} from "./client-types";
import { FeishuSdkTransport } from "./sdk-transport";

const maximumPageSize = 500;
const maximumBatchSize = 500;

const defaultRetryPolicy: FeishuRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 1_000,
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const chunks = <Item>(items: readonly Item[], size: number): Item[][] => {
  const result: Item[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

export interface FeishuClientOptions {
  appToken: string;
  transport: FeishuApiTransport;
  retryPolicy?: Partial<FeishuRetryPolicy>;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: (event: FeishuClientLogEvent) => void;
}

export interface CreateLiveFeishuClientOptions {
  appId: string;
  appSecret: string;
  appToken: string;
  retryPolicy?: Partial<FeishuRetryPolicy>;
  logger?: (event: FeishuClientLogEvent) => void;
}

export class FeishuClient {
  private readonly retryPolicy: FeishuRetryPolicy;
  private readonly wait: (milliseconds: number) => Promise<void>;

  constructor(private readonly options: FeishuClientOptions) {
    if (!options.appToken) {
      throw new FeishuClientError(
        "FEISHU_INVALID_REQUEST",
        "缺少固定的飞书 Base Token",
        false,
      );
    }
    this.retryPolicy = { ...defaultRetryPolicy, ...options.retryPolicy };
    if (this.retryPolicy.maxAttempts < 1) {
      throw new FeishuClientError(
        "FEISHU_INVALID_REQUEST",
        "重试次数必须至少为 1",
        false,
      );
    }
    this.wait = options.sleep ?? sleep;
  }

  async listTables(): Promise<FeishuTableMetadata[]> {
    return this.readAllPages("list_tables", (pageToken) =>
      this.options.transport.listTables({
        appToken: this.options.appToken,
        pageSize: 100,
        pageToken,
      }),
    );
  }

  async listFields(tableId: string): Promise<FeishuFieldMetadata[]> {
    this.assertTableId(tableId);
    const fields = await this.readAllPages("list_fields", (pageToken) =>
      this.options.transport.listFields({
        appToken: this.options.appToken,
        tableId,
        pageSize: 100,
        pageToken,
      }),
    );
    return fields.map((field, index) => ({
      ...field,
      isPrimary: index === 0,
    }));
  }

  async listAllRecords(
    tableId: string,
    pageSize = maximumPageSize,
  ): Promise<FeishuRecord[]> {
    this.assertTableId(tableId);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maximumPageSize) {
      throw new FeishuClientError(
        "FEISHU_INVALID_REQUEST",
        `分页大小必须在 1-${maximumPageSize} 之间`,
        false,
      );
    }

    const records: FeishuRecord[] = [];
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();
    do {
      const response = await this.execute("list", () =>
        this.options.transport.listRecords({
          appToken: this.options.appToken,
          tableId,
          pageSize,
          pageToken,
        }),
      );
      records.push(...(response.data?.items ?? []));

      if (!response.data?.hasMore) break;
      const nextToken = response.data.pageToken;
      if (!nextToken || seenTokens.has(nextToken)) {
        throw new FeishuClientError(
          "FEISHU_MALFORMED_RESPONSE",
          "飞书分页响应缺少有效的下一页标记",
          false,
        );
      }
      seenTokens.add(nextToken);
      pageToken = nextToken;
    } while (true);

    return records;
  }

  async batchCreateRecords(
    tableId: string,
    records: readonly FeishuRecordFields[],
  ): Promise<FeishuRecord[]> {
    this.assertTableId(tableId);
    const created: FeishuRecord[] = [];
    for (const batch of chunks(records, maximumBatchSize)) {
      const response = await this.execute("batch_create", () =>
        this.options.transport.batchCreateRecords({
          appToken: this.options.appToken,
          tableId,
          records: batch,
        }),
      );
      created.push(...this.requireBatchRecords(response));
    }
    return created;
  }

  async batchUpdateRecords(
    tableId: string,
    records: readonly FeishuRecordUpdate[],
  ): Promise<FeishuRecord[]> {
    this.assertTableId(tableId);
    const updated: FeishuRecord[] = [];
    for (const record of records) {
      if (!record.recordId) {
        throw new FeishuClientError(
          "FEISHU_INVALID_REQUEST",
          "批量更新记录缺少 recordId",
          false,
        );
      }
    }
    for (const batch of chunks(records, maximumBatchSize)) {
      const response = await this.execute("batch_update", () =>
        this.options.transport.batchUpdateRecords({
          appToken: this.options.appToken,
          tableId,
          records: batch,
        }),
      );
      updated.push(...this.requireBatchRecords(response));
    }
    return updated;
  }

  private async execute<Data>(
    operation: FeishuClientLogEvent["operation"],
    request: () => Promise<FeishuApiResponse<Data>>,
  ): Promise<FeishuApiResponse<Data>> {
    for (let attempt = 1; attempt <= this.retryPolicy.maxAttempts; attempt += 1) {
      try {
        const response = await request();
        if (response.code === undefined) {
          throw new FeishuClientError(
            "FEISHU_MALFORMED_RESPONSE",
            "飞书响应缺少状态码",
            false,
          );
        }
        if (response.code === 0) return response;
        throw mapFeishuApiError(response.code, response.msg);
      } catch (error) {
        const mapped = mapFeishuThrownError(error);
        const willRetry =
          mapped.retryable && attempt < this.retryPolicy.maxAttempts;
        this.options.logger?.({
          operation,
          outcome: willRetry ? "retry" : "failed",
          attempt,
          errorCode: mapped.code,
        });
        if (!willRetry) throw mapped;

        const delay = Math.min(
          this.retryPolicy.baseDelayMs * 2 ** (attempt - 1),
          this.retryPolicy.maxDelayMs,
        );
        await this.wait(delay);
      }
    }

    throw new FeishuClientError(
      "FEISHU_API_ERROR",
      "飞书请求未产生结果",
      false,
    );
  }

  private async readAllPages<Item>(
    operation: "list_tables" | "list_fields",
    request: (pageToken?: string) => Promise<
      FeishuApiResponse<{
        hasMore?: boolean;
        pageToken?: string;
        items?: readonly Item[];
      }>
    >,
  ): Promise<Item[]> {
    const items: Item[] = [];
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();
    do {
      const response = await this.execute(operation, () => request(pageToken));
      items.push(...(response.data?.items ?? []));
      if (!response.data?.hasMore) break;
      const nextToken = response.data.pageToken;
      if (!nextToken || seenTokens.has(nextToken)) {
        throw new FeishuClientError(
          "FEISHU_MALFORMED_RESPONSE",
          "飞书分页响应缺少有效的下一页标记",
          false,
        );
      }
      seenTokens.add(nextToken);
      pageToken = nextToken;
    } while (true);
    return items;
  }

  private requireBatchRecords(
    response: FeishuApiResponse<FeishuBatchRecordsData>,
  ): readonly FeishuRecord[] {
    if (!response.data || !Array.isArray(response.data.records)) {
      throw new FeishuClientError(
        "FEISHU_MALFORMED_RESPONSE",
        "飞书批量响应缺少记录列表",
        false,
      );
    }
    return response.data.records;
  }

  private assertTableId(tableId: string): void {
    if (!tableId) {
      throw new FeishuClientError(
        "FEISHU_INVALID_REQUEST",
        "缺少飞书数据表 ID",
        false,
      );
    }
  }
}

export const createLiveFeishuClient = (
  options: CreateLiveFeishuClientOptions,
): FeishuClient =>
  new FeishuClient({
    appToken: options.appToken,
    transport: new FeishuSdkTransport(options.appId, options.appSecret),
    retryPolicy: options.retryPolicy,
    logger: options.logger,
  });
