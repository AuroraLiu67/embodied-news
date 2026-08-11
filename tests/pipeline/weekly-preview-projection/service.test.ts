import {describe, expect, it} from "vitest";

import {
  generateWeeklyPreviewProjection,
  financingStatusRank,
  classifyP3Industry,
  deriveBusinessLabel,
  deriveCapitalEventLabel,
  MAX_WEEKLY_PREVIEW_FILE_BYTES,
  parseAmountSortBucket,
  parseWeeklyEnrichment,
  serializeWeeklyPreviewProjection,
  weeklyPreviewProjectionSchema,
} from "../../../lib/pipeline/weekly-preview-projection";
import {sanitizedWeeklyEnrichmentFixture} from "../../fixtures/weekly-preview-projection/sanitized-enrichment";

const forbiddenKeys = new Set([
  "fieldEvidence", "missingFields", "conflicts", "accessLimitations", "researchStatus",
  "internalNotes", "rawId", "candidateStatus", "feishuId", "fullBody", "modelResponse",
]);

async function loadSanitized(): Promise<{raw: Record<string, unknown>; parsed: ReturnType<typeof parseWeeklyEnrichment>}> {
  const raw = structuredClone(sanitizedWeeklyEnrichmentFixture) as unknown as Record<string, unknown>;
  const bytes = Buffer.byteLength(JSON.stringify(raw));
  return {raw, parsed: parseWeeklyEnrichment(raw, bytes)};
}

function walkKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => walkKeys(item, found));
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) found.push(key);
    walkKeys(child, found);
  }
  return found;
}

