import type { OpenAIResearchOutput } from "./provider";

export interface OpenAIResearchRequest {
  model: string;
  query: string;
  maxOutputTokens: number;
  signal: AbortSignal;
}

export interface OpenAITransportResponse {
  status: "completed" | "incomplete" | "refused";
  outputText?: string;
  incompleteReason?: string;
}

export interface OpenAITransport {
  research(request: OpenAIResearchRequest): Promise<OpenAITransportResponse>;
}

export interface OpenAIProviderLogEvent {
  operation: "overseas_research";
  outcome: "succeeded" | "retry" | "failed";
  attempt: number;
  errorCode?: string;
}

export interface OpenAIResearchProvider {
  research(query: string): Promise<OpenAIResearchOutput>;
}
