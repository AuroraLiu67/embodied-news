import type { WatchId } from "./common";

export const watchItemTypes = [
  "COMPANY",
  "INVESTOR",
  "FA",
  "WECHAT_ACCOUNT",
  "KEYWORD",
  "TRACK",
] as const;
export type WatchItemType = (typeof watchItemTypes)[number];

export const watchPriorities = ["LOW", "MEDIUM", "HIGH"] as const;
export type WatchPriority = (typeof watchPriorities)[number];

export interface WatchItem {
  watchId: WatchId;
  type: WatchItemType;
  name: string;
  queries: readonly string[];
  region: string;
  technologyTags: readonly string[];
  priority: WatchPriority;
  enabled: boolean;
}
