import type { MockScenario } from "./scenario";
import { respondForScenario } from "./scenario";

export class MockNotificationProvider {
  readonly sentTexts: string[] = [];

  constructor(private readonly scenario: MockScenario = "success") {}

  async sendText(text: string): Promise<unknown> {
    const result = await respondForScenario(this.scenario, {
      success: { messageId: "message-001", delivered: true },
      empty: { messageId: null, delivered: false },
      invalid: "invalid-notification-response",
    });
    if (this.scenario === "success") this.sentTexts.push(text);
    return result;
  }
}
