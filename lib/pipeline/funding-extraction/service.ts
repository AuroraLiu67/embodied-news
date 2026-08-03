import type { FundingFacts, SourceEvidence } from "../../domain";
import {
  openAiResearchOutputSchema,
  researchCandidateSchema,
  sourceEvidenceSchema,
} from "../../domain";
import { FundingExtractionError } from "./errors";
import type {
  FundingExtractionInput,
  FundingExtractionResult,
  FundingResearchProvider,
} from "./types";

export interface FundingExtractionServiceOptions {
  model: string;
  now?: () => Date;
  maxContentCharacters?: number;
}

const extractionInstruction = `只抽取来源明确陈述的融资事实：公司、轮次、金额、币种、投资方、公告日期、地区和技术方向。
金额未披露时必须设置 amountDisclosed=false，amount 和 currency 必须为 null；不得估算金额。
日期只有月份、季度、“近日”等模糊表述时 announcedAt 必须为 null；不得补造具体日期。
投资方未明确披露时返回空数组。每个来源必须在 supportsFacts 中逐项标注实际支持的字段。
不同来源存在金额、轮次或日期冲突时保留全部值和来源，不得静默选择。`;

export class FundingExtractionService {
  private readonly now: () => Date;
  private readonly maxContentCharacters: number;

  constructor(
    private readonly provider: FundingResearchProvider,
    private readonly options: FundingExtractionServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
    this.maxContentCharacters = options.maxContentCharacters ?? 20_000;
    if (
      !options.model.trim() ||
      options.model.length > 100 ||
      this.maxContentCharacters < 1
    ) {
      throw new FundingExtractionError(
        "FUNDING_EXTRACTION_INPUT_INVALID",
        "融资抽取配置无效",
        false,
      );
    }
  }

  async extract(input: FundingExtractionInput): Promise<FundingExtractionResult> {
    const candidate = researchCandidateSchema.safeParse(input.candidate);
    if (
      !candidate.success ||
      candidate.data.relevance?.decision !== "RELEVANT" ||
      !input.content.text.trim()
    ) {
      throw new FundingExtractionError(
        "FUNDING_EXTRACTION_INPUT_INVALID",
        "融资抽取输入无效或尚未确认相关",
        false,
      );
    }

    let raw: unknown;
    try {
      raw = await this.provider.research(`${extractionInstruction}

候选标题：${candidate.data.title}
候选来源：${candidate.data.sourceName}
候选 URL：${candidate.data.sourceUrl}
已安全清洗正文：${input.content.text.slice(0, this.maxContentCharacters)}`);
    } catch {
      throw new FundingExtractionError(
        "FUNDING_EXTRACTION_PROVIDER_FAILED",
        "融资抽取服务失败",
        true,
      );
    }

    const output = openAiResearchOutputSchema.safeParse(raw);
    if (!output.success || output.data.relevance.decision !== "RELEVANT") {
      throw new FundingExtractionError(
        "FUNDING_EXTRACTION_OUTPUT_INVALID",
        "融资抽取结果未通过 Schema 或相关性不一致",
        false,
      );
    }

    const sourceByUrl = new Map(
      output.data.sources.map((source) => [source.sourceUrl, source]),
    );
    for (const conflict of output.data.conflicts) {
      if (
        conflict.values.some((value) => {
          const source = sourceByUrl.get(value.sourceUrl);
          return !source || !source.supportsFacts.includes(conflict.field);
        })
      ) {
        throw new FundingExtractionError(
          "FUNDING_EXTRACTION_OUTPUT_INVALID",
          "融资冲突缺少可追溯来源",
          false,
        );
      }
    }

    const supports = (field: keyof FundingFacts) =>
      output.data.sources.some((source) => source.supportsFacts.includes(field));
    const extracted = output.data.extractedFacts;
    const amountSupported =
      extracted.amountDisclosed &&
      supports("amount") &&
      supports("currency") &&
      extracted.amount !== null &&
      extracted.currency !== null;
    const facts: FundingFacts = {
      companyName: supports("companyName") ? extracted.companyName : null,
      round: supports("round") ? extracted.round : null,
      amount: amountSupported ? extracted.amount : null,
      currency: amountSupported ? extracted.currency : null,
      amountDisclosed: amountSupported,
      investors: supports("investors") ? extracted.investors : [],
      announcedAt: supports("announcedAt") ? extracted.announcedAt : null,
      region: supports("region") ? extracted.region : null,
      technologyTags: supports("technologyTags")
        ? extracted.technologyTags
        : [],
    };

    const accessedAt = this.now().toISOString();
    const evidence = output.data.sources.map((source): SourceEvidence =>
      sourceEvidenceSchema.parse({ ...source, accessedAt }),
    );
    const updatedCandidate = researchCandidateSchema.parse({
      ...candidate.data,
      extractedFacts: facts,
      conflicts: output.data.conflicts,
    });

    return {
      candidate: updatedCandidate,
      facts,
      evidence,
      conflicts: output.data.conflicts,
      model: this.options.model,
    };
  }
}
