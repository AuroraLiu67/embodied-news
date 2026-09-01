import {readFile, writeFile} from "node:fs/promises";

const INPUT = "融资新闻-周汇总-2026-08-24-0830.md";
const OUTPUT_JSON = "docs/pilot/2026-08-24-to-30-capital-weekly-ready.json";
const OUTPUT_MD = "docs/pilot/2026-08-24-to-30-capital-weekly-ready.md";

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

function cleanCompany(value: string): string {
  return value.replace(/（(?:英|美|匈|印)）$/, "").trim();
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
    return {
      company: cleanCompany(company), round, amount, investors,
      sourcesMarkdown: `[来源1](${sourceUrl})`,
      reportDate: `2026-${date.replace("/", "-").padStart(5, "0")}`,
      sourceUrls: [sourceUrl], relevanceTier,
      relevanceRationale: business,
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
      .map((event) => `### ${event.company}（${tier}）\n\n${event.relevanceRationale} ${event.sourcesMarkdown}`)
      .join("\n\n");
    return `## ${tier}\n\n${entries}`;
  });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(ready, null, 2)}\n`, "utf8");
  await writeFile(OUTPUT_MD, `# 2026-08-24—2026-08-30 网站发布准备\n\n${sections.join("\n\n")}\n\n## P3 明细\n`, "utf8");
  process.stdout.write(`${JSON.stringify({input: events.length, public: included.length, ...distribution})}\n`);
}

void main();
