import { describe, expect, it } from "vitest";
import {readFileSync} from "node:fs";

import weeklyProjection from "../public/data/weekly/2026-08-03.json";
import { site } from "../lib/site";
import currentProjection from "../public/data/weekly/2026-09-07.json";
import previousProjection from "../public/data/weekly/2026-08-31.json";
import archivedProjection from "../public/data/weekly/2026-08-24.json";
import secondArchivedProjection from "../public/data/weekly/2026-08-17.json";
import thirdArchivedProjection from "../public/data/weekly/2026-08-10.json";
import {archivedWeeklyReport, createWeeklyPreviewReport, currentAmountSummary, currentWeeklyReport, firstArchivedWeeklyReport, formatPrimaryInvestors, previousAmountSummary, previousWeeklyReport, secondArchivedWeeklyReport, thirdArchivedWeeklyReport, WEEKLY_PREVIEW_P1_COUNT, WEEKLY_PREVIEW_P2_COUNT, WEEKLY_PREVIEW_P3_COUNT, weeklyPreviewHighlight, weeklyPreviewSample} from "../lib/site/weekly-preview";
import {weeklyPreviewProjectionSchema} from "../lib/pipeline/weekly-preview-projection";
import {buildDomesticRanking, type DashboardRow} from "../app/dashboard/dashboard-client";

describe("site metadata", () => {
  it("provides the minimum homepage content", () => {
    expect(site.name).toBe("具身智能融资雷达");
    expect(site.eyebrow).toMatch(/Funding Radar/);
    expect(site.summary.length).toBeGreaterThan(20);
  });
});

describe("dashboard domestic ranking", () => {
  const row = (overrides: Partial<DashboardRow>): DashboardRow => ({
    id: "base", weekStart: "2026-08-24", weekLabel: "08.24—08.30", company: "测试公司", tier: "P1",
    region: "CHINA", round: "A轮", amount: "1亿元", currency: "CNY", financingStatus: "已完成",
    investors: "未披露", business: "测试业务", sourceUrl: "https://example.com/source", ...overrides,
  });

  it("switches ranking by week and uses only the primary financing amount", () => {
    const rows = [
      row({id: "xpeng", company: "小鹏机器人", amount: "超9亿美元（投后估值超63亿美元）", currency: "USD"}),
      row({id: "light", company: "光联芯科", amount: "近10亿元（估值超10亿美元）", currency: "USD"}),
      row({id: "laihua", weekStart: "2026-08-10", company: "来画", amount: "6800万元；投后估值约37亿元"}),
      row({id: "intent", weekStart: "2026-08-10", company: "意向公司", amount: "拟融资15亿元", financingStatus: "进行中"}),
    ];
    const rates = currentAmountSummary.currencyNormalization;
    expect(buildDomesticRanking(rows, "2026-08-24", rates).map((item) => item.company)).toEqual(["小鹏机器人", "光联芯科"]);
    expect(buildDomesticRanking(rows, "2026-08-10", rates).map((item) => [item.company, item.normalizedAmount])).toEqual([["来画", "0.68亿元"]]);
  });
});

