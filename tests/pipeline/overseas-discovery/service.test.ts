import { describe, expect, it, vi } from "vitest";

import { openAiResearchOutputSchema } from "../../../lib/domain";
import {
  buildOverseasResearchQuery,
  createOpenAICandidateId,
  OverseasDiscoveryService,
  type OpenAIDiscoveredCandidate,
  type OverseasDiscoveryQueryFile,
} from "../../../lib/pipeline/overseas-discovery";
import type { OpenAIResearchProvider } from "../../../lib/providers/openai";
import { canonicalizeCandidateUrl } from "../../../lib/providers/workbuddy";
import { openAiOutputFixture } from "../../fixtures/providers";

const queryFile: OverseasDiscoveryQueryFile = {
  schemaVersion: "1",
  queries: [{ queryId: "broad-funding", query: "robotics funding announcements" }],
};

const datedOutput = (overrides: Record<string, unknown> = {}) =>
  openAiResearchOutputSchema.parse({
    ...openAiOutputFixture,
    extractedFacts: {
      ...openAiOutputFixture.extractedFacts,
      announcedAt: "2026-08-02",
    },
    sources: [
      {
        ...openAiOutputFixture.sources[0],
        sourceUrl: "https://example.org/news/pilot-series-a?utm_source=search",
        publishedAt: "2026-08-01T17:30:00.000Z",
      },
    ],
    ...overrides,
  });

class InMemoryCandidateRepository {
  readonly records = new Map<string, OpenAIDiscoveredCandidate>();

  async list() {
    return [...this.records.values()].map((data, index) => ({
      recordId: `rec-${index + 1}`,
      version: 1,
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      data,
    }));
  }

  async createOrUpdate(data: OpenAIDiscoveredCandidate) {
    this.records.set(data.candidateId, data);
    return {
      action: "created" as const,
      record: {
        recordId: `rec-${this.records.size}`,
        version: 1,
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
        data,
      },
    };
  }
}

