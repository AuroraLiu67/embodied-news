export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export interface ContentTransportRequest {
  url: URL;
  address: ResolvedAddress;
  signal: AbortSignal;
  maxResponseBytes: number;
}

export interface ContentTransportResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: Uint8Array;
}

export interface ContentTransport {
  request(request: ContentTransportRequest): Promise<ContentTransportResponse>;
}

export interface FetchedContent {
  requestedUrl: string;
  finalUrl: string;
  title: string | null;
  text: string;
  contentType: "html" | "text";
  byteLength: number;
  redirects: number;
}
