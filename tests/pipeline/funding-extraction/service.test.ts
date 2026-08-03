import { describe, expect, it, vi } from "vitest";

import {
  FundingExtractionError,
  FundingExtractionService,
  type FundingResearchProvider,
} from "../../../lib/pipeline/funding-extraction";
import type { FetchedContent } from "../../../lib/providers/content-fetch";
import { candidateFixture } from "../../fixtures/domain";
import { openAiOutputFixture } from "../../fixtures/providers";

const fetchedContent = (text = "Example Robotics announced its financing."): FetchedContent => ({
  requestedUrl: candidateFixture.sourceUrl,
  finalUrl: candidateFixture.sourceUrl,
  title: candidateFixture.title,
  text,
  contentType: "html",
  byteLength: new TextEncoder().encode(text).byteLength,
  redirects: 0,
});

const provider = (output: unknown): FundingResearchProvider => ({
  research: vi.fn().mockResolvedValue(output),
});

const createService = (researchProvider: FundingResearchProvider) =>
  new FundingExtractionService(researchProvider, {
    model: "configured-extraction-model",
    now: () => new Date("2026-08-01T01:00:00.000Z"),
  });

const expectCode = async (
  action: () => Promise<unknown>,
  code: FundingExtractionError["code"],
) => {
  await expect(action()).rejects.toMatchObject({
    name: "FundingExtractionError",
    code,
  });
};

describe("funding extraction service", () => {
  it("extracts disclosed funding fields and associates every fact with sources", async () => {
    const result = await createService(provider(openAiOutputFixture)).extract({
      candidate: candidateFixture,
      content: fetchedContent(),
    });

    expect(result.facts).toEqual(openAiOutputFixture.extractedFacts);
    expect(result.candidate.extractedFacts).toEqual(openAiOutputFixture.extractedFacts);
    expect(result.model).toBe("configured-extraction-model");
    expect(result.evidence).toEqual([
      expect.objectContaining({
        sourceUrl: openAiOutputFixture.sources[0].sourceUrl,
        accessedAt: "2026-08-01T01:00:00.000Z",
        supportsFacts: openAiOutputFixture.sources[0].supportsFacts,
      }),
    ]);
  });

  it("preserves undisclosed amount as false with null amount and currency", async () => {
    const output = {
      ...openAiOutputFixture,
      extractedFacts: {
        ...openAiOutputFixture.extractedFacts,
        round: null,
        amount: null,
        currency: null,
        amountDisclosed: false,
        investors: [],
      },
      sources: [{
        ...openAiOutputFixture.sources[0],
        supportsFacts: ["companyName", "amountDisclosed", "announcedAt"],
      }],
    };
    const result = await createService(provider(output)).extract({
      candidate: candidateFixture,
      content: fetchedContent("The company announced financing; terms were not disclosed."),
    });
    expect(result.facts).toMatchObject({
      amountDisclosed: false,
      amount: null,
      currency: null,
      investors: [],
    });
  });

  it("supports another currency and multiple named investors", async () => {
    const output = {
      ...openAiOutputFixture,
      extractedFacts: {
        ...openAiOutputFixture.extractedFacts,
        amount: "18000000",
        currency: "EUR",
        investors: ["Alpha Capital", "Beta Ventures"],
      },
    };
    const result = await createService(provider(output)).extract({
      candidate: candidateFixture,
      content: fetchedContent("The company raised EUR 18 million from Alpha Capital and Beta Ventures."),
    });
    expect(result.facts).toMatchObject({
      amount: "18000000",
      currency: "EUR",
      investors: ["Alpha Capital", "Beta Ventures"],
    });
  });

  it("does not invent a precise date from vague date language", async () => {
    const output = {
      ...openAiOutputFixture,
      extractedFacts: {
        ...openAiOutputFixture.extractedFacts,
        announcedAt: null,
      },
      sources: [{
        ...openAiOutputFixture.sources[0],
        supportsFacts: openAiOutputFixture.sources[0].supportsFacts.filter(
          (field) => field !== "announcedAt",
        ),
      }],
    };
    const result = await createService(provider(output)).extract({
      candidate: candidateFixture,
      content: fetchedContent("The company recently completed the round."),
    });
    expect(result.facts.announcedAt).toBeNull();
  });

  it("clears facts that have no source-level evidence instead of trusting model text", async () => {
    const output = {
      ...openAiOutputFixture,
      sources: [{
        ...openAiOutputFixture.sources[0],
        supportsFacts: ["companyName", "amountDisclosed"],
      }],
    };
    const result = await createService(provider(output)).extract({
      candidate: candidateFixture,
      content: fetchedContent(),
    });
    expect(result.facts).toEqual({
      companyName: "Example Robotics",
      round: null,
      amount: null,
      currency: null,
      amountDisclosed: false,
      investors: [],
      announcedAt: null,
      region: null,
      technologyTags: [],
    });
  });

  it("rejects conflicts whose values are not supported by their cited source", async () => {
    const output = {
      ...openAiOutputFixture,
      conflicts: [{
        field: "round",
        values: [
          { value: "Series A", sourceUrl: openAiOutputFixture.sources[0].sourceUrl },
          { value: "Series B", sourceUrl: "https://example.net/unknown" },
        ],
      }],
    };
    await expectCode(
      () => createService(provider(output)).extract({
        candidate: candidateFixture,
        content: fetchedContent(),
      }),
      "FUNDING_EXTRACTION_OUTPUT_INVALID",
    );
  });

  it("requires a relevant candidate and hides provider failure details", async () => {
    await expectCode(
      () => createService(provider(openAiOutputFixture)).extract({
        candidate: {
          ...candidateFixture,
          relevance: { ...candidateFixture.relevance, decision: "UNCERTAIN" },
        },
        content: fetchedContent(),
      }),
      "FUNDING_EXTRACTION_INPUT_INVALID",
    );

    const secret = "secret-provider-response";
    const failing: FundingResearchProvider = {
      research: vi.fn().mockRejectedValue(new Error(secret)),
    };
    let caught: unknown;
    try {
      await createService(failing).extract({
        candidate: candidateFixture,
        content: fetchedContent(),
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "FUNDING_EXTRACTION_PROVIDER_FAILED" });
    expect(String(caught)).not.toContain(secret);
  });

  it("passes anti-hallucination rules and bounded cleaned content to the provider", async () => {
    const researchProvider = provider(openAiOutputFixture);
    const service = new FundingExtractionService(researchProvider, {
      model: "configured-model",
      maxContentCharacters: 12,
    });
    await service.extract({
      candidate: candidateFixture,
      content: fetchedContent("x".repeat(100)),
    });
    const prompt = vi.mocked(researchProvider.research).mock.calls[0][0];
    expect(prompt).toContain("不得估算金额");
    expect(prompt).toContain("模糊表述");
    expect(prompt).toContain(`已安全清洗正文：${"x".repeat(12)}`);
    expect(prompt).not.toContain("x".repeat(13));
  });
});
