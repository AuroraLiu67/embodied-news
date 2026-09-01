import {createHash} from "node:crypto";
import {mkdir, readFile, stat, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";

import {z} from "zod";

import {safePublicHttpUrlSchema} from "../lib/domain/schemas/primitives";
import {
  generateWeeklyPreviewProjection,
  parseWeeklyEnrichment,
  serializeWeeklyPreviewProjection,
} from "../lib/pipeline/weekly-preview-projection";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const readyEventSchema = z.object({
  company: requiredText(300),
  round: requiredText(300),
  amount: requiredText(500),
  investors: requiredText(2_000),
  regionScope: z.enum(["CHINA", "OVERSEAS"]),
  companyBusiness: requiredText(2_000),
  products: z.array(requiredText(1_000)).max(20),
  sourcesMarkdown: requiredText(5_000),
  reportDate: z.iso.date(),
  sourceUrls: z.array(safePublicHttpUrlSchema).min(1).max(20),
  relevanceTier: z.enum(["P1", "P2", "P3", "P4"]),
  relevanceRationale: requiredText(2_000),
  status: z.literal("READY_FROM_PROVIDED_SOURCE"),
}).strict();

const readyFileSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  batch: requiredText(128),
  generatedAt: z.iso.datetime({offset: true}),
  inputEventCount: z.number().int().nonnegative().max(5_000),
  websiteReadyEventCount: z.number().int().nonnegative().max(5_000),
  excludedP4Count: z.number().int().nonnegative().max(5_000),
  relevanceDistribution: z.object({P1: z.number().int().nonnegative(), P2: z.number().int().nonnegative(), P3: z.number().int().nonnegative(), P4: z.number().int().nonnegative()}).strict(),
  events: z.array(readyEventSchema).max(5_000),
  excludedP4: z.array(readyEventSchema.extend({relevanceTier: z.literal("P4")})).max(5_000),
}).strict();

function parseArguments() {
  const args = process.argv.slice(2);
  const value = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
  const [inputJson, inputMarkdown] = args;
  const output = value("--output");
  const weekStart = value("--week-start");
  const weekEnd = value("--week-end");
  if (!inputJson || !inputMarkdown || !output || !weekStart || !weekEnd) {
    throw new Error("用法: generate-weekly-ready-preview <ready.json> <ready.md> --week-start YYYY-MM-DD --week-end YYYY-MM-DD --output <path>");
  }
  if ([inputJson, inputMarkdown].some((path) => resolve(path) === resolve(output))) throw new Error("输出不得覆盖输入文件");
  return {inputJson, inputMarkdown, output, weekStart, weekEnd};
}

function parseIntroductions(markdown: string): Map<string, string> {
  const introductions = new Map<string, string>();
  const pattern = /^### (.+?)（(P1|P2)）\n\n([\s\S]*?)(?=\n### |\n## P[123](?:\s|$))/gm;
  for (const match of markdown.matchAll(pattern)) {
    const company = match[1]?.trim();
    const paragraph = match[3]?.trim();
    if (!company || !paragraph) continue;
    const publicSummary = paragraph
      .replace(/\s*\[[^\]]+\]\(https?:\/\/[^)]+\)(?:、\[[^\]]+\]\(https?:\/\/[^)]+\))*/g, "")
      .trim();
    introductions.set(company, publicSummary);
  }
  return introductions;
}

function stableEventKey(event: z.infer<typeof readyEventSchema>): string {
  const digest = createHash("sha256").update([event.company, event.reportDate, event.round, event.amount].join("\u001f")).digest("hex").slice(0, 24);
  return `weekly-event-${digest}`;
}

function currencyFromAmount(amount: string): "CNY" | "USD" | "HKD" | "EUR" | null {
  if (/美元/.test(amount)) return "USD";
  if (/港元/.test(amount)) return "HKD";
  if (/欧元/.test(amount)) return "EUR";
  if (/元/.test(amount)) return "CNY";
  return null;
}

