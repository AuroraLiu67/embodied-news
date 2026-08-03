import { z } from "zod";

import { openAiResearchOutputSchema } from "../../domain/schemas/boundaries";
import { mapOpenAIError, OpenAIProviderError } from "./errors";
import { OpenAISdkTransport } from "./sdk-transport";
import type { OpenAIProviderLogEvent, OpenAITransport } from "./types";

export type OpenAIResearchOutput = z.infer<typeof openAiResearchOutputSchema>;

export interface OpenAIProviderOptions {
  model: string;
  transport: OpenAITransport;
  dailyRequestLimit?: number;
  maxInputCharacters?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: (event: OpenAIProviderLogEvent) => void;
}

export interface CreateLiveOpenAIProviderOptions
  extends Omit<OpenAIProviderOptions, "transport"> {
  apiKey: string;
}

const defaults = {
  dailyRequestLimit: 100,
  maxInputCharacters: 20_000,
  maxOutputTokens: 4_000,
  maxRetries: 2,
  timeoutMs: 60_000,
};

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class OpenAIProvider {
  private readonly limits;
  private requestCount = 0;

  constructor(private readonly options: OpenAIProviderOptions) {
    if (!options.model.trim()) {
      throw new OpenAIProviderError(
        "OPENAI_INPUT_INVALID",
        "OpenAI 模型配置不能为空",
        false,
      );
    }
    this.limits = {
      dailyRequestLimit:
        options.dailyRequestLimit ?? defaults.dailyRequestLimit,
      maxInputCharacters:
        options.maxInputCharacters ?? defaults.maxInputCharacters,
      maxOutputTokens: options.maxOutputTokens ?? defaults.maxOutputTokens,
      maxRetries: options.maxRetries ?? defaults.maxRetries,
      timeoutMs: options.timeoutMs ?? defaults.timeoutMs,
    };
    if (
      this.limits.dailyRequestLimit < 1 ||
      this.limits.maxInputCharacters < 1 ||
      this.limits.maxOutputTokens < 1 ||
      this.limits.maxRetries < 0 ||
      this.limits.timeoutMs < 1
    ) {
      throw new OpenAIProviderError(
        "OPENAI_INPUT_INVALID",
        "OpenAI Provider 限额配置不合法",
        false,
      );
    }
  }

  async research(query: string): Promise<OpenAIResearchOutput> {
    const normalizedQuery = query.trim();
    if (
      normalizedQuery.length === 0 ||
      normalizedQuery.length > this.limits.maxInputCharacters
    ) {
      throw new OpenAIProviderError(
        "OPENAI_INPUT_INVALID",
        "海外研究查询为空或超过长度上限",
        false,
      );
    }
    if (this.requestCount >= this.limits.dailyRequestLimit) {
      throw new OpenAIProviderError(
        "OPENAI_DAILY_LIMIT_EXCEEDED",
        "OpenAI 每日请求上限已用完",
        false,
      );
    }
    this.requestCount += 1;

    const attempts = this.limits.maxRetries + 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.limits.timeoutMs);
      try {
        const response = await this.options.transport.research({
          model: this.options.model,
          query: normalizedQuery,
          maxOutputTokens: this.limits.maxOutputTokens,
          signal: controller.signal,
        });
        if (response.status === "refused") {
          throw new OpenAIProviderError(
            "OPENAI_REFUSED",
            "OpenAI 拒绝了研究请求",
            false,
          );
        }
        if (response.status !== "completed" || !response.outputText) {
          throw new OpenAIProviderError(
            "OPENAI_INCOMPLETE_RESPONSE",
            "OpenAI 返回未完成响应",
            false,
          );
        }

        let value: unknown;
        try {
          value = JSON.parse(response.outputText) as unknown;
        } catch {
          throw new OpenAIProviderError(
            "OPENAI_INVALID_RESPONSE",
            "OpenAI 返回的结构化结果不是合法 JSON",
            false,
          );
        }
        const parsed = openAiResearchOutputSchema.safeParse(value);
        if (!parsed.success) {
          throw new OpenAIProviderError(
            "OPENAI_INVALID_RESPONSE",
            "OpenAI 返回结果未通过项目 Schema",
            false,
          );
        }
        this.options.logger?.({
          operation: "overseas_research",
          outcome: "succeeded",
          attempt,
        });
        return parsed.data;
      } catch (error) {
        const mapped = mapOpenAIError(error);
        const willRetry = mapped.retryable && attempt < attempts;
        this.options.logger?.({
          operation: "overseas_research",
          outcome: willRetry ? "retry" : "failed",
          attempt,
          errorCode: mapped.code,
        });
        if (!willRetry) throw mapped;
        await (this.options.sleep ?? delay)(Math.min(250 * 2 ** (attempt - 1), 2_000));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new OpenAIProviderError(
      "OPENAI_API_ERROR",
      "OpenAI 请求未产生结果",
      false,
    );
  }
}

export const createLiveOpenAIProvider = (
  options: CreateLiveOpenAIProviderOptions,
): OpenAIProvider =>
  new OpenAIProvider({
    ...options,
    transport: new OpenAISdkTransport(options.apiKey),
  });
