import { lookup } from "node:dns/promises";

import { SafeContentError } from "./errors";
import { extractHtmlContent, extractPlainText } from "./extract";
import { NativeContentTransport } from "./native-transport";
import { isBlockedNetworkAddress, parseSafePublicUrl } from "./network-policy";
import type {
  AddressResolver,
  ContentTransport,
  FetchedContent,
  ResolvedAddress,
} from "./types";

export interface SafeContentFetcherOptions {
  resolver?: AddressResolver;
  transport?: ContentTransport;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxExtractedCharacters?: number;
  maxRedirects?: number;
}

const defaultResolver: AddressResolver = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })) as ResolvedAddress[];

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export class SafeContentFetcher {
  private readonly resolver: AddressResolver;
  private readonly transport: ContentTransport;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly maxExtractedCharacters: number;
  private readonly maxRedirects: number;

  constructor(options: SafeContentFetcherOptions = {}) {
    this.resolver = options.resolver ?? defaultResolver;
    this.transport = options.transport ?? new NativeContentTransport();
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
    this.maxExtractedCharacters = options.maxExtractedCharacters ?? 20_000;
    this.maxRedirects = options.maxRedirects ?? 5;
  }

  async fetch(value: string): Promise<FetchedContent> {
    const requested = parseSafePublicUrl(value);
    let current = requested;
    const visited = new Set<string>();

    for (let redirects = 0; redirects <= this.maxRedirects; redirects += 1) {
      if (visited.has(current.href)) {
        throw new SafeContentError("CONTENT_REDIRECT_LIMIT", "内容重定向形成循环", false);
      }
      visited.add(current.href);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response;
      try {
        const timeout = new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(new DOMException("content fetch timed out", "AbortError")),
            { once: true },
          );
        });
        const addresses = await Promise.race([
          this.resolveSafe(current.hostname),
          timeout,
        ]);
        response = await this.transport.request({
          url: current,
          address: addresses[0],
          signal: controller.signal,
          maxResponseBytes: this.maxResponseBytes,
        });
      } catch (error) {
        if (error instanceof SafeContentError) throw error;
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          throw new SafeContentError("CONTENT_TIMED_OUT", "内容获取超时", true);
        }
        throw new SafeContentError("CONTENT_FETCH_FAILED", "内容获取失败", true);
      } finally {
        clearTimeout(timer);
      }

      if (redirectStatuses.has(response.status)) {
        if (redirects === this.maxRedirects) {
          throw new SafeContentError("CONTENT_REDIRECT_LIMIT", "内容重定向超过上限", false);
        }
        const location = response.headers.location;
        if (!location) {
          throw new SafeContentError("CONTENT_REDIRECT_INVALID", "内容重定向缺少目标", false);
        }
        try {
          current = parseSafePublicUrl(new URL(location, current).href);
        } catch (error) {
          if (error instanceof SafeContentError && error.code === "CONTENT_ADDRESS_BLOCKED") throw error;
          throw new SafeContentError("CONTENT_REDIRECT_INVALID", "内容重定向目标无效", false);
        }
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        throw new SafeContentError("CONTENT_HTTP_ERROR", "内容来源返回非成功状态", response.status >= 500);
      }
      if (response.body.byteLength > this.maxResponseBytes) {
        throw new SafeContentError("CONTENT_TOO_LARGE", "内容响应超过大小限制", false);
      }
      const declaredLength = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
        throw new SafeContentError("CONTENT_TOO_LARGE", "内容响应超过大小限制", false);
      }
      const encoding = response.headers["content-encoding"]?.toLowerCase();
      if (encoding && encoding !== "identity") {
        throw new SafeContentError("CONTENT_TYPE_UNSUPPORTED", "内容压缩格式不受支持", false);
      }
      const mediaType = response.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
      const html = mediaType === "text/html" || mediaType === "application/xhtml+xml";
      const plain = mediaType === "text/plain";
      if (!html && !plain) {
        throw new SafeContentError("CONTENT_TYPE_UNSUPPORTED", "内容类型不受支持", false);
      }
      const decoded = new TextDecoder("utf-8").decode(response.body);
      const extracted = html
        ? extractHtmlContent(decoded, this.maxExtractedCharacters)
        : { title: null, text: extractPlainText(decoded, this.maxExtractedCharacters) };
      return {
        requestedUrl: requested.href,
        finalUrl: current.href,
        title: extracted.title,
        text: extracted.text,
        contentType: html ? "html" : "text",
        byteLength: response.body.byteLength,
        redirects,
      };
    }
    throw new SafeContentError("CONTENT_REDIRECT_LIMIT", "内容重定向超过上限", false);
  }

  private async resolveSafe(hostname: string): Promise<ResolvedAddress[]> {
    let addresses: ResolvedAddress[];
    try {
      addresses = await this.resolver(hostname);
    } catch {
      throw new SafeContentError("CONTENT_DNS_FAILED", "内容地址解析失败", true);
    }
    if (addresses.length === 0) {
      throw new SafeContentError("CONTENT_DNS_FAILED", "内容地址解析失败", true);
    }
    if (addresses.some(({ address }) => isBlockedNetworkAddress(address))) {
      throw new SafeContentError("CONTENT_ADDRESS_BLOCKED", "内容地址不允许访问", false);
    }
    return addresses;
  }
}
