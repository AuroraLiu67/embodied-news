import { companySchema, safePublicHttpUrlSchema } from "../../domain";
import { CompanyResolutionError } from "./errors";
import type {
  CompanyDirectory,
  CompanyMatchKind,
  CompanyResolutionInput,
  CompanyResolutionResult,
} from "./types";

const normalizeName = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .trim()
    .replace(/\s+/g, " ");

const normalizeFuzzyName = (value: string) =>
  normalizeName(value)
    .replace(/[\p{P}\p{S}\s]/gu, "");

const hostnameOf = (value: string) => {
  const parsed = safePublicHttpUrlSchema.safeParse(value);
  if (!parsed.success) return null;
  return new URL(parsed.data).hostname.toLowerCase().replace(/^www\./, "");
};

const bigrams = (value: string) => {
  if (value.length < 2) return new Set([value]);
  return new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
};

const similarity = (left: string, right: string) => {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  let overlap = 0;
  for (const pair of leftPairs) if (rightPairs.has(pair)) overlap += 1;
  return (2 * overlap) / (leftPairs.size + rightPairs.size);
};

export interface CompanyResolutionServiceOptions {
  suggestionThreshold?: number;
  maxSuggestions?: number;
}

export class CompanyResolutionService {
  private readonly suggestionThreshold: number;
  private readonly maxSuggestions: number;

  constructor(
    private readonly directory: CompanyDirectory,
    options: CompanyResolutionServiceOptions = {},
  ) {
    this.suggestionThreshold = options.suggestionThreshold ?? 0.55;
    this.maxSuggestions = options.maxSuggestions ?? 5;
    if (
      this.suggestionThreshold < 0 ||
      this.suggestionThreshold > 1 ||
      !Number.isInteger(this.maxSuggestions) ||
      this.maxSuggestions < 1
    ) {
      throw new CompanyResolutionError(
        "COMPANY_RESOLUTION_INPUT_INVALID",
        "公司归一化配置无效",
      );
    }
  }

  async resolve(input: CompanyResolutionInput): Promise<CompanyResolutionResult> {
    const normalizedInput = normalizeName(input.companyName);
    if (!normalizedInput || input.companyName.length > 300) {
      throw new CompanyResolutionError(
        "COMPANY_RESOLUTION_INPUT_INVALID",
        "公司名称为空或超过长度上限",
      );
    }
    const websiteHost = input.websiteUrl ? hostnameOf(input.websiteUrl) : null;
    if (input.websiteUrl && !websiteHost) {
      throw new CompanyResolutionError(
        "COMPANY_RESOLUTION_INPUT_INVALID",
        "公司官网提示无效",
      );
    }

    const rawCompanies = await this.directory.listCompanies();
    const companies = rawCompanies.map((company) => {
      const parsed = companySchema.safeParse(company);
      if (!parsed.success) {
        throw new CompanyResolutionError(
          "COMPANY_DIRECTORY_INVALID",
          "公司目录记录未通过 Schema",
        );
      }
      return parsed.data;
    });

    const exact = new Map<string, Set<CompanyMatchKind>>();
    const addExact = (companyId: string, kind: CompanyMatchKind) => {
      const kinds = exact.get(companyId) ?? new Set<CompanyMatchKind>();
      kinds.add(kind);
      exact.set(companyId, kinds);
    };

    for (const company of companies) {
      if (company.nameZh && normalizeName(company.nameZh) === normalizedInput) {
        addExact(company.companyId, "NAME_ZH");
      }
      if (company.nameEn && normalizeName(company.nameEn) === normalizedInput) {
        addExact(company.companyId, "NAME_EN");
      }
      if (company.aliases.some((alias) => normalizeName(alias) === normalizedInput)) {
        addExact(company.companyId, "ALIAS");
      }
      if (websiteHost && hostnameOf(company.website) === websiteHost) {
        addExact(company.companyId, "DOMAIN");
      }
    }

    if (exact.size === 1) {
      const [companyId, kinds] = [...exact.entries()][0];
      const matchedBy = kinds.has("DOMAIN")
        ? "DOMAIN"
        : kinds.has("NAME_ZH")
          ? "NAME_ZH"
          : kinds.has("NAME_EN")
            ? "NAME_EN"
            : "ALIAS";
      return { status: "MATCHED", companyId, matchedBy, suggestions: [] };
    }

    const suggestions = companies
      .map((company) => {
        const names = [company.nameZh, company.nameEn, ...company.aliases]
          .filter((name): name is string => Boolean(name))
          .map(normalizeFuzzyName);
        const fuzzyInput = normalizeFuzzyName(normalizedInput);
        const score = Math.max(...names.map((name) => similarity(fuzzyInput, name)), 0);
        return {
          companyId: company.companyId,
          score: Math.round(score * 1000) / 1000,
          reasons: ["名称相似，仅供人工确认"],
        };
      })
      .filter((suggestion) => suggestion.score >= this.suggestionThreshold)
      .sort((left, right) => right.score - left.score || left.companyId.localeCompare(right.companyId))
      .slice(0, this.maxSuggestions);

    if (exact.size > 1) {
      const exactSuggestions = [...exact.keys()]
        .sort()
        .map((companyId) => ({
          companyId,
          score: 1,
          reasons: ["名称、别名或域名证据指向多个公司，禁止自动合并"],
        }));
      return {
        status: "AMBIGUOUS",
        companyId: null,
        matchedBy: null,
        suggestions: exactSuggestions,
      };
    }

    return {
      status: suggestions.length > 0 ? "SUGGESTED" : "UNMATCHED",
      companyId: null,
      matchedBy: null,
      suggestions,
    };
  }
}
