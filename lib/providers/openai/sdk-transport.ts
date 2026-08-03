import OpenAI from "openai";

import { openAIResearchJsonSchema } from "./response-schema";
import type {
  OpenAIResearchRequest,
  OpenAITransport,
  OpenAITransportResponse,
} from "./types";

const developerInstructions = `你是具身智能产业研究员。使用 Web Search 搜索海外公司官网、投资机构公告、监管披露和权威媒体。
只返回来源支持的事实；不得估算未披露金额，不得把搜索摘要冒充完整原文。
比较多来源中的公司、轮次、金额、币种、投资方和日期；存在冲突时降低置信度，并把每个冲突及其来源写入 conflicts。
输出中文公开摘要和市场意义，并在 sources 中列出实际支持结论的来源；每个来源必须用 supportsFacts 精确标注它支持的字段，不能把来源未陈述的字段算作证据。`;

export class OpenAISdkTransport implements OpenAITransport {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async research(
    request: OpenAIResearchRequest,
  ): Promise<OpenAITransportResponse> {
    const response = await this.client.responses.create(
      {
        model: request.model,
        store: false,
        instructions: developerInstructions,
        input: request.query,
        tools: [{ type: "web_search" }],
        tool_choice: "auto",
        max_output_tokens: request.maxOutputTokens,
        text: {
          format: {
            type: "json_schema",
            name: "overseas_embodied_ai_research",
            strict: true,
            schema: openAIResearchJsonSchema,
          },
        },
      },
      { signal: request.signal },
    );

    const refusal = response.output
      .flatMap((item) => (item.type === "message" ? item.content : []))
      .some((content) => content.type === "refusal");
    if (refusal) return { status: "refused" };
    if (response.status !== "completed") {
      return {
        status: "incomplete",
        incompleteReason: response.incomplete_details?.reason,
      };
    }
    return { status: "completed", outputText: response.output_text };
  }
}
