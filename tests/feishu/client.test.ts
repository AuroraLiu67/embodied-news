import { describe, expect, it, vi } from "vitest";

import {
  FeishuClient,
  FeishuClientError,
  type FeishuApiResponse,
  type FeishuApiTransport,
  type FeishuBatchCreateRequest,
  type FeishuBatchRecordsData,
  type FeishuBatchUpdateRequest,
  type FeishuListRecordsData,
  type FeishuListRecordsRequest,
  type FeishuListFieldsData,
  type FeishuListTablesData,
} from "../../lib/feishu";

class FakeFeishuTransport implements FeishuApiTransport {
  readonly listRequests: FeishuListRecordsRequest[] = [];
  readonly createRequests: FeishuBatchCreateRequest[] = [];
  readonly updateRequests: FeishuBatchUpdateRequest[] = [];
  readonly tableRequests: Array<{ pageToken?: string }> = [];
  readonly fieldRequests: Array<{ tableId: string; pageToken?: string }> = [];

  listResponses: Array<
    FeishuApiResponse<FeishuListRecordsData> | Error
  > = [];
  createResponses: Array<
    FeishuApiResponse<FeishuBatchRecordsData> | Error
  > = [];
  updateResponses: Array<
    FeishuApiResponse<FeishuBatchRecordsData> | Error
  > = [];
  tableResponses: Array<FeishuApiResponse<FeishuListTablesData> | Error> = [];
  fieldResponses: Array<FeishuApiResponse<FeishuListFieldsData> | Error> = [];

  async listTables(request: {
    appToken: string;
    pageSize: number;
    pageToken?: string;
  }) {
    this.tableRequests.push({ pageToken: request.pageToken });
    return this.next(this.tableResponses);
  }

  async listFields(request: {
    appToken: string;
    tableId: string;
    pageSize: number;
    pageToken?: string;
  }) {
    this.fieldRequests.push({
      tableId: request.tableId,
      pageToken: request.pageToken,
    });
    return this.next(this.fieldResponses);
  }

  async listRecords(request: FeishuListRecordsRequest) {
    this.listRequests.push(request);
    return this.next(this.listResponses);
  }

  async batchCreateRecords(request: FeishuBatchCreateRequest) {
    this.createRequests.push(request);
    return this.next(this.createResponses);
  }

  async batchUpdateRecords(request: FeishuBatchUpdateRequest) {
    this.updateRequests.push(request);
    return this.next(this.updateResponses);
  }

  private next<Data>(
    responses: Array<FeishuApiResponse<Data> | Error>,
  ): Promise<FeishuApiResponse<Data>> {
    const response = responses.shift();
    if (!response) throw new Error("Fake transport response queue is empty");
    if (response instanceof Error) throw response;
    return Promise.resolve(response);
  }
}

const appToken = "base-formal-only";
const tableId = "tbl-automation";

const record = (recordId: string) => ({
  recordId,
  fields: { name: recordId },
});

const expectClientError = async (
  action: () => Promise<unknown>,
  code: FeishuClientError["code"],
) => {
  await expect(action()).rejects.toMatchObject({ name: "FeishuClientError", code });
};

