import { z } from "zod";

import { isoDateSchema, safePublicHttpUrlSchema } from "../../domain";
import { NotificationError } from "./errors";
import type {
  NotificationSender,
  PublicationNotificationInput,
  ReviewReminderInput,
  TaskFailureNotificationInput,
  TaskRecoveryNotificationInput,
} from "./types";

const count = z.number().int().min(0).max(100_000);
const shortText = z.string().trim().min(1).max(500);

const reviewReminderSchema = z
  .object({
    businessDate: isoDateSchema,
    candidateCount: count,
    highConfidenceCount: count,
    lowConfidenceCount: count,
    needsResearchCount: count,
    reviewUrl: safePublicHttpUrlSchema,
  })
  .strict();

const publicationSchema = z
  .object({
    businessDate: isoDateSchema,
    fundingEventCount: count,
    headline: shortText,
    digestUrl: safePublicHttpUrlSchema,
    humanReviewed: z.boolean(),
  })
  .strict();

const failureSchema = z
  .object({
    businessDate: isoDateSchema,
    jobName: shortText,
    errorCode: z.string().trim().min(1).max(100).regex(/^[A-Z0-9_:-]+$/),
    retryUrl: safePublicHttpUrlSchema,
  })
  .strict();

const recoverySchema = z
  .object({
    businessDate: isoDateSchema,
    jobName: shortText,
    statusUrl: safePublicHttpUrlSchema,
  })
  .strict();

const parse = <Output>(result: z.ZodSafeParseResult<Output>): Output => {
  if (!result.success) {
    throw new NotificationError(
      "NOTIFICATION_INPUT_INVALID",
      "通知内容不符合项目契约",
      false,
    );
  }
  return result.data;
};

export class NotificationService {
  constructor(private readonly sender: NotificationSender) {}

  async sendReviewReminder(input: ReviewReminderInput) {
    const value = parse(reviewReminderSchema.safeParse(input));
    const text = [
      `【待审核提醒｜${value.businessDate}】`,
      `候选总数：${value.candidateCount}`,
      `高置信度：${value.highConfidenceCount}`,
      `低置信度：${value.lowConfidenceCount}`,
      `待复核：${value.needsResearchCount}`,
      `审核入口：${value.reviewUrl}`,
    ].join("\n");
    return this.sender.sendText(text, `review:${value.businessDate}`);
  }

  async sendPublication(input: PublicationNotificationInput) {
    const value = parse(publicationSchema.safeParse(input));
    const text = [
      `【日报已生成｜${value.businessDate}】`,
      `今日融资事件：${value.fundingEventCount} 条`,
      `头条：${value.headline}`,
      `审核状态：${value.humanReviewed ? "已人工审核" : "AI 自动生成、未经人工审核"}`,
      `日报链接：${value.digestUrl}`,
    ].join("\n");
    return this.sender.sendText(text, `publication:${value.businessDate}`);
  }

  async sendFailure(input: TaskFailureNotificationInput) {
    const value = parse(failureSchema.safeParse(input));
    const text = [
      `【任务失败｜${value.businessDate}】`,
      `任务：${value.jobName}`,
      `错误代码：${value.errorCode}`,
      `重试入口：${value.retryUrl}`,
    ].join("\n");
    return this.sender.sendText(
      text,
      `failure:${value.businessDate}:${value.errorCode}`,
    );
  }

  async sendRecovery(input: TaskRecoveryNotificationInput) {
    const value = parse(recoverySchema.safeParse(input));
    const text = [
      `【任务已恢复｜${value.businessDate}】`,
      `任务：${value.jobName}`,
      `状态入口：${value.statusUrl}`,
    ].join("\n");
    return this.sender.sendText(text, `recovery:${value.businessDate}`);
  }
}

