export interface NotificationDelivery {
  messageId: string;
  delivered: true;
}

export interface NotificationSender {
  sendText(text: string, idempotencyKey: string): Promise<NotificationDelivery>;
}

export interface ReviewReminderInput {
  businessDate: string;
  candidateCount: number;
  highConfidenceCount: number;
  lowConfidenceCount: number;
  needsResearchCount: number;
  reviewUrl: string;
}

export interface PublicationNotificationInput {
  businessDate: string;
  fundingEventCount: number;
  headline: string;
  digestUrl: string;
  humanReviewed: boolean;
}

export interface TaskFailureNotificationInput {
  businessDate: string;
  jobName: string;
  errorCode: string;
  retryUrl: string;
}

export interface TaskRecoveryNotificationInput {
  businessDate: string;
  jobName: string;
  statusUrl: string;
}

export interface FeishuMessageTransport {
  sendDirectText(request: {
    recipientOpenId: string;
    text: string;
    uuid: string;
  }): Promise<{ code?: number; msg?: string; messageId?: string }>;
}

