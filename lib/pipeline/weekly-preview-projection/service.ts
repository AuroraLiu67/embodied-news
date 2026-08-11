import {WeeklyPreviewProjectionError} from "./errors";
import {
  type EnrichmentEvent,
  type PreviewEvent,
  type WeeklyEnrichment,
  type WeeklyPreviewProjection,
  weeklyPreviewProjectionSchema,
} from "./schema";

type Tier = "P1" | "P2" | "P3";
export type PreviewIndustryCategory = "SEMICONDUCTOR_ELECTRONICS" | "ADVANCED_MANUFACTURING_MATERIALS" | "AEROSPACE_LOW_ALTITUDE" | "ENERGY_FUSION" | "QUANTUM_TECH" | "BIOTECH_HEALTHCARE" | "OTHER_HARD_TECH";
type SubcategoryRule = {name: string; keywords: readonly string[]};

const INDUSTRY_RULES: ReadonlyArray<{category: PreviewIndustryCategory; label: string; keywords: readonly string[]}> = [
  {category: "QUANTUM_TECH", label: "量子科技", keywords: ["量子"]},
  {category: "ENERGY_FUSION", label: "新能源与核聚变", keywords: ["核聚变", "聚变能源", "新能源", "储能", "光伏", "电力电子"]},
  {category: "AEROSPACE_LOW_ALTITUDE", label: "商业航天与低空经济", keywords: ["商业航天", "运载火箭", "火箭", "卫星", "星座", "空天", "低空", "evtol", "宇航"]},
  {category: "BIOTECH_HEALTHCARE", label: "生物医药", keywords: ["生物", "医药", "医疗", "药物", "临床", "器官", "血液", "脑机接口", "眼科", "蛋白", "生命世界模型"]},
  {category: "SEMICONDUCTOR_ELECTRONICS", label: "半导体与电子", keywords: ["半导体", "芯片", "硅片", "电子", "光电", "显示", "pcb", "pcba", "光波导", "成像器件"]},
  {category: "ADVANCED_MANUFACTURING_MATERIALS", label: "先进制造与材料", keywords: ["先进制造", "智能制造", "制造", "材料", "化工", "3d打印", "三维测量", "精密", "复合材料"]},
];

const INDUSTRY_LABELS: Record<PreviewIndustryCategory, string> = {
  QUANTUM_TECH: "量子科技",
  ENERGY_FUSION: "新能源与核聚变",
  AEROSPACE_LOW_ALTITUDE: "商业航天与低空经济",
  BIOTECH_HEALTHCARE: "生物医药",
  SEMICONDUCTOR_ELECTRONICS: "半导体与电子",
  ADVANCED_MANUFACTURING_MATERIALS: "先进制造与材料",
  OTHER_HARD_TECH: "其他硬科技",
};

const SUBCATEGORY_RULES: Record<Tier, ReadonlyArray<SubcategoryRule>> = {
  P1: [
    {name: "FULL_STACK_ROBOT", keywords: ["全栈机器人", "机器人整机", "人形机器人", "具身智能机器人"]},
    {name: "ROBOT_BODY", keywords: ["机器人本体", "四足机器人", "服务机器人", "工业机器人", "移动机器人"]},
    {name: "VLA_WORLD_MODEL", keywords: ["vla", "世界模型", "physical ai", "真实世界数据"]},
    {name: "ROBOT_FOUNDATION_MODEL", keywords: ["机器人基础模型", "机器人基础大模型", "具身大模型", "机器人学习"]},
  ],
  P2: [
    {name: "ROBOT_CORE_UPSTREAM", keywords: ["灵巧手", "执行器", "减速器", "机器人芯片", "机器人核心", "机器人零部件", "力传感器", "伺服"]},
    {name: "PHYSICAL_AI_INFRASTRUCTURE", keywords: ["physical ai", "仿真", "合成数据", "空间智能", "三维重建", "3d"]},
    {name: "ROBOT_RELATED_TECH", keywords: []},
    {name: "AUTONOMOUS_PHYSICAL_SYSTEM", keywords: ["evtol", "低空飞行器", "自主飞行", "飞控算法"]},
    {name: "AUTONOMOUS_DRIVING", keywords: ["自动驾驶", "智能驾驶", "无人驾驶", "智驾"]},
    {name: "GENERAL_AI", keywords: ["人工智能", "大模型", "ai", "算力", "推理芯片"]},
  ],
  P3: [],
};

const FALLBACK: Record<Tier, string> = {
  P1: "OTHER_EMBODIED_AI",
  P2: "OTHER_RELATED_TECH",
  P3: "OTHER_HARD_TECH",
};

