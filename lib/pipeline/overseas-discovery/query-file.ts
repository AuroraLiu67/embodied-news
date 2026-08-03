import { readFile, stat } from "node:fs/promises";

import { z } from "zod";

import { OverseasDiscoveryError } from "./errors";
import type { OverseasDiscoveryQueryFile } from "./types";

export const maximumOverseasQueryFileBytes = 1024 * 1024;

const queryFileSchema = z
  .object({
    schemaVersion: z.literal("1"),
    queries: z
      .array(
        z
          .object({
            queryId: z
              .string()
              .trim()
              .min(1)
              .max(100)
              .regex(/^[A-Za-z0-9._:-]+$/),
            query: z.string().trim().min(1).max(5000),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const [index, item] of value.queries.entries()) {
      if (ids.has(item.queryId)) {
        context.addIssue({
          code: "custom",
          path: ["queries", index, "queryId"],
          message: "queryId 不得重复",
        });
      }
      ids.add(item.queryId);
    }
  });

export const parseOverseasDiscoveryQueryFile = (
  value: unknown,
): OverseasDiscoveryQueryFile => {
  const parsed = queryFileSchema.safeParse(value);
  if (!parsed.success) {
    const issuePaths = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
    ].slice(0, 20);
    throw new OverseasDiscoveryError(
      "OVERSEAS_DISCOVERY_QUERY_FILE_INVALID",
      "海外发现查询文件未通过 Schema 校验",
      issuePaths,
    );
  }
  return parsed.data;
};

export const loadOverseasDiscoveryQueryFile = async (
  filePath: string,
): Promise<OverseasDiscoveryQueryFile> => {
  let metadata;
  try {
    metadata = await stat(filePath);
  } catch {
    throw new OverseasDiscoveryError(
      "OVERSEAS_DISCOVERY_QUERY_FILE_UNREADABLE",
      "无法读取海外发现查询文件",
    );
  }
  if (!metadata.isFile()) {
    throw new OverseasDiscoveryError(
      "OVERSEAS_DISCOVERY_QUERY_FILE_UNREADABLE",
      "海外发现查询路径不是普通文件",
    );
  }
  if (metadata.size > maximumOverseasQueryFileBytes) {
    throw new OverseasDiscoveryError(
      "OVERSEAS_DISCOVERY_QUERY_FILE_TOO_LARGE",
      "海外发现查询文件超过 1 MiB",
    );
  }

  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    throw new OverseasDiscoveryError(
      "OVERSEAS_DISCOVERY_QUERY_FILE_UNREADABLE",
      "无法读取海外发现查询文件",
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new OverseasDiscoveryError(
      "OVERSEAS_DISCOVERY_QUERY_FILE_INVALID",
      "海外发现查询文件不是合法 JSON",
    );
  }
  return parseOverseasDiscoveryQueryFile(value);
};
