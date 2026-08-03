import { describe, expect, it } from "vitest";

import {
  maximumWorkBuddyCandidatesPerFile,
  workBuddyCandidateFileSchema,
} from "../../../lib/providers/workbuddy";

const weChatCandidate = {
  title: "银河通用完成新一轮融资",
  sourceUrl: "https://mp.weixin.qq.com/s/public-article-id",
  sourceName: "银河通用机器人官方公众号",
  contentType: "FUNDING",
  sourceType: "COMPANY",
  sourceTier: "PRIMARY",
  publishedAt: "2026-08-01T01:30:00+08:00",
  queries: ["银河通用 融资", "具身智能 融资"],
  preliminarySummary: "官方公众号宣布完成新一轮融资，金额未披露。",
  discoveredAt: "2026-08-01T08:15:00+08:00",
};

const candidateFile = (candidate: unknown = weChatCandidate) => ({
  schemaVersion: "1",
  candidates: [candidate],
});

describe("WorkBuddy candidate file format", () => {
  it("accepts a legal domestic WeChat candidate", () => {
    expect(workBuddyCandidateFileSchema.parse(candidateFile())).toEqual(
      candidateFile(),
    );
  });

  it("rejects a candidate without a source URL", () => {
    const withoutUrl: Partial<typeof weChatCandidate> = { ...weChatCandidate };
    delete withoutUrl.sourceUrl;
    expect(workBuddyCandidateFileSchema.safeParse(candidateFile(withoutUrl)).success).toBe(
      false,
    );
  });

  it.each([
    "http://127.0.0.1/article",
    "http://10.0.0.8/article",
    "http://192.168.1.8/article",
    "file:///tmp/article.html",
    "https://user:password@example.com/article",
  ])("rejects dangerous source URL %s", (sourceUrl) => {
    expect(
      workBuddyCandidateFileSchema.safeParse(
        candidateFile({ ...weChatCandidate, sourceUrl }),
      ).success,
    ).toBe(false);
  });

  it("rejects a preliminary summary longer than 2000 characters", () => {
    expect(
      workBuddyCandidateFileSchema.safeParse(
        candidateFile({
          ...weChatCandidate,
          preliminarySummary: "摘".repeat(2001),
        }),
      ).success,
    ).toBe(false);
  });

  it.each(["2026-08-01", "2026/08/01 08:00", "今天上午八点"])(
    "rejects invalid discovered date %s",
    (discoveredAt) => {
      expect(
        workBuddyCandidateFileSchema.safeParse(
          candidateFile({ ...weChatCandidate, discoveredAt }),
        ).success,
      ).toBe(false);
    },
  );

  it("rejects formal publication fields and unknown envelope fields", () => {
    expect(
      workBuddyCandidateFileSchema.safeParse(
        candidateFile({ ...weChatCandidate, publicationStatus: "PUBLISHED" }),
      ).success,
    ).toBe(false);
    expect(
      workBuddyCandidateFileSchema.safeParse({
        ...candidateFile(),
        internalNotes: "不得进入候选文件",
      }).success,
    ).toBe(false);
  });

  it("caps each file at 500 candidates", () => {
    expect(
      workBuddyCandidateFileSchema.safeParse({
        schemaVersion: "1",
        candidates: Array.from(
          { length: maximumWorkBuddyCandidatesPerFile + 1 },
          () => weChatCandidate,
        ),
      }).success,
    ).toBe(false);
  });
});
