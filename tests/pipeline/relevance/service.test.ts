import { describe, expect, it, vi } from "vitest";

import type { ResearchCandidate } from "../../../lib/domain";
import {
  CandidateRelevanceService,
  OpenAIRelevanceClassifier,
  RelevanceError,
  type RelevanceClassifier,
} from "../../../lib/pipeline/relevance";
import type { FetchedContent } from "../../../lib/providers/content-fetch";
import { openAiOutputFixture } from "../../fixtures/providers";
import { candidateFixture } from "../../fixtures/domain";

const content = (text: string): FetchedContent => ({
  requestedUrl: candidateFixture.sourceUrl,
  finalUrl: candidateFixture.sourceUrl,
  title: candidateFixture.title,
  text,
  contentType: "html",
  byteLength: new TextEncoder().encode(text).byteLength,
  redirects: 0,
});

const classifier = (
  output: unknown,
  model = "configured-relevance-model",
): RelevanceClassifier => ({
  model,
  classify: vi.fn().mockResolvedValue(output),
});

const highConfidence = {
  level: "HIGH",
  score: 0.94,
  reasons: ["正文明确描述机器人或 Physical AI 业务"],
} as const;

const expectErrorCode = async (
  action: () => Promise<unknown>,
  code: RelevanceError["code"],
) => {
  await expect(action()).rejects.toMatchObject({ name: "RelevanceError", code });
};

describe("candidate relevance service", () => {
  it("keeps an explicitly embodied-AI candidate pending for human review", async () => {
    const engine = classifier({
      decision: "RELEVANT",
      confidence: highConfidence,
      reason: "正文明确介绍具身基础模型和通用机器人产品。",
    });
    const service = new CandidateRelevanceService(engine);

    const result = await service.assess({
      candidate: { ...candidateFixture, relevance: null } satisfies ResearchCandidate,
      content: content("公司发布具身基础模型，并用于通用机器人在真实环境执行任务。"),
    });

    expect(result.relevance).toMatchObject({
      decision: "RELEVANT",
      model: "configured-relevance-model",
      reason: "正文明确介绍具身基础模型和通用机器人产品。",
    });
    expect(result.reviewStatus).toBe("PENDING");
  });

  it("marks a clearly unrelated candidate but leaves rejection to human review", async () => {
    const service = new CandidateRelevanceService(classifier({
      decision: "NOT_RELEVANT",
      confidence: highConfidence,
      reason: "内容仅涉及在线办公软件，与实体机器人或 Physical AI 无关。",
    }));

    const result = await service.assess({
      candidate: { ...candidateFixture, relevance: null },
      content: content("该公司发布在线表格协作软件，没有机器人、硬件或实体交互业务。"),
    });

    expect(result.relevance?.decision).toBe("NOT_RELEVANT");
    expect(result.reviewStatus).toBe("PENDING");
  });

  it("retains an ambiguous edge candidate for research instead of discarding it", async () => {
    const service = new CandidateRelevanceService(classifier({
      decision: "RELEVANT",
      confidence: {
        level: "LOW",
        score: 0.42,
        reasons: ["只提到 AI 硬件，尚未证明用于实体机器人"],
      },
      reason: "可能属于 Physical AI 基础设施，但证据不足。",
    }));

    const result = await service.assess({
      candidate: { ...candidateFixture, relevance: null },
      content: content("公司推出面向边缘设备的新型 AI 芯片，应用场景尚未披露。"),
    });

    expect(result.relevance).toMatchObject({
      decision: "UNCERTAIN",
      confidence: { level: "LOW", score: 0.42 },
      model: "configured-relevance-model",
    });
    expect(result.reviewStatus).toBe("NEEDS_RESEARCH");
    expect(result).not.toHaveProperty("publicationStatus");
  });

  it("does not overwrite an existing duplicate review state", async () => {
    const service = new CandidateRelevanceService(classifier({
      decision: "RELEVANT",
      confidence: highConfidence,
      reason: "明确相关。",
    }));
    const result = await service.assess({
      candidate: { ...candidateFixture, reviewStatus: "DUPLICATE" },
      content: content("人形机器人公司完成融资。"),
    });
    expect(result.reviewStatus).toBe("DUPLICATE");
  });

  it("validates classifier output and hides raw provider failures", async () => {
    const invalid = new CandidateRelevanceService(classifier({
      decision: "MAYBE",
      confidence: highConfidence,
      reason: "invalid",
      publicationStatus: "PUBLISHED",
    }));
    await expectErrorCode(
      () => invalid.assess({ candidate: candidateFixture, content: content("test") }),
      "RELEVANCE_OUTPUT_INVALID",
    );

    const secret = "provider-secret-detail";
    const failing: RelevanceClassifier = {
      model: "configured-model",
      classify: vi.fn().mockRejectedValue(new Error(secret)),
    };
    let caught: unknown;
    try {
      await new CandidateRelevanceService(failing).assess({
        candidate: candidateFixture,
        content: content("test"),
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "RELEVANCE_CLASSIFIER_FAILED" });
    expect(String(caught)).not.toContain(secret);
  });

  it("limits content passed to the classifier", async () => {
    const engine = classifier({
      decision: "UNCERTAIN",
      confidence: { level: "MEDIUM", score: 0.6, reasons: [] },
      reason: "信息有限。",
    });
    const service = new CandidateRelevanceService(engine, { maxContentCharacters: 10 });
    await service.assess({ candidate: candidateFixture, content: content("x".repeat(100)) });
    expect(engine.classify).toHaveBeenCalledWith(expect.objectContaining({ content: "x".repeat(10) }));
  });
});

describe("OpenAI relevance classifier", () => {
  it("passes the PRD scope, exclusions, source and cleaned content to OpenAI", async () => {
    const research = vi.fn().mockResolvedValue(openAiOutputFixture);
    const adapter = new OpenAIRelevanceClassifier({ research }, "configured-model");
    await expect(adapter.classify({
      title: "机器人公司动态",
      sourceName: "Example",
      sourceUrl: "https://example.com/news",
      content: "cleaned content",
    })).resolves.toEqual(openAiOutputFixture.relevance);

    const prompt = research.mock.calls[0][0] as string;
    expect(prompt).toContain("人形、通用、工业、物流、服务或特种机器人");
    expect(prompt).toContain("纯消费电子、传统自动化");
    expect(prompt).toContain("证据不足");
    expect(prompt).toContain("cleaned content");
  });
});
