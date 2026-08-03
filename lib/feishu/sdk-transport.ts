import * as lark from "@larksuiteoapi/node-sdk";

import type {
  FeishuApiTransport,
  FeishuBatchRecordsData,
  FeishuRecord,
} from "./client-types";

const normalizeRecords = (
  records:
    | readonly {
        record_id?: string;
        fields: Record<string, unknown>;
      }[]
    | undefined,
): FeishuRecord[] =>
  (records ?? []).flatMap((record) =>
    record.record_id
      ? [{ recordId: record.record_id, fields: record.fields }]
      : [],
  );

export class FeishuSdkTransport implements FeishuApiTransport {
  private readonly client: lark.Client;

  constructor(appId: string, appSecret: string) {
    this.client = new lark.Client({
      appId,
      appSecret,
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.error,
    });
  }

  async listTables(request: Parameters<FeishuApiTransport["listTables"]>[0]) {
    const response = await this.client.bitable.appTable.list({
      path: { app_token: request.appToken },
      params: {
        page_size: request.pageSize,
        page_token: request.pageToken,
      },
    });
    return {
      code: response.code,
      msg: response.msg,
      data: response.data
        ? {
            hasMore: response.data.has_more,
            pageToken: response.data.page_token,
            items: (response.data.items ?? []).flatMap((table) =>
              table.table_id && table.name
                ? [{ tableId: table.table_id, name: table.name }]
                : [],
            ),
          }
        : undefined,
    };
  }

  async listFields(request: Parameters<FeishuApiTransport["listFields"]>[0]) {
    const response = await this.client.bitable.appTableField.list({
      path: {
        app_token: request.appToken,
        table_id: request.tableId,
      },
      params: {
        page_size: request.pageSize,
        page_token: request.pageToken,
      },
    });
    return {
      code: response.code,
      msg: response.msg,
      data: response.data
        ? {
            hasMore: response.data.has_more,
            pageToken: response.data.page_token,
            items: (response.data.items ?? []).flatMap((field) =>
              field.field_id
                ? [
                    {
                      fieldId: field.field_id,
                      name: field.field_name,
                      uiType: field.ui_type ?? `TYPE_${field.type}`,
                      isPrimary: field.is_primary ?? false,
                      relationTableId: field.property?.table_id,
                      multiple: field.property?.multiple,
                    },
                  ]
                : [],
            ),
          }
        : undefined,
    };
  }

  async listRecords(request: Parameters<FeishuApiTransport["listRecords"]>[0]) {
    const response = await this.client.bitable.appTableRecord.list({
      path: {
        app_token: request.appToken,
        table_id: request.tableId,
      },
      params: {
        page_size: request.pageSize,
        page_token: request.pageToken,
      },
    });
    return {
      code: response.code,
      msg: response.msg,
      data: response.data
        ? {
            hasMore: response.data.has_more,
            pageToken: response.data.page_token,
            items: normalizeRecords(response.data.items),
          }
        : undefined,
    };
  }

  async batchCreateRecords(
    request: Parameters<FeishuApiTransport["batchCreateRecords"]>[0],
  ) {
    const response = await this.client.bitable.appTableRecord.batchCreate({
      path: {
        app_token: request.appToken,
        table_id: request.tableId,
      },
      data: {
        records: request.records.map((fields) => ({ fields })) as never,
      },
    });
    return this.normalizeBatchResponse(response);
  }

  async batchUpdateRecords(
    request: Parameters<FeishuApiTransport["batchUpdateRecords"]>[0],
  ) {
    const response = await this.client.bitable.appTableRecord.batchUpdate({
      path: {
        app_token: request.appToken,
        table_id: request.tableId,
      },
      data: {
        records: request.records.map((record) => ({
          record_id: record.recordId,
          fields: record.fields,
        })) as never,
      },
    });
    return this.normalizeBatchResponse(response);
  }

  private normalizeBatchResponse(response: {
    code?: number;
    msg?: string;
    data?: { records?: { record_id?: string; fields: Record<string, unknown> }[] };
  }): {
    code?: number;
    msg?: string;
    data?: FeishuBatchRecordsData;
  } {
    return {
      code: response.code,
      msg: response.msg,
      data: response.data
        ? { records: normalizeRecords(response.data.records) }
        : undefined,
    };
  }
}
