import { describe, expect, it, vi } from "vitest";

import {
  FeishuNotificationProvider,
  NotificationError,
} from "../../../lib/providers/notification";

describe("FeishuNotificationProvider", () => {
  it("always sends to one personal open_id with a text payload", async () => {
    const sendDirectText = vi.fn().mockResolvedValue({
      code: 0,
      messageId: "om_message_001",
    });
    const provider = new FeishuNotificationProvider(
      { sendDirectText },
      "ou_person_001",
    );

    await expect(
      provider.sendText("日报已生成\nhttps://example.com/digest", "digest:2026-08-03"),
    ).resolves.toEqual({ messageId: "om_message_001", delivered: true });
    expect(sendDirectText).toHaveBeenCalledWith({
      recipientOpenId: "ou_person_001",
      text: "日报已生成\nhttps://example.com/digest",
      uuid: "digest:2026-08-03",
    });
    expect(JSON.stringify(sendDirectText.mock.calls)).not.toContain("chat_id");
    expect(JSON.stringify(sendDirectText.mock.calls)).not.toContain("interactive");
  });

  it.each(["oc_group_chat", "chat-example", "", "ou_"])(
    "rejects non-personal recipient %s",
    (recipient) => {
      expect(
        () => new FeishuNotificationProvider({ sendDirectText: vi.fn() }, recipient),
      ).toThrowError(
        expect.objectContaining({
          name: "NotificationError",
          code: "NOTIFICATION_INPUT_INVALID",
        }) as NotificationError,
      );
    },
  );

  it("returns a stable retryable error without leaking provider details", async () => {
    const provider = new FeishuNotificationProvider(
      {
        sendDirectText: vi.fn().mockRejectedValue(
          new Error("secret-token provider detail"),
        ),
      },
      "ou_person_001",
    );

    const error = await provider
      .sendText("测试通知", "test:2026-08-03")
      .catch((caught) => caught);
    expect(error).toMatchObject({
      name: "NotificationError",
      code: "NOTIFICATION_DELIVERY_FAILED",
      retryable: true,
    });
    expect(String(error)).not.toContain("secret-token");
  });

  it("rejects empty delivery responses", async () => {
    const provider = new FeishuNotificationProvider(
      { sendDirectText: vi.fn().mockResolvedValue({ code: 0 }) },
      "ou_person_001",
    );

    await expect(
      provider.sendText("测试通知", "test:2026-08-03"),
    ).rejects.toMatchObject({ code: "NOTIFICATION_DELIVERY_FAILED" });
  });
});

