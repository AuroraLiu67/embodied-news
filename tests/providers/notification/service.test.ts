import { describe, expect, it, vi } from "vitest";

import {
  NotificationService,
  type NotificationSender,
} from "../../../lib/providers/notification";

const sender = () => {
  const sendText = vi.fn().mockResolvedValue({
    messageId: "om_message_001",
    delivered: true as const,
  });
  return { service: new NotificationService({ sendText }), sendText };
};

describe("NotificationService", () => {
  it("builds a review reminder with counts and the Feishu review link", async () => {
    const { service, sendText } = sender();

    await service.sendReviewReminder({
      businessDate: "2026-08-03",
      candidateCount: 12,
      highConfidenceCount: 4,
      lowConfidenceCount: 3,
      needsResearchCount: 2,
      reviewUrl: "https://example.feishu.cn/base/review",
    });

    expect(sendText).toHaveBeenCalledWith(
      [
        "【待审核提醒｜2026-08-03】",
        "候选总数：12",
        "高置信度：4",
        "低置信度：3",
        "待复核：2",
        "审核入口：https://example.feishu.cn/base/review",
      ].join("\n"),
      "review:2026-08-03",
    );
  });

  it("builds a publication notification and marks human review status", async () => {
    const { service, sendText } = sender();

    await service.sendPublication({
      businessDate: "2026-08-03",
      fundingEventCount: 3,
      headline: "某具身智能公司完成新一轮融资",
      digestUrl: "https://example.com/daily/2026-08-03",
      humanReviewed: false,
    });

    expect(sendText.mock.calls[0][0]).toContain("今日融资事件：3 条");
    expect(sendText.mock.calls[0][0]).toContain("AI 自动生成、未经人工审核");
    expect(sendText.mock.calls[0][0]).toContain(
      "日报链接：https://example.com/daily/2026-08-03",
    );
    expect(sendText).toHaveBeenCalledWith(
      expect.any(String),
      "publication:2026-08-03",
    );
  });

  it("builds failure and recovery notifications with ordinary links", async () => {
    const { service, sendText } = sender();

    await service.sendFailure({
      businessDate: "2026-08-03",
      jobName: "日报生成",
      errorCode: "DIGEST_BUILD_FAILED",
      retryUrl: "https://github.com/example/actions/runs/1",
    });
    await service.sendRecovery({
      businessDate: "2026-08-03",
      jobName: "日报生成",
      statusUrl: "https://github.com/example/actions/runs/2",
    });

    expect(sendText.mock.calls[0][0]).toContain("【任务失败｜2026-08-03】");
    expect(sendText.mock.calls[0][0]).toContain("DIGEST_BUILD_FAILED");
    expect(sendText.mock.calls[1][0]).toContain("【任务已恢复｜2026-08-03】");
    const serialized = JSON.stringify(sendText.mock.calls);
    expect(serialized).not.toContain("interactive");
    expect(serialized).not.toContain("card");
  });

  it("does not mutate formal state when notification delivery fails", async () => {
    const formalState = { publicationStatus: "PUBLISHED", version: 3 };
    const snapshot = { ...formalState };
    const failingSender: NotificationSender = {
      sendText: vi.fn().mockRejectedValue(new Error("notification unavailable")),
    };
    const service = new NotificationService(failingSender);

    await expect(
      service.sendPublication({
        businessDate: "2026-08-03",
        fundingEventCount: 1,
        headline: "测试头条",
        digestUrl: "https://example.com/daily/2026-08-03",
        humanReviewed: true,
      }),
    ).rejects.toThrow("notification unavailable");
    expect(formalState).toEqual(snapshot);
  });

  it("rejects unsafe links before calling the sender", async () => {
    const { service, sendText } = sender();

    await expect(
      service.sendReviewReminder({
        businessDate: "2026-08-03",
        candidateCount: 1,
        highConfidenceCount: 1,
        lowConfidenceCount: 0,
        needsResearchCount: 0,
        reviewUrl: "http://127.0.0.1/private",
      }),
    ).rejects.toMatchObject({ code: "NOTIFICATION_INPUT_INVALID" });
    expect(sendText).not.toHaveBeenCalled();
  });
});

