import { describe, expect, it } from "vitest";

import {
  errorResponseSchema,
  feishuRecordSchema,
  openAiResearchOutputSchema,
  publicSiteExportSchema,
  safePublicHttpUrlSchema,
  workBuddyCandidateInputSchema,
} from "../../lib/domain";
import {
  candidateFixture,
  publicCompanyFixture,
  publicDigestFixture,
  publicFundingEventFixture,
  publicTechnologyDevelopmentFixture,
} from "../fixtures/domain";

const omit = <ObjectType extends object, Key extends keyof ObjectType>(
  value: ObjectType,
  key: Key,
): Omit<ObjectType, Key> => {
  const copy = { ...value };
  delete copy[key];
  return copy;
};

const validWorkBuddyInput = {
  title: "银河通用完成新一轮融资",
  sourceUrl: "https://example.com/news/galbot-funding",
  sourceName: "公司官方公众号",
  contentType: "FUNDING",
  sourceType: "COMPANY",
  sourceTier: "PRIMARY",
  publishedAt: "2026-07-30T01:00:00.000Z",
  queries: ["银河通用 融资"],
  preliminarySummary: "公司宣布完成融资，金额未披露。",
  discoveredAt: "2026-07-30T02:00:00.000Z",
};

const validOpenAiOutput = {
  relevance: {
    decision: "RELEVANT",
    confidence: { level: "HIGH", score: 0.95, reasons: ["官方来源"] },
    reason: "属于具身智能融资事件。",
  },
  extractedFacts: {
    companyName: "Example Robotics",
    round: "Series A",
    amount: "25000000",
    currency: "USD",
    amountDisclosed: true,
    investors: ["Example Ventures"],
    announcedAt: "2026-07-30",
    region: "美国",
    technologyTags: ["具身智能"],
  },
  conflicts: [],
  sources: [
    {
      sourceUrl: "https://example.com/robotics-funding",
      sourceName: "Example Robotics",
      sourceType: "COMPANY",
      sourceTier: "PRIMARY",
      title: "Example Robotics raises Series A",
      publishedAt: "2026-07-30T01:00:00.000Z",
      supportsFacts: [
        "companyName",
        "round",
        "amount",
        "currency",
        "amountDisclosed",
        "investors",
        "announcedAt",
        "region",
        "technologyTags",
      ],
    },
  ],
  publicSummary: "Example Robotics 宣布完成 A 轮融资。",
  publicWhyItMatters: "融资将支持具身智能产品研发。",
};

const validFeishuRecord = {
  table: "研究候选",
  recordId: "rec_candidate_001",
  version: 1,
  updatedAt: "2026-07-30T02:00:00.000Z",
  fields: candidateFixture,
};

const validPublicExport = {
  generatedAt: "2026-07-30T03:00:00.000Z",
  events: [publicFundingEventFixture],
  developments: [publicTechnologyDevelopmentFixture],
  companies: [publicCompanyFixture],
  digests: [publicDigestFixture],
};

const validErrorResponse = {
  code: "SCHEMA_INVALID",
  message: "输入未通过校验。",
  retryable: false,
  requestId: "request-001",
};

describe("WorkBuddy input schema", () => {
  it("accepts a legal input", () => {
    expect(workBuddyCandidateInputSchema.parse(validWorkBuddyInput)).toEqual(
      validWorkBuddyInput,
    );
  });

  it("rejects a missing required field", () => {
    expect(
      workBuddyCandidateInputSchema.safeParse(omit(validWorkBuddyInput, "sourceUrl"))
        .success,
    ).toBe(false);
  });

  it("rejects an invalid field type", () => {
    expect(
      workBuddyCandidateInputSchema.safeParse({
        ...validWorkBuddyInput,
        queries: "not-an-array",
      }).success,
    ).toBe(false);
  });

  it("rejects oversized text and unknown fields", () => {
    expect(
      workBuddyCandidateInputSchema.safeParse({
        ...validWorkBuddyInput,
        title: "x".repeat(501),
        publicationStatus: "PUBLISHED",
      }).success,
    ).toBe(false);
  });
});

