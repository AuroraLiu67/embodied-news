export class ConfidenceSummaryError extends Error {
  readonly name = "ConfidenceSummaryError";
  readonly code = "CONFIDENCE_SUMMARY_INPUT_INVALID";

  constructor(message = "置信度与摘要输入无效") {
    super(message);
  }
}
