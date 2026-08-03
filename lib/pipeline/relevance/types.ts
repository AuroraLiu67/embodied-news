import type {
  Confidence,
  RelevanceDecision,
  ResearchCandidate,
} from "../../domain";
import type { FetchedContent } from "../../providers/content-fetch";

export interface RelevanceClassifierInput {
  title: string;
  sourceName: string;
  sourceUrl: string;
  content: string;
}

export interface RelevanceClassifierOutput {
  decision: RelevanceDecision;
  confidence: Confidence;
  reason: string;
}

export interface RelevanceClassifier {
  readonly model: string;
  classify(input: RelevanceClassifierInput): Promise<unknown>;
}

export interface CandidateRelevanceInput {
  candidate: ResearchCandidate;
  content: FetchedContent;
}
