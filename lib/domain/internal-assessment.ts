import type { AssessmentId, CompanyId, EventId } from "./common";

export const attentionLevels = ["LOW", "MEDIUM", "HIGH", "STRATEGIC"] as const;
export type AttentionLevel = (typeof attentionLevels)[number];

export const followUpStatuses = [
  "NOT_STARTED",
  "RESEARCHING",
  "CONTACTING",
  "IN_PROGRESS",
  "PAUSED",
  "CLOSED",
] as const;
export type FollowUpStatus = (typeof followUpStatuses)[number];

type AssessmentTarget =
  | {
      companyId: CompanyId;
      eventId: null;
    }
  | {
      companyId: null;
      eventId: EventId;
    };

export type InternalAssessment = AssessmentTarget & {
  assessmentId: AssessmentId;
  attentionLevel: AttentionLevel;
  strategicAssessment: string;
  followUpStatus: FollowUpStatus;
  owner: string;
  internalNotes: string;
};
