import type { OpenAIResearchOutput } from "../../providers/openai";
import type {
  RelevanceClassifier,
  RelevanceClassifierInput,
} from "./types";

interface OverseasResearchProvider {
  research(query: string): Promise<OpenAIResearchOutput>;
}

const industryPolicy = `按以下产品范围判断新闻是否与具身智能行业直接相关：
- 人形、通用、工业、物流、服务或特种机器人；
- 机器人基础模型、VLA、机器人学习、具身数据、仿真和训练平台；
- 机器人传感器、执行器、灵巧手及关键零部件；
- 与 Physical AI 直接相关的软硬件基础设施。
纯消费电子、传统自动化和无实体交互的通用 AI 默认无关；证据不足或只有牵强关联时必须返回 UNCERTAIN。`;

export class OpenAIRelevanceClassifier implements RelevanceClassifier {
  constructor(
    private readonly provider: OverseasResearchProvider,
    readonly model: string,
  ) {}

  async classify(input: RelevanceClassifierInput) {
    const result = await this.provider.research(`${industryPolicy}

判断以下候选，只依据给出的标题、来源和已安全清洗正文；不要把搜索摘要当成正文：
标题：${input.title}
来源：${input.sourceName}
来源 URL：${input.sourceUrl}
正文：${input.content}`);
    return result.relevance;
  }
}
