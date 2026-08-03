import { describe, expect, it, vi } from "vitest";

import type { Company } from "../../../lib/domain";
import {
  CompanyResolutionError,
  CompanyResolutionService,
  FeishuCompanyDirectory,
  type CompanyDirectory,
} from "../../../lib/pipeline/company-resolution";
import { companyFixture } from "../../fixtures/domain";

const galbotix = {
  ...companyFixture,
  companyId: "company-galbotix",
  nameZh: "银河智能",
  nameEn: "Galbotix",
  aliases: ["Galbot X"],
  website: "https://www.galbotix.ai/",
} satisfies Company;

const otherCompany = {
  ...companyFixture,
  companyId: "company-other-robotics",
  nameZh: "星河机器人",
  nameEn: "Star River Robotics",
  aliases: ["星河智能"],
  website: "https://star-river.example/",
} satisfies Company;

const directory = (companies: readonly Company[]): CompanyDirectory => ({
  listCompanies: vi.fn().mockResolvedValue(companies),
});

describe("company resolution service", () => {
  it.each([
    ["银河通用", "NAME_ZH"],
    ["GALBOT", "NAME_EN"],
    ["银河通用机器人", "ALIAS"],
  ] as const)("automatically resolves exact known name or alias %s", async (name, matchedBy) => {
    const result = await new CompanyResolutionService(
      directory([companyFixture, galbotix]),
    ).resolve({ companyName: name });
    expect(result).toEqual({
      status: "MATCHED",
      companyId: companyFixture.companyId,
      matchedBy,
      suggestions: [],
    });
  });

  it("resolves an exact normalized official website domain", async () => {
    const result = await new CompanyResolutionService(
      directory([companyFixture, galbotix]),
    ).resolve({
      companyName: "Unknown display name",
      websiteUrl: "https://galbot.com/about",
    });
    expect(result).toMatchObject({
      status: "MATCHED",
      companyId: companyFixture.companyId,
      matchedBy: "DOMAIN",
    });
  });

  it("only suggests a fuzzy name and never automatically merges it", async () => {
    const result = await new CompanyResolutionService(
      directory([companyFixture, galbotix, otherCompany]),
    ).resolve({ companyName: "Galboti" });
    expect(result.status).toBe("SUGGESTED");
    expect(result.companyId).toBeNull();
    expect(result.matchedBy).toBeNull();
    expect(result.suggestions[0]).toMatchObject({
      companyId: galbotix.companyId,
      reasons: ["名称相似，仅供人工确认"],
    });
  });

  it("does not merge similar but distinct company names", async () => {
    const result = await new CompanyResolutionService(
      directory([companyFixture, galbotix]),
    ).resolve({ companyName: "Galbot X Robotics" });
    expect(result.companyId).toBeNull();
    expect(["SUGGESTED", "UNMATCHED"]).toContain(result.status);
  });

  it("does not remove meaningful punctuation for automatic name matching", async () => {
    const punctuated = {
      ...galbotix,
      companyId: "company-x-one",
      nameEn: "Robot X-1",
      aliases: [],
    } satisfies Company;
    const result = await new CompanyResolutionService(
      directory([punctuated]),
    ).resolve({ companyName: "Robot X1" });
    expect(result.companyId).toBeNull();
    expect(result.status).toBe("SUGGESTED");
  });

  it("returns ambiguous suggestions when exact evidence points to different companies", async () => {
    const result = await new CompanyResolutionService(
      directory([companyFixture, galbotix]),
    ).resolve({
      companyName: "Galbot",
      websiteUrl: galbotix.website,
    });
    expect(result).toMatchObject({
      status: "AMBIGUOUS",
      companyId: null,
      matchedBy: null,
    });
    expect(result.suggestions.map((item) => item.companyId)).toEqual([
      companyFixture.companyId,
      galbotix.companyId,
    ]);
  });

  it("returns unmatched for a distinct company without plausible suggestions", async () => {
    const result = await new CompanyResolutionService(
      directory([companyFixture, galbotix]),
    ).resolve({ companyName: "Boston Dynamics" });
    expect(result).toEqual({
      status: "UNMATCHED",
      companyId: null,
      matchedBy: null,
      suggestions: [],
    });
  });

  it("rejects unsafe website hints and malformed company directory records", async () => {
    const service = new CompanyResolutionService(directory([companyFixture]));
    await expect(service.resolve({
      companyName: "Galbot",
      websiteUrl: "http://127.0.0.1/company",
    })).rejects.toMatchObject({
      code: "COMPANY_RESOLUTION_INPUT_INVALID",
    });

    const malformed = directory([
      { ...companyFixture, website: "http://localhost/" },
    ]);
    await expect(
      new CompanyResolutionService(malformed).resolve({ companyName: "Galbot" }),
    ).rejects.toMatchObject({
      name: "CompanyResolutionError",
      code: "COMPANY_DIRECTORY_INVALID",
    } satisfies Partial<CompanyResolutionError>);
  });

  it("adapts Feishu repository records without modifying them", async () => {
    const repository = {
      list: vi.fn().mockResolvedValue([
        {
          recordId: "rec-company",
          version: 1,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
          data: companyFixture,
        },
      ]),
    };
    await expect(new FeishuCompanyDirectory(repository).listCompanies()).resolves.toEqual([
      companyFixture,
    ]);
    expect(repository.list).toHaveBeenCalledOnce();
  });
});