export function classifyRelevanceSubcategory(event: Pick<EnrichmentEvent, "relevanceTier" | "relevanceRationale" | "companyBusiness" | "products" | "coreTechnology" | "introduction">): string {
  if (event.relevanceTier === "P4") return "EXCLUDED";
  const haystack = [event.relevanceRationale, event.companyBusiness, event.introduction, ...event.products, ...event.coreTechnology]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  if (event.relevanceTier === "P2") {
    const productEvidence = [event.companyBusiness, event.introduction, ...event.products, ...event.coreTechnology]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();
    const hasRobotEvidence = /机器人|robot/.test(productEvidence);
    const hasRelatedTechnology = /光学|感知|传感|精密|零部件|制造|加工|部署|模组|结构件/.test(productEvidence);
    const fixedRules = SUBCATEGORY_RULES.P2.filter((rule) => rule.name !== "ROBOT_RELATED_TECH");
    const leadingMatch = fixedRules.slice(0, 2).find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
    if (leadingMatch) return leadingMatch.name;
    if (hasRobotEvidence && hasRelatedTechnology) return "ROBOT_RELATED_TECH";
    return fixedRules.slice(2).find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)))?.name
      ?? FALLBACK.P2;
  }
  return SUBCATEGORY_RULES[event.relevanceTier].find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)))?.name
    ?? FALLBACK[event.relevanceTier];
}

export function financingStatusRank(status: string): number {
  if (/^(已完成|已上市)$/.test(status)) return 0;
  if (/已完成|已上市/.test(status)) return 1;
  if (/融资意向|寻求融资|开放融资|计划融资/.test(status)) return 3;
  if (/进行中|正在融资|正在推进|已启动/.test(status)) return 2;
  return 2;
}

export function classifyP3Industry(event: Pick<EnrichmentEvent, "companyBusiness" | "products" | "coreTechnology" | "relevanceRationale">): PreviewIndustryCategory {
  const haystack = [event.companyBusiness, event.relevanceRationale, ...event.products, ...event.coreTechnology]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  return INDUSTRY_RULES.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)))?.category
    ?? "OTHER_HARD_TECH";
}

export function deriveBusinessLabel(event: Pick<EnrichmentEvent, "companyBusiness" | "products">): string {
  const source = event.companyBusiness?.trim() || event.products[0]?.trim() || "业务未明确";
  return source.length <= 60 ? source : `${source.slice(0, 59)}…`;
}

export function deriveCapitalEventLabel(event: Pick<EnrichmentEvent, "financingStatus" | "round">): string {
  const text = `${event.round ?? ""} ${event.financingStatus}`.toLowerCase();
  if (/ipo|上市|h股|发行/.test(text)) return "IPO / 上市";
  if (/增资/.test(text)) return "增资";
  if (/并购|收购/.test(text)) return "并购";
  if (/融资|轮|募资/.test(text)) return "融资";
  return "资本动态";
}

function parseP3CapitalAmount(event: Pick<PreviewEvent, "amount" | "round" | "financingStatus">): AmountSortBucket {
  if (/ipo|上市|发行|市值/i.test(`${event.round ?? ""} ${event.financingStatus} ${event.amount ?? ""}`)) {
    return {disclosed: false, magnitude: 0};
  }
  return parseAmountSortBucket(event.amount);
}

export interface AmountSortBucket {
  disclosed: boolean;
  magnitude: number;
}

const chineseNumbers: Record<string, number> = {一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10};

export function parseAmountSortBucket(amount: string | null): AmountSortBucket {
  if (!amount || /未披露|未明确|不详/.test(amount)) return {disclosed: false, magnitude: 0};
  const normalized = amount.replaceAll(",", "").toLowerCase();
  const vagueMultiplier = /数十/.test(normalized) ? 30 : /数/.test(normalized) ? 3 : 1;
  const chineseNumeric = chineseNumbers[normalized.match(/[一二两三四五六七八九十](?=[亿万])/)?.[0] ?? ""];
  const numeric = Number(normalized.match(/\d+(?:\.\d+)?/)?.[0] ?? chineseNumeric ?? vagueMultiplier);
  const unit = /万亿|trillion/.test(normalized) ? 1_000_000_000_000
    : /亿|hundred million/.test(normalized) ? 100_000_000
      : /千万|ten million/.test(normalized) ? 10_000_000
        : /百万|million/.test(normalized) ? 1_000_000
          : /万|ten thousand/.test(normalized) ? 10_000
            : 1;
  return {disclosed: true, magnitude: numeric * unit};
}

function subcategoryRank(tier: Tier, subcategory: string): number {
  const index = SUBCATEGORY_RULES[tier].findIndex((rule) => rule.name === subcategory);
  return index < 0 ? SUBCATEGORY_RULES[tier].length : index;
}

