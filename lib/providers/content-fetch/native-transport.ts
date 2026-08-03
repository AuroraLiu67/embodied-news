import http from "node:http";
import https from "node:https";

import { SafeContentError } from "./errors";
import type { ContentTransport, ContentTransportRequest } from "./types";

export class NativeContentTransport implements ContentTransport {
  request(input: ContentTransportRequest) {
    return new Promise<Awaited<ReturnType<ContentTransport["request"]>>>((resolve, reject) => {
      const client = input.url.protocol === "https:" ? https : http;
      const request = client.request(
        {
          protocol: input.url.protocol,
          hostname: input.address.address,
          family: input.address.family,
          port: input.url.port || undefined,
          path: `${input.url.pathname}${input.url.search}`,
          method: "GET",
          servername: input.url.hostname,
          headers: {
            Host: input.url.host,
            Accept: "text/html, application/xhtml+xml, text/plain;q=0.9",
            "Accept-Encoding": "identity",
            "User-Agent": "EmbodiedIntelligenceRadar/0.1 (+safe-content-fetch)",
          },
          signal: input.signal,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > input.maxResponseBytes) {
              response.destroy(
                new SafeContentError("CONTENT_TOO_LARGE", "内容响应超过大小限制", false),
              );
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () => {
            const headers: Record<string, string | undefined> = {};
            for (const [name, value] of Object.entries(response.headers)) {
              headers[name] = Array.isArray(value) ? value.join(", ") : value;
            }
            resolve({
              status: response.statusCode ?? 0,
              headers,
              body: Buffer.concat(chunks),
            });
          });
          response.on("error", reject);
        },
      );
      request.on("error", reject);
      request.end();
    });
  }
}
