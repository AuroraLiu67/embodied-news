import * as lark from "@larksuiteoapi/node-sdk";

import type { FeishuMessageTransport } from "./types";

export class FeishuMessageSdkTransport implements FeishuMessageTransport {
  private readonly client: lark.Client;

  constructor(appId: string, appSecret: string) {
    this.client = new lark.Client({
      appId,
      appSecret,
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.error,
    });
  }

  async sendDirectText(
    request: Parameters<FeishuMessageTransport["sendDirectText"]>[0],
  ) {
    const response = await this.client.im.message.create({
      params: { receive_id_type: "open_id" },
      data: {
        receive_id: request.recipientOpenId,
        msg_type: "text",
        content: JSON.stringify({ text: request.text }),
        uuid: request.uuid,
      },
    });
    return {
      code: response.code,
      msg: response.msg,
      messageId: response.data?.message_id,
    };
  }
}

