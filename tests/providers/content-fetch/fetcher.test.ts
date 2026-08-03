import { describe, expect, it, vi } from "vitest";

import {
  SafeContentError,
  SafeContentFetcher,
  isBlockedNetworkAddress,
  type AddressResolver,
  type ContentTransport,
  type ContentTransportRequest,
  type ContentTransportResponse,
} from "../../../lib/providers/content-fetch";

type Outcome = ContentTransportResponse | ((request: ContentTransportRequest) => Promise<ContentTransportResponse>);

class FakeTransport implements ContentTransport {
  readonly requests: ContentTransportRequest[] = [];

  constructor(private readonly outcomes: Outcome[]) {}

  async request(request: ContentTransportRequest) {
    this.requests.push(request);
    const outcome = this.outcomes.shift();
    if (!outcome) throw new Error("missing fake response");
    return typeof outcome === "function" ? outcome(request) : outcome;
  }
}

const publicResolver: AddressResolver = vi.fn().mockResolvedValue([
  { address: "93.184.216.34", family: 4 },
]);

const response = (
  body: string,
  headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" },
  status = 200,
): ContentTransportResponse => ({
  status,
  headers,
  body: new TextEncoder().encode(body),
});

const expectCode = async (action: () => Promise<unknown>, code: SafeContentError["code"]) => {
  await expect(action()).rejects.toMatchObject({ name: "SafeContentError", code });
};

describe("safe content fetcher", () => {
  it("extracts safe Chinese and English HTML without scripts or navigation", async () => {
    const transport = new FakeTransport([
      response(`<!doctype html><title>机器人融资 News</title><nav>菜单</nav><article><h1>银河机器人完成融资</h1><p>Example Robotics raised Series A.</p></article><script>secret()</script>`),
    ]);
    const fetcher = new SafeContentFetcher({ resolver: publicResolver, transport });

    await expect(fetcher.fetch("https://example.com/news?id=1")).resolves.toMatchObject({
      finalUrl: "https://example.com/news?id=1",
      title: "机器人融资 News",
      text: "银河机器人完成融资\nExample Robotics raised Series A.",
      contentType: "html",
      redirects: 0,
    });
    expect(transport.requests[0]).toMatchObject({
      address: { address: "93.184.216.34", family: 4 },
    });
  });

  it.each([
    "http://127.0.0.1/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://localhost/internal",
  ])("blocks literal local, private, or metadata URL %s", async (url) => {
    const transport = new FakeTransport([]);
    const fetcher = new SafeContentFetcher({ resolver: publicResolver, transport });
    await expectCode(() => fetcher.fetch(url), "CONTENT_ADDRESS_BLOCKED");
    expect(transport.requests).toHaveLength(0);
  });

  it("blocks a hostname if any DNS answer is non-public", async () => {
    const resolver: AddressResolver = vi.fn().mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.4", family: 4 },
    ]);
    const transport = new FakeTransport([]);
    const fetcher = new SafeContentFetcher({ resolver, transport });
    await expectCode(() => fetcher.fetch("https://mixed.example/news"), "CONTENT_ADDRESS_BLOCKED");
    expect(transport.requests).toHaveLength(0);
  });

  it("revalidates every redirect target and blocks redirects to private networks", async () => {
    const transport = new FakeTransport([
      response("", { location: "http://10.0.0.8/private" }, 302),
    ]);
    const fetcher = new SafeContentFetcher({ resolver: publicResolver, transport });
    await expectCode(() => fetcher.fetch("https://example.com/start"), "CONTENT_ADDRESS_BLOCKED");
    expect(transport.requests).toHaveLength(1);
  });

  it("detects redirect loops without another network request", async () => {
    const transport = new FakeTransport([
      response("", { location: "/b" }, 302),
      response("", { location: "/a" }, 302),
    ]);
    const fetcher = new SafeContentFetcher({ resolver: publicResolver, transport });
    await expectCode(() => fetcher.fetch("https://example.com/a"), "CONTENT_REDIRECT_LIMIT");
    expect(transport.requests).toHaveLength(2);
  });

  it("aborts a timed-out transport and returns a stable safe error", async () => {
    const transport = new FakeTransport([
      (request) => new Promise((_resolve, reject) => {
        request.signal.addEventListener("abort", () => reject(new DOMException("private detail", "AbortError")));
      }),
    ]);
    const fetcher = new SafeContentFetcher({ resolver: publicResolver, transport, timeoutMs: 5 });
    await expectCode(() => fetcher.fetch("https://example.com/slow"), "CONTENT_TIMED_OUT");
  });

  it("bounds DNS resolution with the same timeout", async () => {
    const resolver: AddressResolver = vi.fn(
      () => new Promise<never>(() => undefined),
    );
    const transport = new FakeTransport([]);
    const fetcher = new SafeContentFetcher({ resolver, transport, timeoutMs: 5 });
    await expectCode(() => fetcher.fetch("https://slow-dns.example/news"), "CONTENT_TIMED_OUT");
    expect(transport.requests).toHaveLength(0);
  });

  it("rejects declared and actual oversized responses", async () => {
    const declared = new SafeContentFetcher({
      resolver: publicResolver,
      maxResponseBytes: 10,
      transport: new FakeTransport([response("small", { "content-type": "text/plain", "content-length": "11" })]),
    });
    await expectCode(() => declared.fetch("https://example.com/large"), "CONTENT_TOO_LARGE");

    const actual = new SafeContentFetcher({
      resolver: publicResolver,
      maxResponseBytes: 5,
      transport: new FakeTransport([response("123456", { "content-type": "text/plain" })]),
    });
    await expectCode(() => actual.fetch("https://example.com/large"), "CONTENT_TOO_LARGE");
  });

  it("rejects binary and compressed responses", async () => {
    const binary = new SafeContentFetcher({
      resolver: publicResolver,
      transport: new FakeTransport([response("pdf", { "content-type": "application/pdf" })]),
    });
    await expectCode(() => binary.fetch("https://example.com/file.pdf"), "CONTENT_TYPE_UNSUPPORTED");

    const compressed = new SafeContentFetcher({
      resolver: publicResolver,
      transport: new FakeTransport([response("gzip", { "content-type": "text/html", "content-encoding": "gzip" })]),
    });
    await expectCode(() => compressed.fetch("https://example.com/news"), "CONTENT_TYPE_UNSUPPORTED");
  });

  it("does not expose URLs or transport details in stable errors", async () => {
    const secret = "token-secret-sentinel";
    const transport: ContentTransport = { request: vi.fn().mockRejectedValue(new Error(secret)) };
    const fetcher = new SafeContentFetcher({ resolver: publicResolver, transport });
    let caught: unknown;
    try {
      await fetcher.fetch(`https://example.com/news?token=${secret}`);
    } catch (error) {
      caught = error;
    }
    expect(String(caught)).not.toContain(secret);
  });
});

describe("network address policy", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ])("blocks reserved address %s", (address) => {
    expect(isBlockedNetworkAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => expect(isBlockedNetworkAddress(address)).toBe(false),
  );
});
