export const notificationErrorCodes = [
  "NOTIFICATION_INPUT_INVALID",
  "NOTIFICATION_DELIVERY_FAILED",
] as const;

export type NotificationErrorCode = (typeof notificationErrorCodes)[number];

export class NotificationError extends Error {
  readonly name = "NotificationError";

  constructor(
    readonly code: NotificationErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

