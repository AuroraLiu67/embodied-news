import { describe, expect, it, vi } from "vitest";

import {
  OpenAIProvider,
  OpenAIProviderError,
  type OpenAIProviderLogEvent,
  type OpenAIResearchRequest,
  type OpenAITransport,
  type OpenAITransportResponse,
} from "../../../lib/providers/openai";
import { openAiOutputFixture } from "../../fixtures/providers";

type TransportOutcome =
  | OpenAITransportResponse
  | Error
  | { status: number; message: string };

class FakeOpenAITransport implements OpenAITransport {
  readonly requests: OpenAIResearchRequest[] = [];

  constructor(private readonly outcomes: TransportOutcome[]) {}

  async research(request: OpenAIResearchRequest) {
    this.requests.push(request);
    const outcome = this.outcomes.shift();
    if (!outcome) throw new Error("missing fake outcome");
    if (outcome instanceof Error || "message" in outcome) throw outcome;
    return outcome;
  }
}

const completed = (value: unknown = openAiOutputFixture): OpenAITransportResponse => ({
  status: "completed",
  outputText: JSON.stringify(value),
});

const createProvider = (
  transport: OpenAITransport,
  overrides: Partial<ConstructorParameters<typeof OpenAIProvider>[0]> = {},
) =>
  new OpenAIProvider({
    model: "configured-test-model",
    transport,
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

const expectProviderError = async (
  action: () => Promise<unknown>,
  code: OpenAIProviderError["code"],
) => {
  await expect(action()).rejects.toMatchObject({
    name: "OpenAIProviderError",
    code,
  });
};

describe("OpenAI overseas research provider", () => {
  it("returns a locally validated structured research result", async () => {
    const transport = new FakeOpenAITransport([completed()]);
    const provider = createProvider(transport, { maxOutputTokens: 3210 });

    await expect(provider.research("search overseas embodied AI funding")).resolves.toEqual(
      openAiOutputFixture,
    );
    expect(transport.requests[0]).toMatchObject({
      model: "configured-test-model",
      query: "search overseas embodied AI funding",
      maxOutputTokens: 3210,
    });
  });

  it.each([
    [429, "OPENAI_RATE_LIMITED"],
    [503, "OPENAI_SERVICE_UNAVAILABLE"],
  ] as const)("retries transient HTTP %s errors within the configured limit", async (status, expectedCode) => {
    const transport = new FakeOpenAITransport([
      { status, message: "provider raw secret response" },
      completed(),
    ]);
    const logs: OpenAIProviderLogEvent[] = [];
    const provider = createProvider(transport, {
      maxRetries: 1,
      logger: (event) => logs.push(event),
    });

    await expect(provider.research("robotics financing")).resolves.toEqual(
      openAiOutputFixture,
    );
    expect(transport.requests).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      outcome: "retry",
      attempt: 1,
      errorCode: expectedCode,
    });
    expect(JSON.stringify(logs)).not.toContain("provider raw secret response");
  });

  it("never retries more than maxRetries", async () => {
    const transport = new FakeOpenAITransport([
      { status: 503, message: "first" },
      { status: 503, message: "second" },
      completed(),
    ]);
    const provider = createProvider(transport, { maxRetries: 1 });

    await expectProviderError(
      () => provider.research("robotics financing"),
      "OPENAI_SERVICE_UNAVAILABLE",
    );
    expect(transport.requests).toHaveLength(2);
  });

  it("maps an aborted request to a retry-bounded timeout", async () => {
    const transport: OpenAITransport = {
      research: vi.fn(
        (request: OpenAIResearchRequest) =>
          new Promise<OpenAITransportResponse>((_resolve, reject) => {
            request.signal.addEventListener("abort", () => {
              reject(new DOMException("secret timeout detail", "AbortError"));
            });
          }),
      ),
    };
    const provider = createProvider(transport, { timeoutMs: 5, maxRetries: 1 });

    await expectProviderError(
      () => provider.research("robotics financing"),
      "OPENAI_TIMED_OUT",
    );
    expect(transport.research).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid JSON and schema-invalid output without retrying", async () => {
    const invalidJson = new FakeOpenAITransport([
      { status: "completed", outputText: "not-json secret body" },
    ]);
    await expectProviderError(
      () => createProvider(invalidJson).research("robotics financing"),
      "OPENAI_INVALID_RESPONSE",
    );
    expect(invalidJson.requests).toHaveLength(1);

    const invalidSchema = new FakeOpenAITransport([completed({ publicSummary: "missing" })]);
    await expectProviderError(
      () => createProvider(invalidSchema).research("robotics financing"),
      "OPENAI_INVALID_RESPONSE",
    );
    expect(invalidSchema.requests).toHaveLength(1);
  });

  it("treats refusals and incomplete outputs as stable non-retryable errors", async () => {
    await expectProviderError(
      () =>
        createProvider(
          new FakeOpenAITransport([{ status: "refused" }]),
        ).research("robotics financing"),
      "OPENAI_REFUSED",
    );
    await expectProviderError(
      () =>
        createProvider(
          new FakeOpenAITransport([
            { status: "incomplete", incompleteReason: "max_output_tokens" },
          ]),
        ).research("robotics financing"),
      "OPENAI_INCOMPLETE_RESPONSE",
    );
  });

  it("enforces input and daily request budgets before transport calls", async () => {
    const transport = new FakeOpenAITransport([completed()]);
    const provider = createProvider(transport, {
      maxInputCharacters: 10,
      dailyRequestLimit: 1,
    });

    await expectProviderError(
      () => provider.research("x".repeat(11)),
      "OPENAI_INPUT_INVALID",
    );
    await provider.research("valid");
    await expectProviderError(
      () => provider.research("second"),
      "OPENAI_DAILY_LIMIT_EXCEEDED",
    );
    expect(transport.requests).toHaveLength(1);
  });

  it("never includes API keys or full model output in logs and errors", async () => {
    const secret = "openai-secret-sentinel";
    const fullOutput = `full-response-${"x".repeat(500)}`;
    const logs: OpenAIProviderLogEvent[] = [];
    const provider = createProvider(
      new FakeOpenAITransport([
        { status: "completed", outputText: `${fullOutput}${secret}` },
      ]),
      { logger: (event) => logs.push(event) },
    );

    let caught: unknown;
    try {
      await provider.research("robotics financing");
    } catch (error) {
      caught = error;
    }
    const serialized = JSON.stringify({ logs, error: String(caught) });
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(fullOutput);
  });
});