function compareEvents(left: Omit<PreviewEvent, "displayPriority" | "priorityReason">, right: Omit<PreviewEvent, "displayPriority" | "priorityReason">): number {
  const tierRank = {P1: 0, P2: 1, P3: 2};
  const tierDifference = tierRank[left.relevanceTier] - tierRank[right.relevanceTier];
  if (tierDifference !== 0) return tierDifference;
  const categoryDifference = subcategoryRank(left.relevanceTier, left.relevanceSubcategory) - subcategoryRank(right.relevanceTier, right.relevanceSubcategory);
  if (categoryDifference !== 0) return categoryDifference;
  if (left.relevanceTier === "P2") {
    const statusDifference = financingStatusRank(left.financingStatus) - financingStatusRank(right.financingStatus);
    if (statusDifference !== 0) return statusDifference;
  }
  if (left.relevanceTier === "P3") {
    const statusDifference = financingStatusRank(left.financingStatus) - financingStatusRank(right.financingStatus);
    if (statusDifference !== 0) return statusDifference;
  }
  const leftAmount = left.relevanceTier === "P3" ? parseP3CapitalAmount(left) : parseAmountSortBucket(left.amount);
  const rightAmount = right.relevanceTier === "P3" ? parseP3CapitalAmount(right) : parseAmountSortBucket(right.amount);
  if (leftAmount.disclosed !== rightAmount.disclosed) return leftAmount.disclosed ? -1 : 1;
  if (leftAmount.magnitude !== rightAmount.magnitude) return rightAmount.magnitude - leftAmount.magnitude;
  return left.id.localeCompare(right.id, "en");
}

function toPublicEvent(event: EnrichmentEvent): Omit<PreviewEvent, "displayPriority" | "priorityReason"> {
  const sources = event.sourceUrls.map((url) => ({url, publishedAt: event.sourcePublishedAt[url] ?? null}));
  const industryCategory = event.relevanceTier === "P3" ? classifyP3Industry(event) : null;
  return {
    id: event.eventKey,
    companyStandardName: event.companyNameStandard,
    companyDisplayName: event.companyNameOriginal,
    companyEnglishName: event.companyEnglishName,
    regionScope: event.regionScope,
    relevanceTier: event.relevanceTier as Tier,
    relevanceSubcategory: classifyRelevanceSubcategory(event),
    industryCategory,
    industryLabel: industryCategory ? INDUSTRY_LABELS[industryCategory] : null,
    businessLabel: event.relevanceTier === "P3" ? deriveBusinessLabel(event) : null,
    capitalEventLabel: event.relevanceTier === "P3" ? deriveCapitalEventLabel(event) : null,
    officialWebsite: event.officialWebsite,
    introduction: event.introduction,
    companyBusiness: event.companyBusiness,
    products: event.products,
    coreTechnology: event.coreTechnology,
    foundingTeam: event.foundingTeam,
    financingStatus: event.financingStatus,
    round: event.round,
    amount: event.amount,
    currency: event.currency,
    leadInvestors: event.leadInvestors,
    followInvestors: event.followInvestors,
    otherInvestors: event.otherInvestors,
    financialAdviser: event.financialAdviser,
    useOfFunds: event.useOfFunds,
    valuation: event.valuation,
    cumulativeFunding: event.cumulativeFunding,
    sources,
  };
}

export function generateWeeklyPreviewProjection(input: WeeklyEnrichment, weekStart: string, weekEnd: string): WeeklyPreviewProjection {
  const ids = input.events.map((event) => event.eventKey);
  const problems: string[] = [];
  if (new Set(ids).size !== ids.length) problems.push("events.eventKey重复");
  if (input.inputEventCount !== input.events.length) problems.push("inputEventCount与events数量不一致");
  if (input.excludedP4Count !== input.excludedP4.length) problems.push("excludedP4Count与excludedP4数量不一致");
  if (input.sourceEventCount !== input.inputEventCount + input.excludedP4Count) problems.push("sourceEventCount统计不一致");
  if (input.events.some((event) => event.relevanceTier === "P4")) problems.push("P4不得进入公开事件");
  if (problems.length > 0) throw new WeeklyPreviewProjectionError("PREVIEW_INVARIANT_FAILED", "预览投影统计或边界不一致", problems);

  const sorted = input.events.map(toPublicEvent).sort(compareEvents);
  const events: PreviewEvent[] = sorted.map((event, index) => {
    const bucket = event.relevanceTier === "P3" ? parseP3CapitalAmount(event) : parseAmountSortBucket(event.amount);
    return {
      ...event,
      displayPriority: index + 1,
      priorityReason: `${event.relevanceTier}/${event.relevanceSubcategory};${event.relevanceTier === "P2" || event.relevanceTier === "P3" ? `状态等级${financingStatusRank(event.financingStatus)};` : ""}金额${bucket.disclosed ? `原币种量级${bucket.magnitude}` : "未披露或非融资金额"};稳定ID兜底`,
    };
  });
  const tierCount = (tier: Tier) => events.filter((event) => event.relevanceTier === tier).length;
  return weeklyPreviewProjectionSchema.parse({
    schemaVersion: "1",
    mode: "PREVIEW",
    weekStart,
    weekEnd,
    counts: {original: input.sourceEventCount, excludedP4: input.excludedP4Count, public: events.length, P1: tierCount("P1"), P2: tierCount("P2"), P3: tierCount("P3")},
    events,
  });
}

export function serializeWeeklyPreviewProjection(projection: WeeklyPreviewProjection): string {
  return `${JSON.stringify(weeklyPreviewProjectionSchema.parse(projection), null, 2)}\n`;
}
