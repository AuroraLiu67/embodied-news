import {readFile, writeFile} from "node:fs/promises";

const INPUT = "融资新闻-周汇总-2026-08-24-0830.md";
const OUTPUT_JSON = "docs/pilot/2026-08-24-to-30-capital-weekly-ready.json";
const OUTPUT_MD = "docs/pilot/2026-08-24-to-30-capital-weekly-ready.md";
const OUTPUT_AMOUNT_SUMMARY = "public/data/weekly/2026-08-24-amount-summary.json";

const amountSummary = {
  schemaVersion: "1.0.0", weekStart: "2026-08-24", weekEnd: "2026-08-30",
  currencyNormalization: {rateDate: "2026-08-28", usdToCny: 6.7811, eurToCny: 7.8683, sourceName: "中国外汇交易中心", sourceUrl: "https://www.chinamoney.org.cn/chinese/ccprnoticecontent/index.html?searchDate=2026-08-28", note: "折算值仅用于本周横向比较，保留原始金额及超、近、约等限定词。"},
  singleRoundRanking: [
    {rank: 1, company: "小鹏机器人（鹏行智能）", originalAmount: "超9亿美元", normalizedAmount: "超61.03亿元", basis: "首轮融资"},
    {rank: 2, company: "曦望Sunrise", originalAmount: "20亿元", normalizedAmount: "20亿元", basis: "本轮股权融资"},
    {rank: 3, company: "研微半导体", originalAmount: "近15亿元", normalizedAmount: "近15亿元", basis: "B轮"},
    {rank: 4, company: "光联芯科", originalAmount: "近10亿元", normalizedAmount: "近10亿元", basis: "A+轮"},
    {rank: 5, company: "浩博医药", originalAmount: "1.2亿美元", normalizedAmount: "约8.14亿元", basis: "C轮"},
    {rank: 6, company: "灵初智能", originalAmount: "超1亿美元", normalizedAmount: "超6.78亿元", basis: "A轮；保守口径"},
    {rank: 7, company: "洛阳LYC轴承", originalAmount: "6.65亿元", normalizedAmount: "6.65亿元", basis: "战略投资"},
    {rank: 8, company: "基元律动", originalAmount: "数千万美元", normalizedAmount: "约1.36亿元起", basis: "新一轮；按2000万美元下限折算"},
    {rank: 9, company: "艾联纳医药（ALLYRNA）", originalAmount: "超亿元", normalizedAmount: "超1亿元", basis: "种子+轮"},
    {rank: 10, company: "材科源图（MatSource）", originalAmount: "超亿元", normalizedAmount: "超1亿元", basis: "连续两轮；同量级按公开投影顺序"},
  ],
  cumulativeFundingDisclosures: [
    {company: "Sharpa", amount: "累计超45亿元", basis: "累计融资披露"}, {company: "蜂巢互联", amount: "12亿元", basis: "数月内两轮合计"},
    {company: "智辰半导体", amount: "累计超10亿元", basis: "天使轮系列累计"}, {company: "明视脑机（Mindtrix）", amount: "累计约5亿元", basis: "天使轮与Pre-A系列累计"},
    {company: "晰见科技", amount: "累计近5亿元", basis: "连续三轮天使融资累计"}, {company: "涌泉创新（ToolDance）", amount: "累计数亿元", basis: "历史累计融资"},
  ],
} as const;

function amountSummaryMarkdown(): string {
  const rankingRows = amountSummary.singleRoundRanking.map((item) => `| ${item.rank} | ${item.company} | ${item.originalAmount} | **${item.normalizedAmount}** | ${item.basis} |`).join("\n");
  const cumulative = amountSummary.cumulativeFundingDisclosures.map((item) => `${item.company}${item.amount}（${item.basis}）`).join("；");
  return `## 本周国内公司单轮融资额排名\n\n> TOP 10仅统计中国公司。统一按${amountSummary.currencyNormalization.rateDate}中国外汇交易中心人民币汇率中间价折算：1美元=${amountSummary.currencyNormalization.usdToCny}元人民币、1欧元=${amountSummary.currencyNormalization.eurToCny}元人民币。${amountSummary.currencyNormalization.note}\n\n| 排名 | 公司 | 原始披露金额 | 统一折合人民币 | 口径 |\n|---:|---|---:|---:|---|\n${rankingRows}\n\n累计融资与多轮合计不与单轮融资混排：${cumulative}。\n\n[汇率基准：中国外汇交易中心](${amountSummary.currencyNormalization.sourceUrl})`;
}

