import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  feishuRecordSchema,
  fundingEventSchema,
  openAiResearchOutputSchema,
  researchCandidateSchema,
  workBuddyCandidateInputSchema,
} from "../../lib/domain";
import {
  candidateScenarioFixtures,
  fundingEventScenarioFixtures,
} from "../fixtures/scenarios";
import {
  MockFeishuProvider,
  MockNotificationProvider,
  MockOpenAiProvider,
  MockWorkBuddyProvider,
} from ".";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scenario fixtures", () => {
  it("all candidates pass their runtime schema", () => {
    for (const fixture of candidateScenarioFixtures) {
      expect(researchCandidateSchema.safeParse(fixture).success).toBe(true);
    }
  });

  it("all funding events pass their runtime schema", () => {
    for (const fixture of fundingEventScenarioFixtures) {
      expect(fundingEventSchema.safeParse(fixture).success).toBe(true);
    }
  });
});

describe("provider mock scenarios", () => {
  it("returns valid success results", async () => {
    const openAi = await new MockOpenAiProvider("success").research();
    const workBuddy = await new MockWorkBuddyProvider("success").discover();
    const feishu = await new MockFeishuProvider("success").listRecords();
    const notification = await new MockNotificationProvider("success").sendText(
      "测试通知",
    );

    expect(openAiResearchOutputSchema.safeParse(openAi).success).toBe(true);
    expect(z.array(workBuddyCandidateInputSchema).safeParse(workBuddy).success).toBe(
      true,
    );
    expect(z.array(feishuRecordSchema).safeParse(feishu).success).toBe(true);
    expect(notification).toEqual({ messageId: "message-001", delivered: true });
  });

  it("returns explicit empty results", async () => {
    expect(await new MockOpenAiProvider("empty").research()).toBeNull();
    expect(await new MockWorkBuddyProvider("empty").discover()).toEqual([]);
    expect(await new MockFeishuProvider("empty").listRecords()).toEqual([]);
    expect(
      await new MockNotificationProvider("empty").sendText("测试通知"),
    ).toEqual({ messageId: null, delivered: false });
  });

  it.each([
    ["rate_limit", "RATE_LIMITED"],
    ["timeout", "TIMED_OUT"],
  ] as const)("throws stable %s errors", async (scenario, code) => {
    const operations = [
      () => new MockOpenAiProvider(scenario).research(),
      () => new MockWorkBuddyProvider(scenario).discover(),
      () => new MockFeishuProvider(scenario).listRecords(),
      () => new MockNotificationProvider(scenario).sendText("测试通知"),
    ];

    for (const operation of operations) {
      await expect(operation()).rejects.toMatchObject({ code });
    }
  });

  it("returns deliberately invalid outputs for schema failure tests", async () => {
    expect(
      openAiResearchOutputSchema.safeParse(
        await new MockOpenAiProvider("invalid_output").research(),
      ).success,
    ).toBe(false);
    expect(
      z
        .array(workBuddyCandidateInputSchema)
        .safeParse(await new MockWorkBuddyProvider("invalid_output").discover())
        .success,
    ).toBe(false);
    expect(
      z
        .array(feishuRecordSchema)
        .safeParse(await new MockFeishuProvider("invalid_output").listRecords())
        .success,
    ).toBe(false);
    expect(
      await new MockNotificationProvider("invalid_output").sendText("测试通知"),
    ).toBe("invalid-notification-response");
  });

  it("never performs an external network request", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("Network access is forbidden in mock tests");
    });
    vi.stubGlobal("fetch", fetchSpy);

    await new MockOpenAiProvider().research();
    await new MockWorkBuddyProvider().discover();
    await new MockFeishuProvider().listRecords();
    await new MockNotificationProvider().sendText("离线测试");

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