describe("OpenAI output schema", () => {
  it("accepts a legal structured output", () => {
    expect(openAiResearchOutputSchema.safeParse(validOpenAiOutput).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    expect(
      openAiResearchOutputSchema.safeParse(
        omit(validOpenAiOutput, "publicSummary"),
      ).success,
    ).toBe(false);
  });

  it("rejects an invalid amount type", () => {
    expect(
      openAiResearchOutputSchema.safeParse({
        ...validOpenAiOutput,
        extractedFacts: { ...validOpenAiOutput.extractedFacts, amount: 25000000 },
      }).success,
    ).toBe(false);
  });

  it("accepts structured conflicts and rejects conflicts with insufficient evidence", () => {
    const conflict = {
      field: "amount",
      values: [
        { value: "25000000", sourceUrl: "https://example.org/source-a" },
        { value: "30000000", sourceUrl: "https://example.org/source-b" },
      ],
    };
    expect(
      openAiResearchOutputSchema.safeParse({
        ...validOpenAiOutput,
        conflicts: [conflict],
      }).success,
    ).toBe(true);
    expect(
      openAiResearchOutputSchema.safeParse({
        ...validOpenAiOutput,
        conflicts: [{ ...conflict, values: conflict.values.slice(0, 1) }],
      }).success,
    ).toBe(false);
  });

  it("rejects oversized output and unknown fields", () => {
    expect(
      openAiResearchOutputSchema.safeParse({
        ...validOpenAiOutput,
        publicSummary: "x".repeat(2001),
        internalNotes: "forbidden",
      }).success,
    ).toBe(false);
  });
});

describe("Feishu record schema", () => {
  it("accepts a legal typed record", () => {
    expect(feishuRecordSchema.safeParse(validFeishuRecord).success).toBe(true);
  });

  it("rejects a missing envelope field", () => {
    expect(
      feishuRecordSchema.safeParse(omit(validFeishuRecord, "recordId")).success,
    ).toBe(false);
  });

  it("rejects an invalid version type", () => {
    expect(
      feishuRecordSchema.safeParse({ ...validFeishuRecord, version: "1" }).success,
    ).toBe(false);
  });

  it("rejects oversized nested text and unknown fields", () => {
    expect(
      feishuRecordSchema.safeParse({
        ...validFeishuRecord,
        fields: { ...candidateFixture, title: "x".repeat(501) },
        tenantAccessToken: "forbidden",
      }).success,
    ).toBe(false);
  });
});

describe("public export schema", () => {
  it("accepts a legal public export", () => {
    expect(publicSiteExportSchema.safeParse(validPublicExport).success).toBe(true);
  });

  it("rejects a missing generated timestamp", () => {
    expect(
      publicSiteExportSchema.safeParse(omit(validPublicExport, "generatedAt")).success,
    ).toBe(false);
  });

  it("rejects an invalid collection type", () => {
    expect(
      publicSiteExportSchema.safeParse({ ...validPublicExport, events: {} }).success,
    ).toBe(false);
  });

  it("rejects internal and unknown fields", () => {
    expect(
      publicSiteExportSchema.safeParse({
        ...validPublicExport,
        events: [{ ...publicFundingEventFixture, reviewStatus: "APPROVED" }],
      }).success,
    ).toBe(false);
  });
});

describe("error response schema", () => {
  it("accepts a legal stable error", () => {
    expect(errorResponseSchema.safeParse(validErrorResponse).success).toBe(true);
  });

  it("rejects a missing error code", () => {
    expect(
      errorResponseSchema.safeParse(omit(validErrorResponse, "code")).success,
    ).toBe(false);
  });

  it("rejects an invalid retryable type", () => {
    expect(
      errorResponseSchema.safeParse({
        ...validErrorResponse,
        retryable: "false",
      }).success,
    ).toBe(false);
  });

  it("rejects oversized messages and unknown details", () => {
    expect(
      errorResponseSchema.safeParse({
        ...validErrorResponse,
        message: "x".repeat(501),
        stack: "forbidden",
      }).success,
    ).toBe(false);
  });
});

describe("safe public URL schema", () => {
  it.each([
    "http://127.0.0.1/private",
    "http://10.0.0.1/private",
    "http://169.254.169.254/latest/meta-data",
    "http://user:password@example.com/private",
    "file:///etc/passwd",
  ])("rejects dangerous URL %s", (url) => {
    expect(safePublicHttpUrlSchema.safeParse(url).success).toBe(false);
  });

  it("accepts a normal public HTTPS URL", () => {
    expect(
      safePublicHttpUrlSchema.safeParse("https://example.com/news?id=1").success,
    ).toBe(true);
  });
});