describe("FeishuClient", () => {
  it("paginates table and field metadata with the configured Base Token", async () => {
    const transport = new FakeFeishuTransport();
    transport.tableResponses = [
      {
        code: 0,
        data: {
          hasMore: true,
          pageToken: "tables-2",
          items: [{ tableId: "tbl-1", name: "表一" }],
        },
      },
      {
        code: 0,
        data: {
          hasMore: false,
          items: [{ tableId: "tbl-2", name: "表二" }],
        },
      },
    ];
    transport.fieldResponses = [
      {
        code: 0,
        data: {
          hasMore: false,
          items: [
            {
              fieldId: "fld-1",
              name: "字段一",
              uiType: "Text",
              isPrimary: true,
            },
          ],
        },
      },
    ];
    const client = new FeishuClient({ appToken, transport });

    await expect(client.listTables()).resolves.toHaveLength(2);
    await expect(client.listFields("tbl-1")).resolves.toHaveLength(1);
    expect(transport.tableRequests).toEqual([
      { pageToken: undefined },
      { pageToken: "tables-2" },
    ]);
    expect(transport.fieldRequests).toEqual([
      { tableId: "tbl-1", pageToken: undefined },
    ]);
  });

  it("normalizes the first field as primary when provider flags are inconsistent", async () => {
    const transport = new FakeFeishuTransport();
    transport.fieldResponses = [
      {
        code: 0,
        data: {
          hasMore: false,
          items: [
            { fieldId: "fld-primary", name: "业务 ID", uiType: "Text", isPrimary: false },
            { fieldId: "fld-other", name: "普通字段", uiType: "Text", isPrimary: true },
          ],
        },
      },
    ];
    const client = new FeishuClient({ appToken, transport });

    await expect(client.listFields("tbl-1")).resolves.toMatchObject([
      { fieldId: "fld-primary", isPrimary: true },
      { fieldId: "fld-other", isPrimary: false },
    ]);
  });

  it("reads every page using only the configured Base Token", async () => {
    const transport = new FakeFeishuTransport();
    transport.listResponses = [
      {
        code: 0,
        data: {
          hasMore: true,
          pageToken: "page-2",
          items: [record("rec-1")],
        },
      },
      {
        code: 0,
        data: { hasMore: false, items: [record("rec-2")] },
      },
    ];
    const client = new FeishuClient({ appToken, transport });

    await expect(client.listAllRecords(tableId, 100)).resolves.toEqual([
      record("rec-1"),
      record("rec-2"),
    ]);
    expect(transport.listRequests).toEqual([
      { appToken, tableId, pageSize: 100, pageToken: undefined },
      { appToken, tableId, pageSize: 100, pageToken: "page-2" },
    ]);
  });

  it("rejects malformed pagination instead of looping forever", async () => {
    const transport = new FakeFeishuTransport();
    transport.listResponses = [
      { code: 0, data: { hasMore: true, items: [] } },
    ];
    const client = new FeishuClient({ appToken, transport });

    await expectClientError(
      () => client.listAllRecords(tableId),
      "FEISHU_MALFORMED_RESPONSE",
    );
  });

  it("chunks batch create and update operations at 500 records", async () => {
    const transport = new FakeFeishuTransport();
    const inputs = Array.from({ length: 501 }, (_, index) => ({
      ordinal: index,
    }));
    transport.createResponses = [
      {
        code: 0,
        data: {
          records: Array.from({ length: 500 }, (_, index) =>
            record(`created-${index}`),
          ),
        },
      },
      { code: 0, data: { records: [record("created-500")] } },
    ];
    transport.updateResponses = [
      {
        code: 0,
        data: {
          records: Array.from({ length: 500 }, (_, index) =>
            record(`updated-${index}`),
          ),
        },
      },
      { code: 0, data: { records: [record("updated-500")] } },
    ];
    const client = new FeishuClient({ appToken, transport });

    await expect(client.batchCreateRecords(tableId, inputs)).resolves.toHaveLength(
      501,
    );
    await expect(
      client.batchUpdateRecords(
        tableId,
        inputs.map((fields, index) => ({
          recordId: `record-${index}`,
          fields,
        })),
      ),
    ).resolves.toHaveLength(501);

    expect(transport.createRequests.map((request) => request.records.length)).toEqual([
      500, 1,
    ]);
    expect(transport.updateRequests.map((request) => request.records.length)).toEqual([
      500, 1,
    ]);
    expect(
      [...transport.createRequests, ...transport.updateRequests].every(
        (request) => request.appToken === appToken,
      ),
    ).toBe(true);
  });

  it("retries rate limits and transient network failures with bounded backoff", async () => {
    const transport = new FakeFeishuTransport();
    transport.listResponses = [
      { code: 1254290, msg: "Too many requests" },
      Object.assign(new Error("socket reset"), { response: { status: 503 } }),
      { code: 0, data: { hasMore: false, items: [record("rec-ok")] } },
    ];
    const wait = vi.fn(async () => undefined);
    const logger = vi.fn();
    const client = new FeishuClient({
      appToken,
      transport,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 15 },
      sleep: wait,
      logger,
    });

    await expect(client.listAllRecords(tableId)).resolves.toEqual([
      record("rec-ok"),
    ]);
    expect(wait.mock.calls).toEqual([[10], [15]]);
    expect(logger.mock.calls.map(([event]) => event)).toEqual([
      {
        operation: "list",
        outcome: "retry",
        attempt: 1,
        errorCode: "FEISHU_RATE_LIMITED",
      },
      {
        operation: "list",
        outcome: "retry",
        attempt: 2,
        errorCode: "FEISHU_NETWORK_ERROR",
      },
    ]);
  });

  it("does not retry permission errors and maps them to a stable code", async () => {
    const transport = new FakeFeishuTransport();
    transport.listResponses = [{ code: 99991672, msg: "Permission denied" }];
    const wait = vi.fn(async () => undefined);
    const client = new FeishuClient({ appToken, transport, sleep: wait });

    await expectClientError(
      () => client.listAllRecords(tableId),
      "FEISHU_PERMISSION_DENIED",
    );
    expect(transport.listRequests).toHaveLength(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("bounds timeout retries and returns a stable network error", async () => {
    const transport = new FakeFeishuTransport();
    transport.listResponses = [
      new Error("request timeout"),
      new Error("request timeout"),
    ];
    const wait = vi.fn(async () => undefined);
    const client = new FeishuClient({
      appToken,
      transport,
      retryPolicy: { maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 5 },
      sleep: wait,
    });

    await expectClientError(
      () => client.listAllRecords(tableId),
      "FEISHU_NETWORK_ERROR",
    );
    expect(transport.listRequests).toHaveLength(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });

  it("does not expose credentials or access tokens in errors and logs", async () => {
    const secret = "feishu-app-secret-sentinel";
    const accessToken = "tenant-access-token-sentinel";
    const transport = new FakeFeishuTransport();
    transport.listResponses = [
      {
        code: 99991663,
        msg: `invalid app secret ${secret} and token ${accessToken}`,
      },
    ];
    const events: unknown[] = [];
    const client = new FeishuClient({
      appToken,
      transport,
      logger: (event) => events.push(event),
    });

    const error = await client.listAllRecords(tableId).catch((caught) => caught);
    const serialized = JSON.stringify({ error, events });
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(accessToken);
    expect(error).toMatchObject({ code: "FEISHU_AUTH_FAILED" });
  });

  it("validates table IDs, page sizes, and update record IDs before transport calls", async () => {
    const transport = new FakeFeishuTransport();
    const client = new FeishuClient({ appToken, transport });

    await expectClientError(
      () => client.listAllRecords("", 100),
      "FEISHU_INVALID_REQUEST",
    );
    await expectClientError(
      () => client.listAllRecords(tableId, 501),
      "FEISHU_INVALID_REQUEST",
    );
    await expectClientError(
      () => client.batchUpdateRecords(tableId, [{ recordId: "", fields: {} }]),
      "FEISHU_INVALID_REQUEST",
    );
    expect(transport.listRequests).toHaveLength(0);
    expect(transport.updateRequests).toHaveLength(0);
  });
});
