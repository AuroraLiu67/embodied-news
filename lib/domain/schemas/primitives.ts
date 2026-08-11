import { z } from "zod";

const ipv4Octets = (hostname: string) => {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return null;
  }
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
};

const isBlockedHostname = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    /^fe[89ab]/.test(host)
  ) {
    return true;
  }

  const octets = ipv4Octets(host);
  if (!octets) return false;

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
};

export const boundedText = (maximum: number) =>
  z.string().trim().min(1).max(maximum);

export const optionalBoundedText = (maximum: number) =>
  z.string().trim().max(maximum);

export const stableIdSchema = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9._:-]+$/);

export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const decimalStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,99})(\.\d{1,18})?$/, "金额必须是非负十进制字符串");

export const safePublicHttpUrlSchema = z.string().max(2048).superRefine((value, context) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    context.addIssue({ code: "custom", message: "URL 格式无效" });
    return;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    context.addIssue({ code: "custom", message: "只允许 HTTP 或 HTTPS URL" });
  }
  if (parsed.username || parsed.password) {
    context.addIssue({ code: "custom", message: "URL 不得包含凭据" });
  }
  if (isBlockedHostname(parsed.hostname)) {
    context.addIssue({ code: "custom", message: "URL 不得指向本机、私网或保留地址" });
  }
});
