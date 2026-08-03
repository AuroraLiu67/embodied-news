import type { Company, CompanyId } from "../../domain";

export interface CompanyDirectory {
  listCompanies(): Promise<readonly Company[]>;
}

export type CompanyMatchKind = "NAME_ZH" | "NAME_EN" | "ALIAS" | "DOMAIN";

export interface CompanyMatchSuggestion {
  companyId: CompanyId;
  score: number;
  reasons: readonly string[];
}

export interface CompanyResolutionResult {
  status: "MATCHED" | "SUGGESTED" | "AMBIGUOUS" | "UNMATCHED";
  companyId: CompanyId | null;
  matchedBy: CompanyMatchKind | null;
  suggestions: readonly CompanyMatchSuggestion[];
}

export interface CompanyResolutionInput {
  companyName: string;
  websiteUrl?: string | null;
}
