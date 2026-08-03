export class EventDeduplicationError extends Error {
  readonly name = "EventDeduplicationError";
  readonly code = "EVENT_DEDUPLICATION_INPUT_INVALID";

  constructor(message = "事件去重输入无效") {
    super(message);
  }
}
