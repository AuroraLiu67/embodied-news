import { describe, expect, it } from "vitest";

import weeklyProjection from "../public/data/weekly/2026-08-03.json";
import { site } from "../lib/site";
import {formatPrimaryInvestors, WEEKLY_PREVIEW_P1_COUNT, WEEKLY_PREVIEW_P2_COUNT, WEEKLY_PREVIEW_P3_COUNT, weeklyPreviewHighlight, weeklyPreviewSample} from "../lib/site/weekly-preview";

describe("site metadata", () => {
  it("provides the minimum homepage content", () => {
    expect(site.name).toBe("具身智能融资雷达");
    expect(site.eyebrow).toMatch(/Funding Radar/);
    expect(site.summary.length).toBeGreaterThan(20);
  });
});

describe("weekly preview sample", () => {
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
