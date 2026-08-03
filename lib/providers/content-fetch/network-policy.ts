import { isIP } from "node:net";

import { SafeContentError } from "./errors";

const parseIpv4 = (address: string): number[] | null => {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((part) => part >= 0 && part <= 255) ? octets : null;
};

const isBlockedIpv4 = (address: string): boolean => {
  const octets = parseIpv4(address);
  if (!octets) return true;
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

export const isBlockedNetworkAddress = (address: string): boolean => {
  const normalized = address.toLowerCase().split("%")[0];
  const family = isIP(normalized);
  if (family === 4) return isBlockedIpv4(normalized);
  if (family !== 6) return true;

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return isBlockedIpv4(
      `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
    );
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("100:") ||
    normalized.startsWith("2001:db8:")
  );
};

export const parseSafePublicUrl = (value: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafeContentError("CONTENT_URL_INVALID", "内容 URL 无效", false);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new SafeContentError("CONTENT_URL_INVALID", "内容 URL 不允许访问", false);
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new SafeContentError("CONTENT_ADDRESS_BLOCKED", "内容地址不允许访问", false);
  }
  if (isIP(hostname) && isBlockedNetworkAddress(hostname)) {
    throw new SafeContentError("CONTENT_ADDRESS_BLOCKED", "内容地址不允许访问", false);
  }
  return url;
};
