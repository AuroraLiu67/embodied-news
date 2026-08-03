export const mockScenarios = [
  "success",
  "empty",
  "rate_limit",
  "timeout",
  "invalid_output",
] as const;
export type MockScenario = (typeof mockScenarios)[number];

export class MockProviderError extends Error {
  constructor(
    readonly code: "RATE_LIMITED" | "TIMED_OUT",
    message: string,
  ) {
    super(message);
    this.name = "MockProviderError";
  }
}

export const respondForScenario = async <Success, Empty, Invalid>(
  scenario: MockScenario,
  values: {
    success: Success;
    empty: Empty;
    invalid: Invalid;
  },
): Promise<Success | Empty | Invalid> => {
  switch (scenario) {
    case "success":
      return values.success;
    case "empty":
      return values.empty;
    case "invalid_output":
      return values.invalid;
    case "rate_limit":
      throw new MockProviderError("RATE_LIMITED", "Mock provider rate limited");
    case "timeout":
      throw new MockProviderError("TIMED_OUT", "Mock provider timed out");
  }
};
