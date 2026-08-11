export class WeeklyPreviewProjectionError extends Error {
  constructor(
    readonly code: "PREVIEW_INPUT_TOO_LARGE" | "PREVIEW_INPUT_INVALID" | "PREVIEW_INVARIANT_FAILED",
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "WeeklyPreviewProjectionError";
  }
}
