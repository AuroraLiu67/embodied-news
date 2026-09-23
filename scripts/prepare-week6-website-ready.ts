import {createHash} from "node:crypto";
import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";

import {z} from "zod";

import {safePublicHttpUrlSchema} from "../lib/domain/schemas/primitives";
import {
  classifyP3Industry,
  classifyRelevanceSubcategory,
  deriveCapitalEventLabel,
  weeklyPreviewProjectionSchema,
} from "../lib/pipeline/weekly-preview-projection";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const WEEK_START = "2026-09-07";
const WEEK_END = "2026-09-13";
const SOURCE_URL = "https://www.chinamoney.org.cn/chinese/ccprnoticecontent/index.html?searchDate=2026-09-11";

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const sourceEventSchema = z.object({
  company: requiredText(300),
  reportDate: z.iso.date(),
  eventDate: requiredText(64).nullable(),
  relevanceTier: z.enum(["P1", "P2", "P3"]),
  introduction: requiredText(2_000),
  round: requiredText(300).optional(),
  amount: requiredText(500).optional(),
  investors: requiredText(1_000).optional(),
  sourceUrls: z.array(safePublicHttpUrlSchema).min(1).max(20),
  status: z.literal("READY"),
}).strict();

const sourceFileSchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.iso.datetime({offset: true}),
  businessDates: z.array(z.iso.date()).length(7),
  websiteReadyEventCount: z.number().int().nonnegative().max(5_000),
  relevanceDistribution: z.object({
    P1: z.number().int().nonnegative(),
    P2: z.number().int().nonnegative(),
    P3: z.number().int().nonnegative(),
    P4: z.literal(0),
  }).strict(),
  excludedCategories: z.array(requiredText(100)).max(30),
  linkAudit: z.object({status: requiredText(100)}).strict(),
  events: z.array(sourceEventSchema).max(5_000),
}).strict();

const regionOverlaySchema = z.object({
  schemaVersion: z.literal("1.0"),
  generatedAt: z.iso.datetime({offset: true}),
  inputEventCount: z.literal(64),
  allowedRegionScopes: z.array(z.enum(["CHINA", "OVERSEAS"])).length(2),
  events: z.array(z.object({
    company: requiredText(300),
    regionScope: z.enum(["CHINA", "OVERSEAS"]),
    evidence: safePublicHttpUrlSchema,
    decisionNote: requiredText(500),
  }).strict()).length(64),
  regionCounts: z.object({CHINA: z.literal(53), OVERSEAS: z.literal(11)}).strict(),
}).strict();

type SourceEvent = z.infer<typeof sourceEventSchema>;
type Brief = {introduction: string; business: string; investorDisclosure: string | null};
type P3Row = {business: string; round: string; amount: string; investors: string; sourceUrl: string};

function companyKey(value: string): string {
  return value.normalize("NFKC").replace(/[\s/()（）]/g, "").toLocaleLowerCase("en-US");
}

function parseArguments() {
  const args = process.argv.slice(2);
  const [inputJson, inputMarkdown, regionOverlay] = args;
  const outputIndex = args.indexOf("--output");
  const amountOutputIndex = args.indexOf("--amount-output");
  const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const amountOutput = amountOutputIndex >= 0 ? args[amountOutputIndex + 1] : undefined;
  if (!inputJson || !inputMarkdown || !regionOverlay || !output || !amountOutput) {
    throw new Error("用法: prepare-week6-website-ready <ready.json> <ready.md> <region-overlay.json> --output <weekly.json> --amount-output <amount-summary.json>");
  }
  const inputs = new Set([resolve(inputJson), resolve(inputMarkdown), resolve(regionOverlay)]);
  if (inputs.has(resolve(output)) || inputs.has(resolve(amountOutput))) throw new Error("输出不得覆盖只读Ready输入");
  return {inputJson, inputMarkdown, regionOverlay, output, amountOutput};
}

