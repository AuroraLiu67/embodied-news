import { feishuRecordFixture } from "../fixtures/providers";
import type { MockScenario } from "./scenario";
import { respondForScenario } from "./scenario";

export class MockFeishuProvider {
  readonly writes: unknown[] = [];

  constructor(private readonly scenario: MockScenario = "success") {}

  listRecords(): Promise<unknown> {
    return respondForScenario(this.scenario, {
      success: [feishuRecordFixture],
      empty: [],
      invalid: { records: "invalid" },
    });
  }

  async writeRecord(record: unknown): Promise<unknown> {
    const result = await respondForScenario(this.scenario, {
      success: { recordId: "rec_created_001" },
      empty: null,
      invalid: { recordId: 123 },
    });
    if (this.scenario === "success") this.writes.push(record);
    return result;
  }
}
