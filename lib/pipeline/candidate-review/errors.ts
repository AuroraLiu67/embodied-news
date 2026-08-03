export const candidateReviewErrorCodes = [
  "CANDIDATE_REVIEW_INPUT_INVALID",
  "CANDIDATE_REVIEW_APPROVAL_INCOMPLETE",
  "CANDIDATE_REVIEW_EVENT_CHANGED",
] as const;

export type CandidateReviewErrorCode =
  (typeof candidateReviewErrorCodes)[number];

export class CandidateReviewError extends Error {
  readonly name = "CandidateReviewError";

  constructor(
    readonly code: CandidateReviewErrorCode,
    message: string,
  ) {
    super(message);
  }
}