const p1 = new Set([
  "小鹏机器人（鹏行智能）", "枢途科技", "食铁兽科技（PANDAG）", "Embedd（英）", "Oshen（英）",
  "影子科技（In2Mate）", "邻家桥科技", "Airbound（印）", "简智机器人（GenRobot.AI）", "迈步机器人",
  "灵御智能", "Transfyr（美）", "灵初智能", "蜂巢互联", "星际觅元", "优理奇机器人（UniX AI）",
  "拉塞特机器人", "Sharpa", "松应科技", "瞬适科技（InstAdapt）", "灵掌科技",
]);
const p2 = new Set([
  "涌泉创新（ToolDance）", "锐莱热控", "明视脑机（Mindtrix）", "脑器时代", "力磅科技", "穿越者（载人航天）",
  "炎和科技", "屹艮科技", "托尔时代", "材科源图（MatSource）", "松正航空动力", "芯光界", "中微达信",
  "智辰半导体", "洛阳LYC轴承", "原力引擎", "星邑空间", "灵络科技", "Groq（美）", "Agentrys（美）",
  "晰见科技", "沐创", "光联芯科", "全脑芯科", "元启半导体", "鸣石峻致",
]);
const p4 = new Set(["BOOKR（匈）", "呈白", "Primit", "Unrivaled（美）", "Rox（美）", "Yardstik（美）", "Owner（美）"]);

const urlOverrides: Record<string, string> = {
  "Embedd（英）": "https://techfundingnews.com/seedcamp-leads-2-7m-round-for-ukrainian-founded-physical-ai-startup-embedd/",
  "Oshen（英）": "https://www.eu-startups.com/2026/08/plymouth-based-oshen-raises-e4-27-million-to-scale-robot-swarms-that-act-as-the-oceans-eyes-and-ears/",
  "脑器时代": "https://www.cnstock.com/commonDetail/772921",
  "Airbound（印）": "https://techcrunch.com/2026/08/24/indias-airbound-bags-37m-to-take-on-trucks-with-rocket-like-drones/",
  "洛阳LYC轴承": "https://stock.stockstar.com/RB2026082800045636.shtml",
  "Muon Space（美）": "https://www.globenewswire.com/news-release/2026/08/20/3348230/0/en/muon-space-closes-250-million-series-c-to-scale-space-infrastructure.html",
  "Velaura AI（美）": "https://velaura.ai/velaura-ai-raises-110-million-series-a-to-advance-the-next-generation-of-ultra-low-power-ai-compute-infrastructure/",
  "Emerald AI（美）": "https://www.emeraldai.co/blog/150-million-series-a-valuation-investor-quotes",
  "Wispr AI（美）": "https://techcrunch.com/2026/08/17/wispr-raises-280m-at-2b-valuation-as-it-looks-beyond-dictation/",
  "Stability AI（美）": "https://www.prnewswire.com/apac/zh/news-releases/-stability-ai--302860583.html",
  "Unrivaled（美）": "https://www.prnewswire.com/news-releases/unrivaled-oversubscribes-series-c-fundraise-led-by-ten-pillars-sports-fund-exceeding-100-million-target-at-new-league-valuation-of-650-million-302860004.html",
  "Transfyr（美）": "https://www.transfyr.ai/news/transfyr-launches-physical-ai-platform-for-science-with-usd25m-seed-funding",
  "Agentrys（美）": "https://agentrys.ai/news/agentrys-raises-24-5-million",
  "基元律动": "https://www.chinaventure.com.cn/news/113-20260827-392980.html",
  "Sharpa": "https://www.nbd.com.cn/articles/2026-08-28/4563576.html",
  "浩博医药": "https://www.chinaventure.com.cn/news/111-20260828-392992.html",
  "鑫云生命": "https://wap.eastmoney.com/a/202608243851536063.html",
  "Metriport（美）": "https://www.metriport.com/blog/metriport-series-a",
  "Onos Health（美）": "https://onoshealth.com/news/onos-series-a-announcement/",
  "Soctera（美）": "https://www.soctera.com/post/soctera-raises-4-million-to-break-the-thermal-ceiling-of-defense-and-space-systems",
};

const businessOverrides: Record<string, string> = {
  "基元律动": "AI基础设施，提供开源Agent、模型API、智能路由与协同能力",
  "Soctera（美）": "研发高效功率放大器，提升高可靠无线系统的信号覆盖、保真度与热性能",
};
const investorOverrides: Record<string, string> = {
  "基元律动": "弘晖基金领投，聚合资本、尚势资本参投",
  "Soctera（美）": "Anorak Ventures、Multiball Capital，9Yards Capital、Mana Ventures、Red Bear Ventures参投",
};
const roundOverrides: Record<string, string> = {"基元律动": "新一轮"};
const amountOverrides: Record<string, string> = {"基元律动": "数千万美元"};
const productOverrides: Record<string, string[]> = {
  "小鹏机器人（鹏行智能）": ["IRON人形机器人"],
  "涌泉创新（ToolDance）": ["ToolDance X1桌面CNC设备"],
  "穿越者（载人航天）": ["穿越者壹号亚轨道飞船"],
  "食铁兽科技（PANDAG）": ["PANDAG G1割草机器人"],
  "脑器时代": ["全能一号运动BCI"],
  "Stability AI": ["Stable Diffusion"],
  "灵御智能": ["TA系列轮式夹爪机器人"],
  "晰见科技": ["天眸类脑视觉芯片"],
  "上海次元模因科技": ["Popi AI"],
  "松应科技": ["ORCA OS"],
  "迈之健医疗": ["HEALTH-AMS全屋智能体征系统"],
  "Soctera": ["功率放大器"],
  "基元律动": ["TokenRhythm API平台"],
};

