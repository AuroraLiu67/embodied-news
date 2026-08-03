import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  canonicalizeCandidateUrl,
  createCandidateId,
  importWorkBuddyCandidateFile,
  maximumWorkBuddyFileBytes,
  type ImportedResearchCandidate,
} from "../../../lib/providers/workbuddy";

const candidate = {
  title: "银河通用完成新一轮融资",
  sourceUrl:
    "https://mp.weixin.qq.com/s/article-id?utm_source=workbuddy&idx=1#wechat_redirect",
  sourceName: "银河通用机器人官方公众号",
  contentType: "FUNDING",
  sourceType: "COMPANY",
  sourceTier: "PRIMARY",
  publishedAt: "2026-08-01T01:30:00+08:00",
  queries: ["银河通用 融资"],
  preliminarySummary: "官方公众号宣布完成新一轮融资，金额未披露。",
  discoveredAt: "2026-08-01T08:15:00+08:00",
} as const;

class InMemoryCandidateRepository {
  readonly records = new Map<string, ImportedResearchCandidate>();
  readonly createOrUpdate = vi.fn(async (data: ImportedResearchCandidate) => {
    this.records.set(data.candidateId, data);
    return {
      action: "created" as const,
      record: {
        recordId: `rec-${this.records.size}`,
        version: 1,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        data,
      },
    };
  });

  async findByBusinessId(candidateId: string) {
    const data = this.records.get(candidateId);
    return data
      ? {
          recordId: "rec-existing",
          version: 1,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
          data,
        }
      : null;
  }
}

describe("WorkBuddy candidate importer", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "workbuddy-import-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const writeCandidateFile = async (value: unknown, name = "candidates.json") => {
    const path = join(directory, name);
    await writeFile(path, JSON.stringify(value), "utf8");
    return path;
  };

  it("creates a pending China WorkBuddy candidate from a legal file", async () => {
    const path = await writeCandidateFile({
      schemaVersion: "1",
      candidates: [candidate],
    });
    const repository = new InMemoryCandidateRepository();

    await expect(importWorkBuddyCandidateFile(path, repository)).resolves.toEqual({
      total: 1,
      created: 1,
      duplicates: 0,
    });
    expect([...repository.records.values()][0]).toMatchObject({
      title: candidate.title,
      sourceType: "COMPANY",
      sourceTier: "PRIMARY",
      contentType: "FUNDING",
      regionScope: "CHINA",
      discoveredBy: "WORKBUDDY",
      reviewStatus: "PENDING",
    });
    expect(
      JSON.parse([...repository.records.values()][0].extractedFacts),
    ).toEqual({
      workBuddy: {
        sourceName: candidate.sourceName,
        queries: candidate.queries,
      },
    });
  });

  it("canonicalizes tracking parameters and generates a stable candidate ID", () => {
    const first = canonicalizeCandidateUrl(candidate.sourceUrl);
    const second = canonicalizeCandidateUrl(
      "https://mp.weixin.qq.com/s/article-id?idx=1&utm_medium=share",
    );

    expect(first).toBe("https://mp.weixin.qq.com/s/article-id?idx=1");
    expect(second).toBe(first);
    expect(createCandidateId(first)).toBe(createCandidateId(second));
    expect(createCandidateId(first)).toMatch(/^candidate-wb-[a-f0-9]{24}$/);
  });

  it("does not write an existing candidate when the same file is imported twice", async () => {
    const path = await writeCandidateFile({
      schemaVersion: "1",
      candidates: [candidate],
    });
    const repository = new InMemoryCandidateRepository();

    await importWorkBuddyCandidateFile(path, repository);
    await expect(importWorkBuddyCandidateFile(path, repository)).resolves.toEqual({
      total: 1,
      created: 0,
      duplicates: 1,
    });
    expect(repository.createOrUpdate).toHaveBeenCalledTimes(1);
  });

  it("deduplicates canonical-equivalent URLs inside one file", async () => {
    const path = await writeCandidateFile({
      schemaVersion: "1",
      candidates: [
        candidate,
        {
          ...candidate,
          sourceUrl:
            "https://mp.weixin.qq.com/s/article-id?idx=1&utm_campaign=duplicate",
        },
      ],
    });
    const repository = new InMemoryCandidateRepository();

    await expect(importWorkBuddyCandidateFile(path, repository)).resolves.toEqual({
      total: 2,
      created: 1,
      duplicates: 1,
    });
    expect(repository.createOrUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects privileged fields before any repository write and records safe paths", async () => {
    const path = await writeCandidateFile({
      schemaVersion: "1",
      candidates: [{ ...candidate, publicationStatus: "PUBLISHED" }],
    });
    const repository = new InMemoryCandidateRepository();

    await expect(importWorkBuddyCandidateFile(path, repository)).rejects.toMatchObject({
      code: "WORKBUDDY_SCHEMA_INVALID",
      issuePaths: ["candidates.0"],
    });
    expect(repository.createOrUpdate).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and oversized files without repository writes", async () => {
    const invalidPath = join(directory, "invalid.json");
    await writeFile(invalidPath, "{not-json", "utf8");
    const oversizedPath = join(directory, "oversized.json");
    await writeFile(oversizedPath, "x".repeat(maximumWorkBuddyFileBytes + 1), "utf8");
    const repository = new InMemoryCandidateRepository();

    await expect(
      importWorkBuddyCandidateFile(invalidPath, repository),
    ).rejects.toMatchObject({ code: "WORKBUDDY_JSON_INVALID" });
    await expect(
      importWorkBuddyCandidateFile(oversizedPath, repository),
    ).rejects.toMatchObject({ code: "WORKBUDDY_FILE_TOO_LARGE" });
    expect(repository.createOrUpdate).not.toHaveBeenCalled();
  });
});
