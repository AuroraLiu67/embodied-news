import { z } from "zod";

import { NotificationError } from "./errors";
import type {
  FeishuMessageTransport,
  NotificationDelivery,
  NotificationSender,
} from "./types";

const openIdSchema = z.string().trim().min(1).max(200).regex(/^ou_[A-Za-z0-9_-]+$/);
const textSchema = z.string().trim().min(1).max(4000);
const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export class FeishuNotificationProvider implements NotificationSender {
  private readonly recipientOpenId: string;

  constructor(
    private readonly transport: FeishuMessageTransport,
    recipientOpenId: string,
  ) {
    const recipient = openIdSchema.safeParse(recipientOpenId);
    if (!recipient.success) {
      throw new NotificationError(
        "NOTIFICATION_INPUT_INVALID",
        "飞书私聊收件人 open_id 不合法",
        false,
      );
    }
    this.recipientOpenId = recipient.data;
  }

  async sendText(
    text: string,
    idempotencyKey: string,
  ): Promise<NotificationDelivery> {
    const parsedText = textSchema.safeParse(text);
    const parsedKey = idempotencyKeySchema.safeParse(idempotencyKey);
    if (!parsedText.success || !parsedKey.success) {
      throw new NotificationError(
        "NOTIFICATION_INPUT_INVALID",
        "飞书通知文本或幂等键不合法",
        false,
      );
    }

    let response: Awaited<ReturnType<FeishuMessageTransport["sendDirectText"]>>;
    try {
      response = await this.transport.sendDirectText({
        recipientOpenId: this.recipientOpenId,
        text: parsedText.data,
        uuid: parsedKey.data,
      });
    } catch {
      throw new NotificationError(
        "NOTIFICATION_DELIVERY_FAILED",
        "飞书私聊通知发送失败",
        true,
      );
    }
    if (response.code || !response.messageId) {
      throw new NotificationError(
        "NOTIFICATION_DELIVERY_FAILED",
        "飞书私聊通知未确认送达",
        true,
      );
    }
    return { messageId: response.messageId, delivered: true };
  }
}

