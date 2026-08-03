import type { AutomationRunId, IsoDate, IsoDateTime } from "./common";

export const automationJobTypes = [
  "DISCOVER_OVERSEAS",
  "PROCESS_CANDIDATES",
  "CREATE_REVIEW_DIGEST",
  "PUBLISH_DIGEST",
  "BUILD_SITE",
  "NOTIFY",
  "BACKFILL",
] as const;
export type AutomationJobType = (typeof automationJobTypes)[number];

export const automationRunStatuses = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "REQUIRES_MANUAL_ACTION",
] as const;
export type AutomationRunStatus = (typeof automationRunStatuses)[number];

export interface AutomationRun {
  runId: AutomationRunId;
  businessDate: IsoDate;
  jobType: AutomationJobType;
  status: AutomationRunStatus;
  attempt: number;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  errorCode: string | null;
  errorSummary: string | null;
  manualActionRequired: boolean;
}