describe("weekly preview projection", () => {
  it("uses an 89/7/82 sanitized fixture with unique event keys and empty audit payloads", async () => {
    const {parsed} = await loadSanitized();
    expect(parsed).toMatchObject({sourceEventCount: 89, inputEventCount: 82, excludedP4Count: 7, batch: "SANITIZED_FIXTURE"});
    expect(new Set(parsed.events.map((event) => event.eventKey)).size).toBe(82);
    expect(parsed.events.every((event) => Object.keys(event.fieldEvidence).length === 0 && event.conflicts.length === 0 && event.accessLimitations.length === 0 && event.researchStatus === "SANITIZED_FIXTURE")).toBe(true);
  });

  it("strictly validates input size, URL, length, unknown keys and tier", async () => {
    const {raw} = await loadSanitized();
    expect(() => parseWeeklyEnrichment(raw, MAX_WEEKLY_PREVIEW_FILE_BYTES + 1)).toThrow(/5 MiB/);
    const firstEvent = (copy: Record<string, unknown>) => (copy.events as Array<Record<string, unknown>>)[0]!;
    for (const mutate of [
      (copy: Record<string, unknown>) => { copy.unknown = true; },
      (copy: Record<string, unknown>) => { firstEvent(copy).unknown = true; },
      (copy: Record<string, unknown>) => { (firstEvent(copy).sourceUrls as string[])[0] = "file:///etc/passwd"; },
      (copy: Record<string, unknown>) => { firstEvent(copy).companyNameOriginal = "x".repeat(301); },
      (copy: Record<string, unknown>) => { firstEvent(copy).relevanceTier = "P5"; },
    ]) {
      const copy = structuredClone(raw);
      mutate(copy);
      expect(() => parseWeeklyEnrichment(copy)).toThrow(/严格Schema/);
    }
  });

  it("regresses the reviewed week counts and excludes P4 and audit fields", async () => {
    const {parsed} = await loadSanitized();
    const output = generateWeeklyPreviewProjection(parsed, "2026-08-03", "2026-08-09");
    expect(output.mode).toBe("PREVIEW");
    expect(output.counts).toEqual({original: 89, excludedP4: 7, public: 82, P1: 18, P2: 27, P3: 37});
    expect(output.events).toHaveLength(82);
    expect(output.events.some((event) => event.relevanceTier === ("P4" as never))).toBe(false);
    expect(walkKeys(output)).toEqual([]);
    expect(JSON.stringify(output)).not.toMatch(/token|api[_-]?key|完整正文|模型响应/i);
  });

  it("preserves Ropedia's reviewed P1 source date and all P1/P2 introductions", async () => {
    const {parsed} = await loadSanitized();
    const output = generateWeeklyPreviewProjection(parsed, "2026-08-03", "2026-08-09");
    const ropedia = output.events.find((event) => event.companyStandardName === "Ropedia");
    expect(ropedia?.relevanceTier).toBe("P1");
    expect(ropedia?.sources).toContainEqual({url: "https://www.36kr.com/p/3927411140425861", publishedAt: "2026-08-06 10:09"});
    const cards = output.events.filter((event) => event.relevanceTier === "P1" || event.relevanceTier === "P2");
    expect(cards).toHaveLength(45);
    expect(cards.every((event) => Boolean(event.introduction?.trim()))).toBe(true);
  });

  it("gives all 37 P3 events bounded public table labels", async () => {
    const {parsed} = await loadSanitized();
    const p3 = generateWeeklyPreviewProjection(parsed, "2026-08-03", "2026-08-09").events.filter((event) => event.relevanceTier === "P3");
    expect(p3).toHaveLength(37);
    expect(p3.every((event) => Boolean(event.industryCategory && event.industryLabel && event.businessLabel && event.capitalEventLabel))).toBe(true);
    expect(p3.every((event) => (event.businessLabel?.length ?? 0) <= 60)).toBe(true);
  });

  it("uses deterministic category, native-unit amount buckets, unknown fallback and stable ids", async () => {
    const {parsed} = await loadSanitized();
    const base = parsed.events.find((event) => event.relevanceTier === "P1");
    expect(base).toBeDefined();
    const make = (id: string, rationale: string, amount: string | null, currency: "CNY" | "USD") => ({
      ...structuredClone(base!), eventKey: id, relevanceRationale: rationale, companyNameOriginal: id,
      companyNameStandard: id, amount, currency, introduction: "用于排序测试的有效公开简介。",
      companyBusiness: rationale, products: [], coreTechnology: [],
    });
    const events = [
      make("event-z", "机器人本体", null, "CNY"),
      make("event-cny", "机器人本体", "1亿元", "CNY"),
      make("event-usd", "机器人本体", "1亿美元", "USD"),
      make("event-vla", "VLA世界模型", "100亿元", "CNY"),
    ];
    const input = {...parsed, sourceEventCount: 4, inputEventCount: 4, excludedP4Count: 0, excludedP4: [], events};
    const output = generateWeeklyPreviewProjection(input, "2026-08-03", "2026-08-09");
    expect(output.events.map((event) => event.id)).toEqual(["event-cny", "event-usd", "event-z", "event-vla"]);
    expect(parseAmountSortBucket("1亿元")).toEqual(parseAmountSortBucket("1亿美元"));
    expect(parseAmountSortBucket("近两亿元")).toEqual(parseAmountSortBucket("2亿元"));
    expect(parseAmountSortBucket(null).disclosed).toBe(false);
    expect(output.events[0]?.priorityReason).toMatch(/P1\/ROBOT_BODY/);
  });

  it("classifies the five reviewed P2 boundary cases with evidence-driven categories", async () => {
    const {parsed} = await loadSanitized();
    const output = generateWeeklyPreviewProjection(parsed, "2026-08-03", "2026-08-09");
    const category = (company: string) => output.events.find((event) => event.companyDisplayName === company)?.relevanceSubcategory;
    expect(category("立景创新")).toBe("ROBOT_RELATED_TECH");
    expect(category("德玛克精工")).toBe("ROBOT_RELATED_TECH");
    expect(category("亿维特航空")).toBe("AUTONOMOUS_PHYSICAL_SYSTEM");
    expect(category("嘉立创")).toBe("OTHER_RELATED_TECH");
    expect(category("拿森科技")).toBe("AUTONOMOUS_DRIVING");
  });

  it("orders P2 by category, then status, then native-unit amount and stable id", async () => {
    const {parsed} = await loadSanitized();
    const base = parsed.events.find((event) => event.relevanceTier === "P2");
    expect(base).toBeDefined();
    const make = (id: string, rationale: string, status: string, amount: string | null, currency: "CNY" | "USD") => ({
      ...structuredClone(base!), eventKey: id, relevanceRationale: rationale, companyNameOriginal: id,
      companyNameStandard: id, financingStatus: status, amount, currency,
      introduction: `用于P2排序测试：${rationale}`, companyBusiness: rationale, products: [], coreTechnology: [],
    });
    const events = [
      make("event-intent", "通用大模型", "融资意向", "500亿元", "CNY"),
      make("event-ongoing", "通用大模型", "进行中", "1000亿元", "CNY"),
      make("event-limited", "通用大模型", "已完成（标题口径）", "100亿元", "CNY"),
      make("event-usd", "通用大模型", "已完成", "1亿美元", "USD"),
      make("event-cny", "通用大模型", "已完成", "1亿元", "CNY"),
      make("event-robot", "机器人核心减速器", "融资意向", null, "CNY"),
    ];
    const input = {...parsed, sourceEventCount: events.length, inputEventCount: events.length, excludedP4Count: 0, excludedP4: [], events};
    const output = generateWeeklyPreviewProjection(input, "2026-08-03", "2026-08-09");
    expect(output.events.map((event) => event.id)).toEqual([
      "event-robot", "event-cny", "event-usd", "event-limited", "event-ongoing", "event-intent",
    ]);
    expect(parseAmountSortBucket("1亿元")).toEqual(parseAmountSortBucket("1亿美元"));
    expect(financingStatusRank("已完成")).toBeLessThan(financingStatusRank("已完成（标题口径）"));
    expect(financingStatusRank("进行中")).toBeLessThan(financingStatusRank("寻求融资"));
  });

  it("keeps DeepSeek's seeking event after every completed GENERAL_AI event", async () => {
    const {parsed} = await loadSanitized();
    const p2 = generateWeeklyPreviewProjection(parsed, "2026-08-03", "2026-08-09").events.filter((event) => event.relevanceTier === "P2");
    const deepSeekIndex = p2.findIndex((event) => event.companyDisplayName === "DeepSeek");
    const completedGeneralAiIndices = p2
      .map((event, index) => ({event, index}))
      .filter(({event}) => event.relevanceSubcategory === "GENERAL_AI" && financingStatusRank(event.financingStatus) <= 1)
      .map(({index}) => index);
    expect(deepSeekIndex).toBeGreaterThan(Math.max(...completedGeneralAiIndices));
    expect(p2[deepSeekIndex]?.financingStatus).toBe("进行中（本批来源称寻求融资）");
  });

  it("classifies P3 industries with fixed ambiguity priority and fallback", () => {
    const classify = (business: string) => classifyP3Industry({companyBusiness: business, products: [], coreTechnology: [], relevanceRationale: business});
    expect(classify("量子芯片与量子计算系统")).toBe("QUANTUM_TECH");
    expect(classify("核聚变能源装置")).toBe("ENERGY_FUSION");
    expect(classify("商业航天宇航芯片")).toBe("AEROSPACE_LOW_ALTITUDE");
    expect(classify("创新药物与临床医疗器械")).toBe("BIOTECH_HEALTHCARE");
    expect(classify("半导体电子硅片")).toBe("SEMICONDUCTOR_ELECTRONICS");
    expect(classify("先进复合材料精密制造")).toBe("ADVANCED_MANUFACTURING_MATERIALS");
    expect(classify("高技术专业服务")).toBe("OTHER_HARD_TECH");
    expect(deriveBusinessLabel({companyBusiness: null, products: []})).toBe("业务未明确");
    expect(deriveCapitalEventLabel({financingStatus: "进行中", round: "创业板IPO过会"})).toBe("IPO / 上市");
  });

  it("orders P3 by capital status before financing amount and ignores IPO price or market value", async () => {
    const {parsed} = await loadSanitized();
    const base = parsed.events.find((event) => event.relevanceTier === "P3");
    expect(base).toBeDefined();
    const make = (id: string, status: string, round: string | null, amount: string | null) => ({
      ...structuredClone(base!), eventKey: id, companyNameOriginal: id, companyNameStandard: id,
      financingStatus: status, round, amount, currency: "CNY" as const,
      companyBusiness: "先进材料制造", products: [], coreTechnology: [], introduction: "P3排序测试简介。",
    });
    const events = [
      make("event-intent", "融资意向", "拟天使轮", "500亿元"),
      make("event-ongoing", "进行中", "IPO递表", "拟募资100亿元"),
      make("event-limited", "已完成（标题口径）", "A轮", "1000亿元"),
      make("event-ipo", "已完成", "纳斯达克IPO", "发行价17美元/股；市值约90亿美元"),
      make("event-funded", "已完成", "A轮", "1亿元"),
      make("event-undisclosed", "已完成", "A轮", null),
    ];
    const input = {...parsed, sourceEventCount: events.length, inputEventCount: events.length, excludedP4Count: 0, excludedP4: [], events};
    const output = generateWeeklyPreviewProjection(input, "2026-08-03", "2026-08-09");
    expect(output.events.map((event) => event.id)).toEqual([
      "event-funded", "event-ipo", "event-undisclosed", "event-limited", "event-ongoing", "event-intent",
    ]);
  });

  it("rejects duplicate event keys and inconsistent source, exclusion and input statistics", async () => {
    const {parsed} = await loadSanitized();
    const duplicate = {...parsed, events: [...parsed.events, parsed.events[0]!], inputEventCount: 83, sourceEventCount: 90};
    expect(() => generateWeeklyPreviewProjection(duplicate, "2026-08-03", "2026-08-09")).toThrow(/统计或边界/);
    expect(() => generateWeeklyPreviewProjection({...parsed, sourceEventCount: 88}, "2026-08-03", "2026-08-09")).toThrow(/统计或边界/);
    expect(() => generateWeeklyPreviewProjection({...parsed, inputEventCount: 81}, "2026-08-03", "2026-08-09")).toThrow(/统计或边界/);
    expect(() => generateWeeklyPreviewProjection({...parsed, excludedP4Count: 6}, "2026-08-03", "2026-08-09")).toThrow(/统计或边界/);
  });

  it("is input-order independent, byte stable and emits parseable strict JSON", async () => {
    const {parsed} = await loadSanitized();
    const first = generateWeeklyPreviewProjection(parsed, "2026-08-03", "2026-08-09");
    const second = generateWeeklyPreviewProjection({...parsed, events: [...parsed.events].reverse()}, "2026-08-03", "2026-08-09");
    expect(first).toEqual(second);
    const firstBytes = serializeWeeklyPreviewProjection(first);
    const secondBytes = serializeWeeklyPreviewProjection(second);
    expect(firstBytes).toBe(secondBytes);
    expect(weeklyPreviewProjectionSchema.parse(JSON.parse(firstBytes))).toEqual(first);
    expect(firstBytes).not.toContain("generatedAt");
  });
});