const provider = (outcomes: Array<ReturnType<typeof datedOutput> | Error>) => {
  const research = vi.fn(async (query: string) => {
    void query;
    const outcome = outcomes.shift();
    if (!outcome) throw new Error("missing outcome");
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  return { research } satisfies OpenAIResearchProvider;
};

const service = (
  researchProvider: OpenAIResearchProvider,
  repository = new InMemoryCandidateRepository(),
) => ({
  repository,
  instance: new OverseasDiscoveryService({
    provider: researchProvider,
    repository,
    model: "configured-pilot-model",
    now: () => new Date("2026-08-03T01:00:00.000Z"),
  }),
});

describe("D05.1 overseas discovery", () => {
  it("creates a pending overseas OpenAI candidate from an exact Shanghai date", async () => {
    const researchProvider = provider([datedOutput()]);
    const { instance, repository } = service(researchProvider);

    await expect(instance.discover("2026-08-02", queryFile)).resolves.toEqual({
      totalQueries: 1,
      created: 1,
      duplicates: 0,
      rejected: 0,
      failed: 0,
    });
    expect(researchProvider.research).toHaveBeenCalledOnce();
    expect(vi.mocked(researchProvider.research).mock.calls[0][0]).toContain(
      "2026-08-02",
    );
    const candidate = [...repository.records.values()][0];
    expect(candidate).toMatchObject({
      contentType: "FUNDING",
      regionScope: "OVERSEAS",
      discoveredBy: "OPENAI",
      publishedAt: "2026-08-01T17:30:00.000Z",
      relevanceDecision: "RELEVANT",
      reviewStatus: "PENDING",
    });
    expect(candidate.canonicalUrl).toBe(
      "https://example.org/news/pilot-series-a",
    );
    expect(candidate.candidateId).toBe(
      createOpenAICandidateId(candidate.canonicalUrl),
    );
    expect(JSON.parse(candidate.extractedFacts)).toMatchObject({
      openAI: {
        queryId: "broad-funding",
        model: "configured-pilot-model",
      },
    });
  });

  it("rejects results without an eligible source on the requested date", async () => {
    const wrongDate = datedOutput({
      sources: [
        {
          ...openAiOutputFixture.sources[0],
          publishedAt: "2026-08-02T17:30:00.000Z",
        },
      ],
    });
    const leadOnly = datedOutput({
      sources: [
        {
          ...openAiOutputFixture.sources[0],
          sourceTier: "LEAD",
          sourceType: "SEARCH_SNIPPET",
          publishedAt: "2026-08-01T17:30:00.000Z",
        },
      ],
    });
    const { instance, repository } = service(
      provider([wrongDate, leadOnly]),
    );

    await expect(
      instance.discover("2026-08-02", {
        schemaVersion: "1",
        queries: [
          { queryId: "wrong-date", query: "first" },
          { queryId: "lead-only", query: "second" },
        ],
      }),
    ).resolves.toEqual({
      totalQueries: 2,
      created: 0,
      duplicates: 0,
      rejected: 2,
      failed: 0,
    });
    expect(repository.records.size).toBe(0);
  });

  it("does not write model results marked not relevant", async () => {
    const output = datedOutput({
      relevance: {
        ...openAiOutputFixture.relevance,
        decision: "NOT_RELEVANT",
      },
    });
    const { instance, repository } = service(provider([output]));

    await expect(instance.discover("2026-08-02", queryFile)).resolves.toMatchObject({
      created: 0,
      rejected: 1,
    });
    expect(repository.records.size).toBe(0);
  });

  it("deduplicates the same canonical URL across reruns without overwriting", async () => {
    const output = datedOutput();
    const researchProvider = provider([output, output]);
    const { instance, repository } = service(researchProvider);

    await instance.discover("2026-08-02", queryFile);
    await expect(instance.discover("2026-08-02", queryFile)).resolves.toMatchObject({
      created: 0,
      duplicates: 1,
    });
    expect(repository.records.size).toBe(1);
    expect([...repository.records.values()][0].canonicalUrl).toBe(
      canonicalizeCandidateUrl(output.sources[0].sourceUrl),
    );
  });

  it("continues after a provider failure and reports only safe counts", async () => {
    const researchProvider = provider([
      new Error("secret provider response"),
      datedOutput(),
    ]);
    const { instance, repository } = service(researchProvider);

    await expect(
      instance.discover("2026-08-02", {
        schemaVersion: "1",
        queries: [
          { queryId: "failure", query: "first" },
          { queryId: "success", query: "second" },
        ],
      }),
    ).resolves.toEqual({
      totalQueries: 2,
      created: 1,
      duplicates: 0,
      rejected: 0,
      failed: 1,
    });
    expect(repository.records.size).toBe(1);
  });

  it("fails honestly when every provider query fails", async () => {
    const researchProvider = provider([
      new Error("secret first failure"),
      new Error("secret second failure"),
    ]);
    const { instance, repository } = service(researchProvider);

    await expect(
      instance.discover("2026-08-02", {
        schemaVersion: "1",
        queries: [
          { queryId: "first", query: "first" },
          { queryId: "second", query: "second" },
        ],
      }),
    ).rejects.toMatchObject({
      code: "OVERSEAS_DISCOVERY_PROVIDER_UNAVAILABLE",
    });
    expect(repository.records.size).toBe(0);
  });

  it("rejects an invalid business date before any provider call", async () => {
    const researchProvider = provider([datedOutput()]);
    const { instance } = service(researchProvider);

    await expect(instance.discover("2026-8-2", queryFile)).rejects.toMatchObject({
      code: "OVERSEAS_DISCOVERY_INPUT_INVALID",
    });
    expect(researchProvider.research).not.toHaveBeenCalled();
  });
});

describe("D05.1 query construction", () => {
  it("binds the configured date, timezone and caller query", () => {
    const value = buildOverseasResearchQuery(
      "2026-08-02",
      "Sunday Robotics financing",
    );

    expect(value).toContain("2026-08-02");
    expect(value).toContain("Asia/Shanghai");
    expect(value).toContain("Sunday Robotics financing");
    expect(value).toContain("不得使用其他日期内容填充");
  });
});
