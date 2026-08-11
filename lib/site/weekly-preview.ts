import weeklyPreview from "../../public/data/weekly/2026-08-03.json";
import {parseAmountSortBucket} from "../pipeline/weekly-preview-projection";

export const WEEKLY_PREVIEW_P1_COUNT = 18;
export const WEEKLY_PREVIEW_P2_COUNT = 27;
export const WEEKLY_PREVIEW_P3_COUNT = 37;

function toPreviewCard(event: (typeof weeklyPreview.events)[number], requireIntroduction = true) {
  const firstSource = event.sources[0];
  if (!firstSource) throw new Error(`周报预览事件缺少来源1: ${event.companyDisplayName}`);
  if (requireIntroduction && !event.introduction?.trim()) throw new Error(`周报预览事件缺少简介: ${event.companyDisplayName}`);
  return {
    companyDisplayName: event.companyDisplayName,
    relevanceTier: event.relevanceTier,
    relevanceSubcategory: event.relevanceSubcategory,
    introduction: event.introduction,
    round: event.round,
    financingStatus: event.financingStatus,
    amount: event.amount,
    regionScope: event.regionScope,
    leadInvestors: event.leadInvestors,
    followInvestors: event.followInvestors,
    otherInvestors: event.otherInvestors,
    products: event.products,
    officialWebsite: event.officialWebsite,
    sources: [firstSource],
    industryCategory: event.industryCategory,
    industryLabel: event.industryLabel,
    businessLabel: event.businessLabel,
    capitalEventLabel: event.capitalEventLabel,
  };
}

const p1Events = weeklyPreview.events.filter((event) => event.relevanceTier === "P1").map((event) => toPreviewCard(event));
const p2Events = weeklyPreview.events.filter((event) => event.relevanceTier === "P2").map((event) => toPreviewCard(event));
const p3Events = weeklyPreview.events.filter((event) => event.relevanceTier === "P3").map((event) => toPreviewCard(event, false));
if (p1Events.length !== WEEKLY_PREVIEW_P1_COUNT || p2Events.length !== WEEKLY_PREVIEW_P2_COUNT || p3Events.length !== WEEKLY_PREVIEW_P3_COUNT) {
  throw new Error(`周报预览层级数量异常: P1=${p1Events.length}, P2=${p2Events.length}, P3=${p3Events.length}`);
}
if (p3Events.some((event) => !event.industryCategory || !event.industryLabel || !event.businessLabel || !event.capitalEventLabel)) {
  throw new Error("P3周报预览缺少行业或资本事件展示字段");
}

export const weeklyPreviewSample = {
  mode: weeklyPreview.mode,
  weekStart: weeklyPreview.weekStart,
  weekEnd: weeklyPreview.weekEnd,
  counts: weeklyPreview.counts,
  p1Events,
  p2Events,
  p3Events,
  events: [...p1Events, ...p2Events, ...p3Events],
} as const;

const highestDisclosedCnyEvent = weeklyPreview.events
  .filter((event) => event.currency === "CNY")
  .filter((event) => !/融资意向|寻求融资/.test(event.financingStatus))
  .filter((event) => !/ipo|上市|发行价|市值/i.test(`${event.round ?? ""} ${event.financingStatus} ${event.amount ?? ""}`))
  .map((event) => ({event, bucket: parseAmountSortBucket(event.amount)}))
  .filter(({bucket}) => bucket.disclosed)
  .sort((left, right) => right.bucket.magnitude - left.bucket.magnitude || left.event.id.localeCompare(right.event.id, "en"))[0];

if (!highestDisclosedCnyEvent?.event.amount) throw new Error("周报预览缺少可展示的人民币已披露资本金额");

export const weeklyPreviewHighlight = {
  company: highestDisclosedCnyEvent.event.companyDisplayName,
  amount: highestDisclosedCnyEvent.event.amount,
  event: highestDisclosedCnyEvent.event.round ?? "资本动态",
  status: highestDisclosedCnyEvent.event.financingStatus,
  scopeNote: "人民币原币种口径；不换汇，排除融资意向及IPO发行价/市值",
} as const;

export type WeeklyPreviewSampleEvent = (typeof weeklyPreviewSample.events)[number];

export function formatPrimaryInvestors(event: Pick<WeeklyPreviewSampleEvent, "leadInvestors" | "followInvestors" | "otherInvestors">): string {
  const unique = [...new Set([...event.leadInvestors, ...event.followInvestors, ...event.otherInvestors])];
  if (unique.length === 0) return "未披露";
  const visible = unique.slice(0, 3).join("、");
  return unique.length > 3 ? `${visible}等${unique.length}家` : visible;
}