describe("weekly preview sample", () => {
  it("uses the reviewed weekly-ready events for the 09-07 to 09-13 issue", () => {
    expect(currentWeeklyReport.weekStart).toBe("2026-09-07");
    expect(currentWeeklyReport.weekEnd).toBe("2026-09-13");
    expect(currentWeeklyReport.counts).toEqual({original: 64, excludedP4: 0, public: 64, P1: 19, P2: 25, P3: 20});
    expect(currentWeeklyReport.events).toHaveLength(64);
    const projectedDisplayOrder = (["P1", "P2", "P3"] as const).flatMap((tier) =>
      currentProjection.events.filter((event) => event.relevanceTier === tier).map((event) => event.companyDisplayName),
    );
    expect(currentWeeklyReport.events.map((event) => event.companyDisplayName)).toEqual(projectedDisplayOrder);
    expect(currentWeeklyReport.events.every((event) => event.sources.length === 1)).toBe(true);
    expect(currentWeeklyReport.events.find((event) => event.companyDisplayName === "赛那德 SENAD")?.introduction).toMatch(/近2亿元C\+轮融资/);
    expect(currentWeeklyReport.events.find((event) => event.companyDisplayName === "元始智能科技（南通）")?.introduction).toMatch(/须与深圳RWKV元始智能区分/);
    expect(currentWeeklyReport.events.every((event) => !event.introduction?.includes("## P"))).toBe(true);
    expect(currentWeeklyReport.events.some((event) => event.relevanceTier === ("P4" as never))).toBe(false);
    expect(currentWeeklyReport.events.filter((event) => event.regionScope === "CHINA")).toHaveLength(53);
    expect(currentWeeklyReport.events.filter((event) => event.regionScope === "OVERSEAS")).toHaveLength(11);
    expect(currentWeeklyReport.events.every((event) => event.regionScope !== null)).toBe(true);
    expect(currentProjection.events.every((event) => Boolean(event.companyBusiness))).toBe(true);
    expect(currentWeeklyReport.events.filter((event) => event.relevanceTier !== "P3").every((event) => Boolean(event.introduction?.trim()))).toBe(true);
    expect(JSON.stringify(currentWeeklyReport.events)).not.toMatch(/fieldEvidence|missingFields|conflicts|accessLimitations|researchStatus|appSecret|tenantAccessToken|P4/);
  });

  it("keeps all five previous issues available as complete archives", () => {
    expect(previousWeeklyReport.weekStart).toBe("2026-08-31");
    expect(previousWeeklyReport.weekEnd).toBe("2026-09-06");
    expect(previousWeeklyReport.counts).toEqual({original: 58, excludedP4: 0, public: 58, P1: 12, P2: 29, P3: 17});
    expect(previousWeeklyReport.events.map((event) => event.companyDisplayName)).toEqual((["P1", "P2", "P3"] as const).flatMap((tier) => previousProjection.events.filter((event) => event.relevanceTier === tier).map((event) => event.companyDisplayName)));
    expect(archivedWeeklyReport.weekStart).toBe("2026-08-24");
    expect(archivedWeeklyReport.counts).toEqual({original: 75, excludedP4: 7, public: 68, P1: 21, P2: 26, P3: 21});
    expect(archivedWeeklyReport.events.map((event) => event.companyDisplayName)).toEqual((["P1", "P2", "P3"] as const).flatMap((tier) => archivedProjection.events.filter((event) => event.relevanceTier === tier).map((event) => event.companyDisplayName)));
    expect(secondArchivedWeeklyReport.weekStart).toBe("2026-08-17");
    expect(secondArchivedWeeklyReport.counts).toEqual({original: 72, excludedP4: 4, public: 68, P1: 13, P2: 20, P3: 35});
    expect(secondArchivedWeeklyReport.events.map((event) => event.companyDisplayName)).toEqual((["P1", "P2", "P3"] as const).flatMap((tier) => secondArchivedProjection.events.filter((event) => event.relevanceTier === tier).map((event) => event.companyDisplayName)));
    expect(thirdArchivedWeeklyReport.weekStart).toBe("2026-08-10");
    expect(thirdArchivedWeeklyReport.counts).toEqual({original: 67, excludedP4: 0, public: 67, P1: 15, P2: 21, P3: 31});
    expect(thirdArchivedWeeklyReport.events.map((event) => event.companyDisplayName)).toEqual((["P1", "P2", "P3"] as const).flatMap((tier) => thirdArchivedProjection.events.filter((event) => event.relevanceTier === tier).map((event) => event.companyDisplayName)));
    expect(firstArchivedWeeklyReport.weekStart).toBe("2026-08-03");
    expect(firstArchivedWeeklyReport.events).toHaveLength(82);
  });

  it("binds each recent archive route to its matching report", () => {
    expect(readFileSync("app/archive/2026-08-31-to-2026-09-06/page.tsx", "utf8")).toContain("report={previousWeeklyReport}");
    expect(readFileSync("app/archive/2026-08-24-to-2026-08-30/page.tsx", "utf8")).toContain("report={archivedWeeklyReport}");
    expect(readFileSync("app/archive/2026-08-17-to-2026-08-23/page.tsx", "utf8")).toContain("report={secondArchivedWeeklyReport}");
    expect(readFileSync("app/archive/2026-08-10-to-2026-08-16/page.tsx", "utf8")).toContain("report={thirdArchivedWeeklyReport}");
  });

  it("uses document navigation between static weekly editions", () => {
    const pageSource = readFileSync("app/weekly-report-page.tsx", "utf8");
    expect(pageSource).toContain('<a key={week.weekStart} href={staticWeekHref(week.href)}');
    expect(pageSource).not.toContain('from "next/link"');
  });

  it("uses the reviewed domestic single-round ranking and separates cumulative disclosures", () => {
    const publishedCompanies = new Set(currentWeeklyReport.events.map((event) => event.companyDisplayName));
    const domesticCompanies = new Set(currentWeeklyReport.events.filter((event) => event.regionScope === "CHINA").map((event) => event.companyDisplayName));
    expect(currentAmountSummary.singleRoundRanking).toHaveLength(10);
    expect(currentAmountSummary.singleRoundRanking.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(currentAmountSummary.singleRoundRanking.every((item) => publishedCompanies.has(item.company))).toBe(true);
    expect(currentAmountSummary.singleRoundRanking.every((item) => domesticCompanies.has(item.company))).toBe(true);
    expect(currentAmountSummary.singleRoundRanking[0]).toMatchObject({company: "微纳核芯", normalizedAmount: "10亿元"});
    expect(currentAmountSummary.singleRoundRanking.every((item) => !/累计|合计|系列|多轮|两轮|三轮|债务|基金|并购|收购|未交割|IPO|上市|定增/.test(`${item.originalAmount} ${item.basis}`))).toBe(true);
    expect(currentAmountSummary.singleRoundRanking.map((item) => item.company)).not.toEqual(expect.arrayContaining(["The Boring Company", "Cognition AI", "Motive", "影目科技 INMO", "超维动力 Kinetix AI", "烨知心 Yeats.AI", "元始智能科技（南通）"]));
    expect(currentAmountSummary.rankingMethodNote).toMatch(/排除海外、模糊区间、累计融资、多轮或系列合计、债务、基金、并购、未交割、IPO、定增及再融资/);
    expect(currentAmountSummary.cumulativeFundingDisclosures.map((item) => item.company)).toEqual(expect.arrayContaining(["影目科技 INMO", "超维动力 Kinetix AI", "烨知心 Yeats.AI", "佳量脑科学", "旌晟超导", "元始智能科技（南通）"]));
    expect(currentAmountSummary.currencyNormalization).toMatchObject({rateDate: "2026-09-11", usdToCny: 6.7743, eurToCny: 7.8367});
  });

  it("uses the curated sixth- and fifth-week domestic rankings and keeps all previous weekly rankings", () => {
    const reports = [currentWeeklyReport, previousWeeklyReport, archivedWeeklyReport, secondArchivedWeeklyReport, thirdArchivedWeeklyReport, firstArchivedWeeklyReport];
    const rows: DashboardRow[] = reports.flatMap((report) => report.events.map((event) => ({
      id: `${report.weekStart}-${event.companyDisplayName}`,
      weekStart: report.weekStart,
      weekLabel: `${report.weekStart.slice(5)}—${report.weekEnd.slice(5)}`,
      company: event.companyDisplayName,
      tier: event.relevanceTier,
      region: event.regionScope,
      round: event.round,
      amount: event.amount,
      currency: event.currency,
      financingStatus: event.financingStatus,
      investors: formatPrimaryInvestors(event),
      business: event.introduction ?? event.businessLabel ?? "未披露",
      sourceUrl: event.sources[0]!.url,
    })));
    const curated = [currentAmountSummary, previousAmountSummary];
    const currentRanking = buildDomesticRanking(rows, "2026-09-07", currentAmountSummary.currencyNormalization, curated);
    expect(currentRanking).toHaveLength(10);
    expect(currentRanking[0]?.company).toBe("微纳核芯");
    expect(currentRanking.every((item) => item.region === "CHINA")).toBe(true);
    expect(currentRanking.map((item) => item.company)).toEqual(currentAmountSummary.singleRoundRanking.map((item) => item.company));
    expect(["2026-08-31", "2026-08-24", "2026-08-17", "2026-08-10", "2026-08-03"].map((week) =>
      buildDomesticRanking(rows, week, currentAmountSummary.currencyNormalization, curated)[0]?.company,
    )).toEqual(["可灵AI", "小鹏机器人（鹏行智能）", "垣信卫星", "谦合益邦", "昉擎科技"]);
  });

  it("provides an interactive dashboard route over all six public editions", () => {
    const dashboardSource = readFileSync("app/dashboard/dashboard-client.tsx", "utf8");
    const dashboardPageSource = readFileSync("app/dashboard/page.tsx", "utf8");
    expect(dashboardSource).toContain('"use client"');
    expect(dashboardSource).toContain("setWeek");
    expect(dashboardSource).toContain("setTier");
    expect(dashboardSource).toContain("setRegion");
    expect(dashboardSource).toContain("国内单轮融资 TOP 10");
    expect(dashboardSource).toContain("buildDomesticRanking(rows, week");
    expect(dashboardSource).toContain("item.cnyAmount / rankingMaximum");
    expect(dashboardSource).toContain("榜单随周次切换");
    expect(dashboardPageSource).toContain("reports.flatMap(toRows)");
    expect(dashboardSource).toContain("allIssuesLabel");
    expect(currentWeeklyReport.events.length + previousWeeklyReport.events.length + archivedWeeklyReport.events.length + secondArchivedWeeklyReport.events.length + thirdArchivedWeeklyReport.events.length + firstArchivedWeeklyReport.events.length).toBe(407);
  });

  it("preserves every Ready event and primary source at the public projection boundary", () => {
    const ready = JSON.parse(readFileSync("docs/pilot/2026-09-07-to-2026-09-13-capital-weekly-ready.json", "utf8")) as {
      websiteReadyEventCount: number;
      events: Array<{company: string; sourceUrls: string[]}>;
    };
    const projection = weeklyPreviewProjectionSchema.parse(currentProjection);
    const report = createWeeklyPreviewReport(projection);
    expect(ready.websiteReadyEventCount).toBe(64);
    expect(projection.events).toHaveLength(ready.events.length);
    expect(projection.events.map((event) => event.companyDisplayName)).toEqual(ready.events.map((event) => event.company));
    expect(projection.events.map((event) => event.sources.map((source) => source.url))).toEqual(ready.events.map((event) => event.sourceUrls));
    expect(report.events.every((event) => event.sources.length === 1)).toBe(true);
  });

  it("applies the sixth-week region overlay one-to-one", () => {
    const overlay = JSON.parse(readFileSync("docs/pilot/2026-09-07-to-2026-09-13-region-overlay.json", "utf8")) as {
      inputEventCount: number;
      regionCounts: {CHINA: number; OVERSEAS: number};
      events: Array<{company: string; regionScope: "CHINA" | "OVERSEAS"}>;
    };
    expect(overlay.inputEventCount).toBe(64);
    expect(overlay.regionCounts).toEqual({CHINA: 53, OVERSEAS: 11});
    expect(currentProjection.events.map((event) => [event.companyDisplayName, event.regionScope])).toEqual(
      overlay.events.map((event) => [event.company, event.regionScope]),
    );
  });
  it("selects all 18 P1 events in their existing public projection order", () => {
    const projectedP1Names = weeklyProjection.events
      .filter((event) => event.relevanceTier === "P1")
      .map((event) => event.companyDisplayName);
    expect(WEEKLY_PREVIEW_P1_COUNT).toBe(18);
    expect(weeklyPreviewSample.p1Events).toHaveLength(18);
    expect(weeklyPreviewSample.p1Events.map((event) => event.companyDisplayName)).toEqual(projectedP1Names);
    expect(projectedP1Names).toHaveLength(18);
  });

  it("selects all 27 P2 events in their existing public projection order", () => {
    const projectedP2Names = weeklyProjection.events
      .filter((event) => event.relevanceTier === "P2")
      .map((event) => event.companyDisplayName);
    expect(WEEKLY_PREVIEW_P2_COUNT).toBe(27);
    expect(weeklyPreviewSample.p2Events).toHaveLength(27);
    expect(weeklyPreviewSample.p2Events.map((event) => event.companyDisplayName)).toEqual(projectedP2Names);
    expect(weeklyPreviewSample.p1Events.length + weeklyPreviewSample.p2Events.length).toBe(45);
  });

  it("selects all 37 P3 events in projection order with table fields", () => {
    const projectedP3 = weeklyProjection.events.filter((event) => event.relevanceTier === "P3");
    expect(WEEKLY_PREVIEW_P3_COUNT).toBe(37);
    expect(weeklyPreviewSample.p3Events).toHaveLength(37);
    expect(weeklyPreviewSample.p3Events.map((event) => event.companyDisplayName)).toEqual(projectedP3.map((event) => event.companyDisplayName));
    expect(weeklyPreviewSample.p3Events.every((event) => Boolean(event.industryCategory && event.industryLabel && event.businessLabel && event.capitalEventLabel))).toBe(true);
    expect(weeklyPreviewSample.events).toHaveLength(82);
  });

  it("contains every newly added P1 company", () => {
    const names = weeklyPreviewSample.p1Events.map((event) => event.companyDisplayName);
    expect(names).toEqual(expect.arrayContaining([
      "橡树清溪科技", "自变量机器人", "灵波科技", "方石机器人", "若创科技", "鹰瞰智翼", "恺望数据",
      "Ropedia", "术也科技", "风火轮萤图", "极稳科技", "真觉万象", "深圳光年领航科技",
    ]));
  });

  it("contains P1/P2 introductions, no P4, and no internal projection fields", () => {
    expect(weeklyPreviewSample.mode).toBe("PREVIEW");
    expect(weeklyPreviewSample.p1Events.every((event) => event.relevanceTier === "P1")).toBe(true);
    expect(weeklyPreviewSample.p2Events.every((event) => event.relevanceTier === "P2")).toBe(true);
    expect([...weeklyPreviewSample.p1Events, ...weeklyPreviewSample.p2Events].every((event) => Boolean(event.introduction?.trim()))).toBe(true);
    const renderedData = JSON.stringify(weeklyPreviewSample.events);
    expect(renderedData).not.toMatch(/fieldEvidence|missingFields|conflicts|accessLimitations|researchStatus|priorityReason|displayPriority|event-[a-z0-9]+|P4/);
  });

  it("uses exactly the public projection sources[0] for every displayed event", () => {
    expect(weeklyPreviewSample.events.every((event) => event.sources.length === 1)).toBe(true);
    expect(weeklyPreviewSample.events.find((event) => event.companyDisplayName === "帕西尼")?.sources).toEqual([
      {url: "https://36kr.com/p/3923645916409479", publishedAt: "2026-08-03 18:29"},
    ]);
    expect(weeklyPreviewSample.events.map((event) => event.sources[0])).toEqual(weeklyProjection.events.map((event) => event.sources[0]));
  });

  it("limits the P3 investor display to three names and reports the full count", () => {
    expect(formatPrimaryInvestors({leadInvestors: ["A", "B"], followInvestors: ["C"], otherInvestors: ["D"]})).toBe("A、B、C等4家");
    expect(formatPrimaryInvestors({leadInvestors: [], followInvestors: [], otherInvestors: []})).toBe("未披露");
  });

  it("derives the highest disclosed CNY capital amount without treating intent or IPO values as financing", () => {
    expect(weeklyPreviewHighlight).toMatchObject({company: "武汉奕材", amount: "65亿元人民币", event: "战略增资", status: "进行中"});
    expect(weeklyPreviewHighlight.scopeNote).toMatch(/不换汇.*融资意向.*IPO/);
  });
});
