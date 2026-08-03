import { openAiOutputFixture } from "../fixtures/providers";
import type { MockScenario } from "./scenario";
import { respondForScenario } from "./scenario";

export class MockOpenAiProvider {
  constructor(private readonly scenario: MockScenario = "success") {}

  research(): Promise<unknown> {
    return respondForScenario(this.scenario, {
      success: openAiOutputFixture,
      empty: null,
      invalid: { publicSummary: 123, sources: "invalid" },
    });
  }
}