function splitInvestorNames(value: string): string[] {
  return value
    .replace(/[（(][^）)]*(?:未具名|此前|官宣日|教授)[^）)]*[）)]/g, "")
    .split(/[、/+]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function parseInvestors(value: string) {
  if (/未披露|未完整披露|本轮机构未披露/.test(value)) return {leadInvestors: [], followInvestors: [], otherInvestors: [], financialAdviser: null};
  const leadInvestors: string[] = [];
  const followInvestors: string[] = [];
  const otherInvestors: string[] = [];
  let financialAdviser: string | null = null;
  for (const rawClause of value.split(/[，；;]/)) {
    const clause = rawClause.trim();
    if (!clause) continue;
    if (/(?:任|担任)FA/.test(clause)) {
      financialAdviser = splitInvestorNames(clause.replace(/(?:任|担任)FA.*$/, "")).join("、") || null;
      continue;
    }
    if (/领投/.test(clause)) {
      const [leaders = "", remainder = ""] = clause.split(/(?:联合|独家)?领投/, 2);
      leadInvestors.push(...splitInvestorNames(leaders));
      otherInvestors.push(...splitInvestorNames(remainder));
    } else if (/跟投|参投|追投|追加|加码|战略投资/.test(clause)) {
      followInvestors.push(...splitInvestorNames(clause.replace(/(?:跟投|参投|追投|追加|加码|战略投资).*$/, "")));
    } else {
      otherInvestors.push(...splitInvestorNames(clause.replace(/独家$/, "")));
    }
  }
  return {
    leadInvestors: [...new Set(leadInvestors)],
    followInvestors: [...new Set(followInvestors)],
    otherInvestors: [...new Set(otherInvestors)],
    financialAdviser,
  };
}

async function main() {
  const {inputJson, inputMarkdown, output, weekStart, weekEnd} = parseArguments();
  const [jsonStats, markdownStats] = await Promise.all([stat(inputJson), stat(inputMarkdown)]);
  if (!jsonStats.isFile() || !markdownStats.isFile() || jsonStats.size > MAX_INPUT_BYTES || markdownStats.size > MAX_INPUT_BYTES) throw new Error("输入必须是小于或等于5 MiB的普通文件");
  const [jsonText, markdown] = await Promise.all([readFile(inputJson, "utf8"), readFile(inputMarkdown, "utf8")]);
  const ready = readyFileSchema.parse(JSON.parse(jsonText) as unknown);
  const introductions = parseIntroductions(markdown);
  const problems: string[] = [];
  if (ready.inputEventCount !== ready.events.length + ready.excludedP4.length) problems.push("inputEventCount统计不一致");
  if (ready.websiteReadyEventCount !== ready.events.length) problems.push("websiteReadyEventCount统计不一致");
  if (ready.excludedP4Count !== ready.excludedP4.length) problems.push("excludedP4Count统计不一致");
  if (new Set(ready.events.map((event) => event.company)).size !== ready.events.length) problems.push("公司事件重复");
  for (const event of ready.events.filter((item) => item.relevanceTier === "P1" || item.relevanceTier === "P2")) {
    if (!introductions.has(event.company)) problems.push(`缺少P1/P2简介: ${event.company}`);
  }
  if (problems.length > 0) throw new Error(problems.join("；"));

  const businessDates = [...new Set(ready.events.map((event) => event.reportDate))].sort();
  const enrichment = parseWeeklyEnrichment({
    schemaVersion: "1.0.0",
    batch: ready.batch,
    businessDates,
    generatedAt: ready.generatedAt,
    inputEventCount: ready.events.length,
    sourceEventCount: ready.inputEventCount,
    excludedP4Count: ready.excludedP4.length,
    events: ready.events.map((event) => {
      const investors = parseInvestors(event.investors);
      return ({
      eventKey: stableEventKey(event),
      regionScope: event.regionScope,
      relevanceTier: event.relevanceTier,
      relevanceRationale: event.relevanceRationale,
      companyNameOriginal: event.company,
      companyNameStandard: event.company,
      companyEnglishName: null,
      officialWebsite: null,
      sourceUrls: event.sourceUrls,
      sourcePublishedAt: Object.fromEntries(event.sourceUrls.map((url) => [url, event.reportDate])),
      eventDate: null,
      financingStatus: "已完成",
      round: event.round === "未披露" ? null : event.round,
      amount: /未披露|未提取/.test(event.amount) ? null : event.amount,
      currency: currencyFromAmount(event.amount),
      leadInvestors: investors.leadInvestors,
      followInvestors: investors.followInvestors,
      otherInvestors: investors.otherInvestors,
      financialAdviser: investors.financialAdviser,
      companyBusiness: event.companyBusiness,
      products: event.products,
      coreTechnology: [],
      foundingTeam: [],
      useOfFunds: null,
      valuation: null,
      cumulativeFunding: null,
      introduction: introductions.get(event.company) ?? null,
      fieldEvidence: {},
      missingFields: [],
      conflicts: [],
      accessLimitations: [],
      researchStatus: event.status,
    });}),
    excludedP4: ready.excludedP4.map((event) => ({eventKey: stableEventKey(event), companyNameOriginal: event.company, relevanceTier: "P4"})),
  }, Buffer.byteLength(jsonText) + Buffer.byteLength(markdown));
  const projection = generateWeeklyPreviewProjection(enrichment, weekStart, weekEnd);
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, serializeWeeklyPreviewProjection(projection), "utf8");
  process.stdout.write(`${JSON.stringify({output, counts: projection.counts})}\n`);
}

void main();