function cleanCompany(value: string): string {
  return value.replace(/（(?:英|美|匈|印)）$/, "").trim();
}

function regionFromCompany(value: string): "CHINA" | "OVERSEAS" {
  return /（(?:英|美|匈|印)）$/.test(value) ? "OVERSEAS" : "CHINA";
}

function fullIntroduction(company: string, business: string, round: string, amount: string, investors: string): string {
  const financing = amount === "未披露" ? `完成${round}，融资金额未披露` : `完成${round}，融资金额为${amount}`;
  const investorSummary = /未披露|未完整披露|本轮机构未披露/.test(investors)
    ? "，投资方未完整披露"
    : `，披露的投资方包括${investors}`;
  return `${company}聚焦${business}。公司本次${financing}${investorSummary}。`;
}

async function main() {
  const markdown = await readFile(INPUT, "utf8");
  const rows = markdown.split("\n").filter((line) => /^\|[^-].*\|$/.test(line) && !line.includes("公司 | 轮次"));
  if (rows.length !== 76) throw new Error(`周汇总实际表格行数应为76，当前为${rows.length}`);
  const events = rows.map((line) => {
    const [company, round, amount, investors, date, business, linkCell] = line.split("|").slice(1, -1).map((item) => item.trim());
    const link = /\[[^\]]+\]\(([^)]+)\)/.exec(linkCell)?.[1];
    const sourceUrl = urlOverrides[company] ?? link;
    if (!sourceUrl || !/^https?:\/\//.test(sourceUrl)) throw new Error(`缺少公开HTTP来源: ${company}`);
    const relevanceTier = p1.has(company) ? "P1" : p2.has(company) ? "P2" : p4.has(company) ? "P4" : "P3";
    const companyName = cleanCompany(company);
    const companyBusiness = businessOverrides[company] ?? business;
    return {
      company: companyName,
      round: roundOverrides[company] ?? round,
      amount: amountOverrides[company] ?? amount,
      investors: investorOverrides[company] ?? investors,
      regionScope: regionFromCompany(company),
      companyBusiness,
      products: productOverrides[companyName] ?? [],
      sourcesMarkdown: `[来源1](${sourceUrl})`,
      reportDate: `2026-${date.replace("/", "-").padStart(5, "0")}`,
      sourceUrls: [sourceUrl], relevanceTier,
      relevanceRationale: companyBusiness,
      status: "READY_FROM_PROVIDED_SOURCE",
    } as const;
  });
  const distribution = {P1: 0, P2: 0, P3: 0, P4: 0};
  for (const event of events) distribution[event.relevanceTier] += 1;
  const included = events.filter((event) => event.relevanceTier !== "P4");
  const excluded = events.filter((event) => event.relevanceTier === "P4");
  const ready = {
    schemaVersion: "1.0.0", batch: "2026-08-24-to-2026-08-30",
    generatedAt: "2026-09-01T12:00:00+08:00", inputEventCount: events.length,
    websiteReadyEventCount: included.length, excludedP4Count: excluded.length,
    relevanceDistribution: distribution, events: included, excludedP4: excluded,
  };
  const sections = (["P1", "P2"] as const).map((tier) => {
    const entries = included.filter((event) => event.relevanceTier === tier)
      .map((event) => `### ${event.company}（${tier}）\n\n${fullIntroduction(event.company, event.companyBusiness, event.round, event.amount, event.investors)} ${event.sourcesMarkdown}`)
      .join("\n\n");
    return `## ${tier}\n\n${entries}`;
  });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  await writeFile(OUTPUT_AMOUNT_SUMMARY, `${JSON.stringify(amountSummary, null, 2)}\n`, "utf8");
  await writeFile(OUTPUT_MD, `# 2026-08-24—2026-08-30 网站发布准备\n\n${amountSummaryMarkdown()}\n\n${sections.join("\n\n")}\n\n## P3 明细\n`, "utf8");
  process.stdout.write(`${JSON.stringify({input: events.length, public: included.length, ...distribution})}\n`);
}

void main();
