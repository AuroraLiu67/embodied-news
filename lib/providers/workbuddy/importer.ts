import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import type {
  FeishuRepositoryWriteResult,
  FeishuTableRepository,
} from "../../feishu/repository";
import {
  workBuddyCandidateFileSchema,
  type WorkBuddyCandidateInput,
} from "./candidate-format";

export const maximumWorkBuddyFileBytes = 5 * 1024 * 1024;

export const workBuddyImportErrorCodes = [
  "WORKBUDDY_FILE_UNREADABLE",
  "WORKBUDDY_FILE_TOO_LARGE",
  "WORKBUDDY_JSON_INVALID",
  "WORKBUDDY_SCHEMA_INVALID",
] as const;

export type WorkBuddyImportErrorCode =
  (typeof workBuddyImportErrorCodes)[number];

export class WorkBuddyImportError extends Error {
  readonly name = "WorkBuddyImportError";

  constructor(
    readonly code: WorkBuddyImportErrorCode,
    message: string,
    readonly issuePaths: readonly string[] = [],
  ) {
    super(message);
  }
}

export interface ImportedResearchCandidate
  extends Readonly<Record<string, unknown>> {
  candidateId: string;
  title: string;
  sourceUrl: string;
  canonicalUrl: string;
  sourceType: WorkBuddyCandidateInput["sourceType"];
  sourceTier: WorkBuddyCandidateInput["sourceTier"];
  contentType: WorkBuddyCandidateInput["contentType"];
  regionScope: "CHINA";
  discoveredBy: "WORKBUDDY";
  publishedAt: string | null;
  discoveredAt: string;
  rawExcerpt: string;
  extractedFacts: string;
  reviewStatus: "PENDING";
}

type CandidateRepository = Pick<
  FeishuTableRepository<ImportedResearchCandidate>,
  "findByBusinessId" | "createOrUpdate"
>;

export interface WorkBuddyImportResult {
  total: number;
  created: number;
  duplicates: number;
}

const trackingParameterNames = new Set([
  "from",
  "ref",
  "source",
  "spm",
  "timestamp",
  "ts",
]);

export const canonicalizeCandidateUrl = (value: string): string => {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (
      trackingParameterNames.has(normalized) ||
      normalized.startsWith("utm_") ||
      normalized.startsWith("share_") ||
      normalized.startsWith("xsec_") ||
      normalized.startsWith("app_")
    ) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
};

export const createCandidateId = (canonicalUrl: string): string =>
  `candidate-wb-${createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 24)}`;

export const toImportedResearchCandidate = (
  input: WorkBuddyCandidateInput,
): ImportedResearchCandidate => {
  const canonicalUrl = canonicalizeCandidateUrl(input.sourceUrl);
  return {
    candidateId: createCandidateId(canonicalUrl),
    title: input.title,
    sourceUrl: input.sourceUrl,
    canonicalUrl,
    sourceType: input.sourceType,
    sourceTier: input.sourceTier,
    contentType: input.contentType,
    regionScope: "CHINA",
    discoveredBy: "WORKBUDDY",
    publishedAt: input.publishedAt,
    discoveredAt: input.discoveredAt,
    rawExcerpt: input.preliminarySummary ?? "",
    extractedFacts: JSON.stringify({
      workBuddy: {
        sourceName: input.sourceName,
        queries: input.queries,
      },
    }),
    reviewStatus: "PENDING",
  };
};

const readCandidateFile = async (filePath: string): Promise<unknown> => {
  let metadata;
  try {
    metadata = await stat(filePath);
  } catch {
    throw new WorkBuddyImportError(
      "WORKBUDDY_FILE_UNREADABLE",
      "无法读取 WorkBuddy 候选文件",
    );
  }
  if (!metadata.isFile()) {
    throw new WorkBuddyImportError(
      "WORKBUDDY_FILE_UNREADABLE",
      "WorkBuddy 候选路径不是普通文件",
    );
  }
  if (metadata.size > maximumWorkBuddyFileBytes) {
    throw new WorkBuddyImportError(
      "WORKBUDDY_FILE_TOO_LARGE",
      "WorkBuddy 候选文件超过 5 MiB",
    );
  }

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    throw new WorkBuddyImportError(
      "WORKBUDDY_FILE_UNREADABLE",
      "无法读取 WorkBuddy 候选文件",
    );
  }
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new WorkBuddyImportError(
      "WORKBUDDY_JSON_INVALID",
      "WorkBuddy 候选文件不是合法 JSON",
    );
  }
};

export const importWorkBuddyCandidateFile = async (
  filePath: string,
  repository: CandidateRepository,
): Promise<WorkBuddyImportResult> => {
  const parsed = workBuddyCandidateFileSchema.safeParse(
    await readCandidateFile(filePath),
  );
  if (!parsed.success) {
    const issuePaths = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
    ].slice(0, 20);
    throw new WorkBuddyImportError(
      "WORKBUDDY_SCHEMA_INVALID",
      "WorkBuddy 候选文件未通过 Schema 校验",
      issuePaths,
    );
  }

  let created = 0;
  let duplicates = 0;
  const seenIds = new Set<string>();
  for (const input of parsed.data.candidates) {
    const candidate = toImportedResearchCandidate(input);
    if (seenIds.has(candidate.candidateId)) {
      duplicates += 1;
      continue;
    }
    seenIds.add(candidate.candidateId);

    if (await repository.findByBusinessId(candidate.candidateId)) {
      duplicates += 1;
      continue;
    }
    const result: FeishuRepositoryWriteResult<ImportedResearchCandidate> =
      await repository.createOrUpdate(candidate);
    if (result.action === "created") created += 1;
    else duplicates += 1;
  }

  return {
    total: parsed.data.candidates.length,
    created,
    duplicates,
  };
};
