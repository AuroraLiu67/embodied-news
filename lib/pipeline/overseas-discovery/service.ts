import { createHash } from "node:crypto";

import { isoDateSchema } from "../../domain";
import type { OpenAIResearchOutput } from "../../providers/openai";
import { canonicalizeCandidateUrl } from "../../providers/workbuddy";
import { OverseasDiscoveryError } from "./errors";
import type {
  OpenAIDiscoveredCandidate,
  OverseasDiscoveryOptions,
  OverseasDiscoveryQueryFile,
  OverseasDiscoveryResult,
} from "./types";

const sourceTierPriority = {
  PRIMARY: 0,
  AUTHORITATIVE: 1,
  SECONDARY: 2,
} as const;

const sourceTypePriority = {
  COMPANY: 0,
  INVESTOR: 1,
  REGULATOR: 2,
  GOVERNMENT: 3,
  FA: 4,
  MEDIA: 5,
  SOCIAL: 6,
} as const;

type ResearchSource = OpenAIResearchOutput["sources"][number];
type EligibleResearchSource = ResearchSource & {
  sourceType: keyof typeof sourceTypePriority;
  sourceTier: keyof typeof sourceTierPriority;
  publishedAt: string;
};

const isEligibleDatedSource = (
  source: ResearchSource,
  businessDate: string,
  timeZone: string,
): source is EligibleResearchSource =>
  source.publishedAt !== null &&
  source.sourceType !== "SEARCH_SNIPPET" &&
  source.sourceTier !== "LEAD" &&
  dateInTimeZone(source.publishedAt, timeZone) === businessDate;

const dateInTimeZone = (value: string, timeZone: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const createOpenAICandidateId = (canonicalUrl: string): string =>
  `candidate-oa-${createHash("sha256")
    .update(canonicalUrl)
    .digest("hex")
    .slice(0, 24)}`;

export const buildOverseasResearchQuery = (
  businessDate: string,
  query: string,
  timeZone = "Asia/Shanghai",
): string =>
  [
    `业务日期：${businessDate}（${timeZone}）。`,
    "只研究海外 Physical AI、具身智能、机器人及其上下游融资事件。",
    "只选择原始来源发布时间落在该业务日期内的事件；日期不明确或仅由二手页面转述时，不得冒充当日事件。",
    "本次查询最多返回一个有明确原始来源支持的融资事件；若没有符合条件的事件，返回不相关判断，不得使用其他日期内容填充。",
    `检索任务：${query.trim()}`,
  ].join("\n");

export class OverseasDiscoveryService {
  private readonly now: () => Date;
  private readonly timeZone: string;

  constructor(private readonly options: OverseasDiscoveryOptions) {
    this.now = options.now ?? (() => new Date());
    this.timeZone = options.timeZone ?? "Asia/Shanghai";
    if (!options.model.trim()) {
      throw new OverseasDiscoveryError(
        "OVERSEAS_DISCOVERY_INPUT_INVALID",
        "海外发现模型名称不能为空",
      );
    }
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: this.timeZone }).format();
    } catch {
      throw new OverseasDiscoveryError(
        "OVERSEAS_DISCOVERY_INPUT_INVALID",
        "海外发现时区配置不合法",
      );
    }
  }

  async discover(
    businessDate: string,
    queryFile: OverseasDiscoveryQueryFile,
  ): Promise<OverseasDiscoveryResult> {
    const parsedDate = isoDateSchema.safeParse(businessDate);
    if (!parsedDate.success) {
      throw new OverseasDiscoveryError(
        "OVERSEAS_DISCOVERY_INPUT_INVALID",
        "海外发现业务日期必须是 YYYY-MM-DD",
      );
    }

    let created = 0;
    let duplicates = 0;
    let rejected = 0;
    let failed = 0;

    for (const query of queryFile.queries) {
      let output;
      try {
        output = await this.options.provider.research(
          buildOverseasResearchQuery(
            parsedDate.data,
            query.query,
            this.timeZone,
          ),
        );
      } catch {
        failed += 1;
        continue;
      }

      if (output.relevance.decision === "NOT_RELEVANT") {
        rejected += 1;
        continue;
      }

      const matchingSources = output.sources
        .filter((source) =>
          isEligibleDatedSource(source, parsedDate.data, this.timeZone),
        )
        .sort(
          (left, right) =>
            sourceTierPriority[left.sourceTier] -
              sourceTierPriority[right.sourceTier] ||
            sourceTypePriority[left.sourceType] -
              sourceTypePriority[right.sourceType] ||
            left.sourceUrl.localeCompare(right.sourceUrl),
        );
      const primarySource = matchingSources[0];
      if (!primarySource) {
        rejected += 1;
        continue;
      }

      const canonicalUrl = canonicalizeCandidateUrl(primarySource.sourceUrl);
      const existing = (await this.options.repository.list()).find(
        (record) => record.data.canonicalUrl === canonicalUrl,
      );
      if (existing) {
        duplicates += 1;
        continue;
      }

      const candidate: OpenAIDiscoveredCandidate = {
        candidateId: createOpenAICandidateId(canonicalUrl),
        title: primarySource.title,
        sourceUrl: primarySource.sourceUrl,
        canonicalUrl,
        sourceType: primarySource.sourceType,
        sourceTier: primarySource.sourceTier,
        contentType: "FUNDING",
        regionScope: "OVERSEAS",
        discoveredBy: "OPENAI",
        publishedAt: primarySource.publishedAt,
        discoveredAt: this.now().toISOString(),
        rawExcerpt: output.publicSummary,
        extractedFacts: JSON.stringify({
          openAI: {
            queryId: query.queryId,
            model: this.options.model,
            facts: output.extractedFacts,
            sources: output.sources,
            publicWhyItMatters: output.publicWhyItMatters,
          },
        }),
        relevanceDecision: output.relevance.decision,
        confidenceLevel: output.relevance.confidence.level,
        confidenceScore: output.relevance.confidence.score,
        conflictSummary:
          output.conflicts.length === 0
            ? ""
            : `冲突字段：${[
                ...new Set(output.conflicts.map((conflict) => conflict.field)),
              ].join("、")}`,
        reviewStatus: "PENDING",
      };
      const result = await this.options.repository.createOrUpdate(candidate);
      if (result.action === "created") created += 1;
      else duplicates += 1;
    }

    if (failed === queryFile.queries.length) {
      throw new OverseasDiscoveryError(
        "OVERSEAS_DISCOVERY_PROVIDER_UNAVAILABLE",
        "全部海外发现查询均未完成，请稍后重试",
      );
    }

    return {
      totalQueries: queryFile.queries.length,
      created,
      duplicates,
      rejected,
      failed,
    };
  }
}