function section(markdown: string, start: string, end: string): string {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Ready Markdown缺少章节: ${start}`);
  return markdown.slice(startIndex + start.length, endIndex);
}

function withoutMarkdownLinks(value: string): string {
  return value.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "").replace(/\s+/g, " ").trim();
}

function parseBriefs(markdown: string): Map<string, Brief> {
  const body = section(markdown, "## Physical AI相关事件简报", "## P3硬科技事件表");
  const briefs = new Map<string, Brief>();
  const pattern = /^### (.+?)（(P1|P2)）\n\n([\s\S]*?)(?=\n### |$)/gm;
  for (const match of body.matchAll(pattern)) {
    const company = match[1]?.trim();
    const paragraph = match[3]?.trim();
    if (!company || !paragraph) continue;
    const introduction = withoutMarkdownLinks(paragraph);
    const firstSentence = introduction.split("。", 1)[0]?.trim() ?? introduction;
    const business = firstSentence.startsWith(company)
      ? firstSentence.slice(company.length).replace(/^(?:聚焦|研发|建设|提供|面向|以|将)/, "").trim()
      : firstSentence;
    const investorDisclosure = introduction
      .split("。")
      .find((sentence) => /领投|跟投|参投|投资|追加|加码|参与/.test(sentence))
      ?.trim() ?? null;
    briefs.set(companyKey(company), {introduction, business: business || firstSentence, investorDisclosure});
  }
  return briefs;
}

function parseP3Rows(markdown: string): Map<string, P3Row> {
  const body = section(markdown, "## P3硬科技事件表", "## 已校正或剔除的来源问题");
  const rows = new Map<string, P3Row>();
  for (const line of body.split("\n")) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const company = cells[1];
    const business = cells[2];
    const round = cells[4];
    const amount = cells[5];
    const investors = cells[6];
    const sourceUrl = cells[7]?.match(/\((https?:\/\/[^)]+)\)/)?.[1];
    if (!company || !business || !round || !amount || !investors || !sourceUrl) throw new Error(`P3表格行无法解析: ${line}`);
    rows.set(company, {business, round, amount, investors, sourceUrl});
  }
  return rows;
}

function stableEventId(event: SourceEvent, round: string | null, amount: string | null): string {
  const digest = createHash("sha256")
    .update([event.company, event.reportDate, round ?? "", amount ?? ""].join("\u001f"))
    .digest("hex")
    .slice(0, 24);
  return `weekly-event-${digest}`;
}

function currencyFromAmount(amount: string | null): "CNY" | "USD" | "HKD" | "EUR" | null {
  if (!amount) return null;
  if (/美元/.test(amount)) return "USD";
  if (/欧元/.test(amount)) return "EUR";
  if (/港元/.test(amount)) return "HKD";
  if (/澳元|韩元|印度卢比/.test(amount)) return null;
  if (/元|亿元级|千万级/.test(amount)) return "CNY";
  return null;
}

function industryLabel(category: ReturnType<typeof classifyP3Industry>): string {
  return {
    SEMICONDUCTOR_ELECTRONICS: "半导体与电子",
    ADVANCED_MANUFACTURING_MATERIALS: "先进制造与材料",
    AEROSPACE_LOW_ALTITUDE: "商业航天与低空经济",
    ENERGY_FUSION: "新能源与核聚变",
    QUANTUM_TECH: "量子科技",
    BIOTECH_HEALTHCARE: "生物医药",
    OTHER_HARD_TECH: "其他硬科技",
  }[category];
}

const financingOverrides: Record<string, {round?: string | null; amount?: string | null}> = {
  "费莫一科技 PHYMI": {round: "种子轮", amount: "近1亿美元"},
  "影目科技 INMO": {round: "C3轮", amount: "近10亿元（C1至C3累计）"},
  "斯年智驾": {round: "新一轮战略融资", amount: null},
  "Harvey": {round: "新一轮融资", amount: "5.5亿美元"},
  "Motive": {round: "客户价值增长融资", amount: "超13亿美元"},
  "IPTAG": {round: "战略融资", amount: "千万级"},
  "烨知心 Yeats.AI": {round: "Pre-A轮", amount: null},
  "超维动力 Kinetix AI": {round: "天使+轮系列", amount: "超5亿元（系列披露）"},
  "航链科技": {round: "天使轮", amount: null},
  "元始智能科技（南通）": {round: "Pre-A与Pre-A+两轮", amount: "数千万元（两轮合计）"},
  "AIDIN Robotics": {round: "战略融资", amount: "160亿韩元"},
};

function financingDetails(event: SourceEvent, brief: Brief | undefined, p3: P3Row | undefined): {round: string | null; amount: string | null} {
  if (event.relevanceTier === "P3") return {round: p3?.round ?? event.round ?? null, amount: p3?.amount ?? event.amount ?? null};
  const text = brief?.introduction ?? event.introduction;
  const amount = text.match(/(?:超|超过|近|约)?(?:\d+(?:\.\d+)?(?:亿|万)(?:美元|欧元|港元|澳元|韩元|印度卢比|元人民币|元)?|数十亿元|数亿元|亿元级|数千万元|千万元|千万级|亿美元|亿元)/)?.[0]
    ?.replace(/^超过/, "超") ?? null;
  const round = text.match(/(?:Pre-seed|Pre-[A-Z]\+{0,2}\d*|[A-Z]\+{0,2}\d*|种子\+?|天使\+?|首|新一|战略)轮/i)?.[0] ?? null;
  const override = financingOverrides[event.company];
  return {
    round: override?.round === undefined ? round : override.round,
    amount: override?.amount === undefined ? amount : override.amount,
  };
}

const domesticSingleRoundTop10 = [
  {rank: 1, company: "微纳核芯", originalAmount: "10亿元", normalizedAmount: "10亿元", basis: "C1轮", note: "人民币单轮股权融资"},
  {rank: 2, company: "费莫一科技 PHYMI", originalAmount: "近1亿美元", normalizedAmount: "近6.77亿元", basis: "种子轮", note: "按2026-09-11美元中间价折算"},
  {rank: 3, company: "亮亮视野 LLVision", originalAmount: "超3亿元", normalizedAmount: "超3亿元", basis: "C+轮", note: "人民币单轮股权融资"},
  {rank: 4, company: "矩量光启", originalAmount: "3亿元", normalizedAmount: "3亿元", basis: "天使+轮", note: "人民币单轮股权融资"},
  {rank: 5, company: "纵苇科技", originalAmount: "2亿元", normalizedAmount: "2亿元", basis: "Pre-C++轮", note: "人民币单轮股权融资"},
  {rank: 6, company: "赛那德 SENAD", originalAmount: "近2亿元", normalizedAmount: "近2亿元", basis: "C+轮", note: "人民币单轮股权融资；同量级按Ready顺序"},
  {rank: 7, company: "博格科技", originalAmount: "近2亿元", normalizedAmount: "近2亿元", basis: "B轮", note: "人民币单轮股权融资；同量级按Ready顺序"},
  {rank: 8, company: "莱檬生物", originalAmount: "近2亿元", normalizedAmount: "近2亿元", basis: "B轮", note: "人民币单轮股权融资；同量级按Ready顺序"},
  {rank: 9, company: "阿法龙", originalAmount: "超亿元", normalizedAmount: "超1亿元", basis: "B轮", note: "人民币单轮股权融资；同量级按Ready顺序"},
  {rank: 10, company: "曦融兆波", originalAmount: "超亿元", normalizedAmount: "超1亿元", basis: "A轮", note: "人民币单轮股权融资；同量级按Ready顺序"},
] as const;

const rankingMethodNote = "仅统计地域overlay确认为CHINA且金额可严格比较的单次股权融资；排除海外、模糊区间、累计融资、多轮或系列合计、债务、基金、并购、未交割、IPO、定增及再融资。影目科技、星测未来、烨知心、超维动力等累计或多轮披露不进入名次。";

async function main() {
  const {inputJson, inputMarkdown, regionOverlay, output, amountOutput} = parseArguments();
  const [jsonStats, markdownStats, overlayStats] = await Promise.all([stat(inputJson), stat(inputMarkdown), stat(regionOverlay)]);
  if (![jsonStats, markdownStats, overlayStats].every((metadata) => metadata.isFile() && metadata.size <= MAX_INPUT_BYTES)) {
    throw new Error("输入必须是小于或等于5 MiB的普通文件");
  }
  const [jsonText, markdown, overlayText] = await Promise.all([
    readFile(inputJson, "utf8"),
    readFile(inputMarkdown, "utf8"),
    readFile(regionOverlay, "utf8"),
  ]);
  const source = sourceFileSchema.parse(JSON.parse(jsonText) as unknown);
  const overlay = regionOverlaySchema.parse(JSON.parse(overlayText) as unknown);
  const briefs = parseBriefs(markdown);
  const p3Rows = parseP3Rows(markdown);
  const problems: string[] = [];
  const tierCount = (tier: "P1" | "P2" | "P3") => source.events.filter((event) => event.relevanceTier === tier).length;
  if (source.websiteReadyEventCount !== source.events.length) problems.push("websiteReadyEventCount与events数量不一致");
  for (const tier of ["P1", "P2", "P3"] as const) {
    if (tierCount(tier) !== source.relevanceDistribution[tier]) problems.push(`${tier}数量不一致`);
  }
  if (briefs.size !== tierCount("P1") + tierCount("P2")) problems.push("P1/P2简报数量不一致");
  if (p3Rows.size !== tierCount("P3")) problems.push("P3表格数量不一致");
  if (new Set(source.events.map((event) => event.company)).size !== source.events.length) problems.push("公司事件重复");
  if (overlay.inputEventCount !== source.events.length) problems.push("地域overlay事件数量与Ready不一致");
  if (new Set(overlay.events.map((event) => event.company)).size !== overlay.events.length) problems.push("地域overlay公司重复");
  if (new Set(overlay.allowedRegionScopes).size !== 2) problems.push("地域overlay允许值不完整");
  const overlayByCompany = new Map(overlay.events.map((event) => [event.company, event]));
  const actualRegionCounts = {
    CHINA: overlay.events.filter((event) => event.regionScope === "CHINA").length,
    OVERSEAS: overlay.events.filter((event) => event.regionScope === "OVERSEAS").length,
  };
  if (actualRegionCounts.CHINA !== overlay.regionCounts.CHINA || actualRegionCounts.OVERSEAS !== overlay.regionCounts.OVERSEAS) {
    problems.push("地域overlay分布计数不一致");
  }
  for (const event of source.events) {
    if (!overlayByCompany.has(event.company)) problems.push(`地域overlay缺少公司: ${event.company}`);
    if (event.relevanceTier === "P3") {
      const row = p3Rows.get(event.company);
      if (!row) problems.push(`缺少P3表格行: ${event.company}`);
      else if (row.sourceUrl !== event.sourceUrls[0]) problems.push(`P3来源不一致: ${event.company}`);
      if (!event.round || !event.amount || !event.investors) problems.push(`P3结构字段不完整: ${event.company}`);
    } else if (!briefs.has(companyKey(event.company))) {
      problems.push(`缺少P1/P2简报: ${event.company}`);
    }
  }
  const sourceByCompany = new Map(source.events.map((event) => [event.company, event]));
  if (overlay.events.some((event) => !sourceByCompany.has(event.company))) problems.push("地域overlay包含Ready外公司");
  if (new Set(domesticSingleRoundTop10.map((item) => item.company)).size !== 10) problems.push("国内单轮TOP10公司重复");
  if (domesticSingleRoundTop10.some((item, index) => item.rank !== index + 1)) problems.push("国内单轮TOP10排名不连续");
  for (const item of domesticSingleRoundTop10) {
    const event = sourceByCompany.get(item.company);
    if (!event) problems.push(`国内单轮TOP10公司不在Ready: ${item.company}`);
    if (overlayByCompany.get(item.company)?.regionScope !== "CHINA") problems.push(`国内单轮TOP10包含非中国公司: ${item.company}`);
    if (event) {
      const details = financingDetails(event, briefs.get(companyKey(event.company)), p3Rows.get(event.company));
      if (details.amount !== item.originalAmount || details.round !== item.basis) problems.push(`国内单轮TOP10金额或轮次与Ready不一致: ${item.company}`);
    }
    if (/累计|合计|系列|多轮|两轮|三轮|债务|债权|基金|并购|收购|未交割|IPO|上市|定增|配套募资/i.test(`${item.basis} ${item.originalAmount}`)) {
      problems.push(`国内单轮TOP10包含排除类型: ${item.company}`);
    }
  }
  const nantongOrigin = sourceByCompany.get("元始智能科技（南通）");
  if (!nantongOrigin?.introduction.includes("须与深圳RWKV元始智能区分")) problems.push("元始智能主体区分说明缺失");
  if (problems.length > 0) throw new Error(problems.join("；"));

  const events = source.events.map((event, index) => {
    const brief = briefs.get(companyKey(event.company));
    const p3 = p3Rows.get(event.company);
    const {round, amount} = financingDetails(event, brief, p3);
    const companyBusiness = brief?.business ?? p3?.business ?? "业务未明确";
    const relevanceRationale = `${event.relevanceTier} Ready公开稿分类`;
    const industryCategory = event.relevanceTier === "P3"
      ? classifyP3Industry({companyBusiness, products: [], coreTechnology: [], relevanceRationale})
      : null;
    const relevanceSubcategory = classifyRelevanceSubcategory({
      relevanceTier: event.relevanceTier,
      relevanceRationale,
      companyBusiness,
      products: [],
      coreTechnology: [],
      introduction: brief?.introduction ?? null,
    });
    const investorDisclosure = brief?.investorDisclosure ?? p3?.investors ?? null;
    return {
      id: stableEventId(event, round, amount),
      companyStandardName: event.company,
      companyDisplayName: event.company,
      companyEnglishName: null,
      regionScope: overlayByCompany.get(event.company)!.regionScope,
      relevanceTier: event.relevanceTier,
      relevanceSubcategory,
      industryCategory,
      industryLabel: industryCategory ? industryLabel(industryCategory) : null,
      businessLabel: event.relevanceTier === "P3" ? companyBusiness : null,
      capitalEventLabel: event.relevanceTier === "P3"
        ? deriveCapitalEventLabel({financingStatus: "已完成", round})
        : null,
      displayPriority: index + 1,
      priorityReason: `${event.relevanceTier};Ready源文件顺序${index + 1}`,
      officialWebsite: null,
      introduction: brief?.introduction ?? null,
      companyBusiness,
      products: [],
      coreTechnology: [],
      foundingTeam: [],
      financingStatus: "已完成",
      round,
      amount,
      currency: currencyFromAmount(amount),
      leadInvestors: [],
      followInvestors: [],
      otherInvestors: investorDisclosure && !/未披露|未完整披露/.test(investorDisclosure)
        ? [investorDisclosure.slice(0, 300)]
        : [],
      financialAdviser: null,
      useOfFunds: null,
      valuation: null,
      cumulativeFunding: /累计|系列|两轮合计/.test(amount ?? "") ? amount : null,
      sources: event.sourceUrls.map((url) => ({url, publishedAt: event.reportDate})),
    };
  });

  const projection = weeklyPreviewProjectionSchema.parse({
    schemaVersion: "1",
    mode: "PREVIEW",
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    counts: {
      original: source.websiteReadyEventCount,
      excludedP4: 0,
      public: source.events.length,
      P1: tierCount("P1"),
      P2: tierCount("P2"),
      P3: tierCount("P3"),
    },
    events,
  });
  const amountSummary = {
    schemaVersion: "1.0.0",
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    currencyNormalization: {
      rateDate: "2026-09-11",
      usdToCny: 6.7743,
      eurToCny: 7.8367,
      sourceName: "中国外汇交易中心",
      sourceUrl: SOURCE_URL,
      note: "折算值仅用于国内单轮融资横向比较，保留约、超、近等原始限定词。",
    },
    rankingMethodNote,
    singleRoundRanking: domesticSingleRoundTop10,
    cumulativeFundingDisclosures: [
      {company: "影目科技 INMO", amount: "C轮累计近10亿元", basis: "C1至C3累计，不作为C3单轮金额"},
      {company: "超维动力 Kinetix AI", amount: "天使+轮系列超5亿元", basis: "系列披露，不作为单一子轮"},
      {company: "烨知心 Yeats.AI", amount: "成立以来三轮累计近10亿元", basis: "Pre-A本轮金额未披露"},
      {company: "佳量脑科学", amount: "累计数亿元", basis: "C轮与D轮累计"},
      {company: "旌晟超导", amount: "近亿元", basis: "种子轮与天使轮两轮合计"},
      {company: "元始智能科技（南通）", amount: "数千万元", basis: "Pre-A与Pre-A+两轮合计；非深圳RWKV主体"},
    ],
  };

  await Promise.all([mkdir(dirname(output), {recursive: true}), mkdir(dirname(amountOutput), {recursive: true})]);
  await Promise.all([
    writeFile(output, `${JSON.stringify(projection, null, 2)}\n`, "utf8"),
    writeFile(amountOutput, `${JSON.stringify(amountSummary, null, 2)}\n`, "utf8"),
  ]);
  process.stdout.write(`${JSON.stringify({output, amountOutput, counts: projection.counts})}\n`);
}

void main();
