import { workBuddyInputFixture } from "../fixtures/providers";
import type { MockScenario } from "./scenario";
import { respondForScenario } from "./scenario";

export class MockWorkBuddyProvider {
  constructor(private readonly scenario: MockScenario = "success") {}

  discover(): Promise<unknown> {
    return respondForScenario(this.scenario, {
      success: [workBuddyInputFixture],
      empty: [],
      invalid: [{ title: "缺少 URL 的非法候选" }],
    });
  }
}
