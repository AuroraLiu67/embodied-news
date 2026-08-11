type Tier = "P1" | "P2" | "P3";

interface FixtureOverrides {
  company?: string;
  business?: string;
  rationale?: string;
  status?: string;
  round?: string | null;
  amount?: string | null;
  currency?: "CNY" | "USD" | "HKD" | null;
  sourceUrl?: string;
  publishedAt?: string;
}

function event(tier: Tier, index: number, overrides: FixtureOverrides = {}) {
  const company = overrides.company ?? `${tier}-SANITIZED-${String(index).padStart(2, "0")}`;
  const sourceUrl = overrides.sourceUrl ?? `https://example.com/${tier.toLowerCase()}/${index}`;
  const business = overrides.business ?? (tier === "P1" ? "研发全栈机器人与机器人本体。" : tier === "P2" ? "研发通用人工智能大模型。" : "研发先进复合材料制造技术。");
  return {
    eventKey: `event-sanitized-${tier.toLowerCase()}-${String(index).padStart(2, "0")}`,
    regionScope: "CHINA" as const,
    relevanceTier: tier,
    relevanceRationale: overrides.rationale ?? business,
    companyNameOriginal: company,
    companyNameStandard: company,
    companyEnglishName: null,
    officialWebsite: null,
    sourceUrls: [sourceUrl],
    sourcePublishedAt: {[sourceUrl]: overrides.publishedAt ?? "2026-08-06 09:00"},
    eventDate: null,
    financingStatus: overrides.status ?? "已完成",
    round: overrides.round === undefined ? "A轮" : overrides.round,
    amount: overrides.amount === undefined ? `${index + 1}千万元` : overrides.amount,
    currency: overrides.currency === undefined ? "CNY" as const : overrides.currency,
    leadInvestors: [],
    followInvestors: [],
    otherInvestors: [],
    financialAdviser: null,
    companyBusiness: business,
    products: [],
    coreTechnology: [],
    foundingTeam: [],
    useOfFunds: null,
    valuation: null,
    cumulativeFunding: null,
    introduction: `${company}为脱敏测试公司，本条仅用于验证确定性公开投影。`,
    fieldEvidence: {},
    missingFields: [],
    conflicts: [],
    accessLimitations: [],
    researchStatus: "SANITIZED_FIXTURE",
  };
}

const p1 = Array.from({length: 18}, (_, index) => event("P1", index));
p1[0] = event("P1", 0, {
  company: "Ropedia",
  business: "为机器人基础模型、VLA和世界模型提供真实世界数据基础设施。",
  sourceUrl: "https://www.36kr.com/p/3927411140425861",
  publishedAt: "2026-08-06 10:09",
  amount: "数千万美元",
  currency: "USD",
});

const p2 = Array.from({length: 27}, (_, index) => event("P2", index));
p2[0] = event("P2", 0, {company: "立景创新", business: "为机器人提供中高端光学模组与系统集成方案。", amount: null});
p2[1] = event("P2", 1, {company: "德玛克精工", business: "为机器人等高端装备提供核心精密零部件及加工服务。", amount: "4.2亿元"});
p2[2] = event("P2", 2, {company: "亿维特航空", business: "研发载人及载货eVTOL低空飞行器与飞控算法。", amount: "数亿元"});
p2[3] = event("P2", 3, {company: "嘉立创", business: "提供PCB、PCBA及宽泛智能硬件数字化制造服务。", amount: "46.93亿元"});
p2[4] = event("P2", 4, {company: "拿森科技", business: "研发自动驾驶线控底盘与智能驾驶系统。", status: "已上市", amount: "发行价10.42港元/股；市值100.6亿港元", currency: "HKD"});
p2[5] = event("P2", 5, {company: "DeepSeek", business: "研发通用人工智能大模型。", status: "进行中（本批来源称寻求融资）", amount: "寻求500亿元人民币"});

const p3Businesses = [
  "研发半导体电子芯片。",
  "研发先进复合材料制造技术。",
  "研发商业航天运载火箭。",
  "研发新能源核聚变装置。",
  "研发量子计算系统。",
  "研发创新生物医药产品。",
  "提供高技术专业服务。",
];
const p3 = Array.from({length: 37}, (_, index) => event("P3", index, {business: p3Businesses[index % p3Businesses.length]}));

export const sanitizedWeeklyEnrichmentFixture = {
  schemaVersion: "1.0.0",
  batch: "SANITIZED_FIXTURE",
  businessDates: ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"],
  generatedAt: "2026-08-10T22:30:00+08:00",
  inputEventCount: 82,
  sourceEventCount: 89,
  excludedP4Count: 7,
  events: [...p1, ...p2, ...p3],
  excludedP4: Array.from({length: 7}, (_, index) => ({
    eventKey: `event-sanitized-p4-${index}`,
    companyNameOriginal: `P4-SANITIZED-${index}`,
    relevanceTier: "P4" as const,
  })),
} as const;
