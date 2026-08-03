export type FeishuRecordFields = Readonly<Record<string, unknown>>;

export interface FeishuRecord {
  recordId: string;
  fields: FeishuRecordFields;
}

export interface FeishuTableMetadata {
  tableId: string;
  name: string;
}

export interface FeishuFieldMetadata {
  fieldId: string;
  name: string;
  uiType: string;
  isPrimary: boolean;
  relationTableId?: string;
  multiple?: boolean;
}

export type FeishuRecordUpdate = FeishuRecord;

export interface FeishuListRecordsRequest {
  appToken: string;
  tableId: string;
  pageSize: number;
  pageToken?: string;
}

export interface FeishuBatchCreateRequest {
  appToken: string;
  tableId: string;
  records: readonly FeishuRecordFields[];
}

export interface FeishuBatchUpdateRequest {
  appToken: string;
  tableId: string;
  records: readonly FeishuRecordUpdate[];
}

export interface FeishuApiResponse<Data> {
  code?: number;
  msg?: string;
  data?: Data;
}

export interface FeishuListRecordsData {
  hasMore?: boolean;
  pageToken?: string;
  items?: readonly FeishuRecord[];
}

export interface FeishuBatchRecordsData {
  records?: readonly FeishuRecord[];
}

export interface FeishuListTablesData {
  hasMore?: boolean;
  pageToken?: string;
  items?: readonly FeishuTableMetadata[];
}

export interface FeishuListFieldsData {
  hasMore?: boolean;
  pageToken?: string;
  items?: readonly FeishuFieldMetadata[];
}

export interface FeishuApiTransport {
  listTables(request: {
    appToken: string;
    pageSize: number;
    pageToken?: string;
  }): Promise<FeishuApiResponse<FeishuListTablesData>>;
  listFields(request: {
    appToken: string;
    tableId: string;
    pageSize: number;
    pageToken?: string;
  }): Promise<FeishuApiResponse<FeishuListFieldsData>>;
  listRecords(
    request: FeishuListRecordsRequest,
  ): Promise<FeishuApiResponse<FeishuListRecordsData>>;
  batchCreateRecords(
    request: FeishuBatchCreateRequest,
  ): Promise<FeishuApiResponse<FeishuBatchRecordsData>>;
  batchUpdateRecords(
    request: FeishuBatchUpdateRequest,
  ): Promise<FeishuApiResponse<FeishuBatchRecordsData>>;
}

export interface FeishuRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface FeishuClientLogEvent {
  operation:
    | "list_tables"
    | "list_fields"
    | "list"
    | "batch_create"
    | "batch_update";
  outcome: "retry" | "failed";
  attempt: number;
  errorCode: string;
}
