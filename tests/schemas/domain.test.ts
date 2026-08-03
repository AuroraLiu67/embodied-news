import { describe, expect, it } from "vitest";

import {
  automationRunSchema,
  companyDevelopmentSchema,
  companySchema,
  dailyDigestSchema,
  fundingEventSchema,
  informationSourceSchema,
  internalAssessmentSchema,
  researchCandidateSchema,
  watchItemSchema,
} from "../../lib/domain";
import {
  automationRunFixture,
  candidateFixture,
  commercializationDevelopmentFixture,
  companyFixture,
  digestFixture,
  fundingEventFixture,
  informationSourceFixture,
  internalAssessmentFixture,
  productDevelopmentFixture,
  technologyDevelopmentFixture,
  watchItemFixture,
} from "../fixtures/domain";

describe("domain runtime schemas", () => {
  it("accepts every legal A02 domain fixture", () => {
    expect(researchCandidateSchema.safeParse(candidateFixture).success).toBe(true);
    expect(fundingEventSchema.safeParse(fundingEventFixture).success).toBe(true);
    expect(
      informationSourceSchema.safeParse(informationSourceFixture).success,
    ).toBe(true);
    expect(
      companyDevelopmentSchema.safeParse(technologyDevelopmentFixture).success,
    ).toBe(true);
    expect(
      companyDevelopmentSchema.safeParse(productDevelopmentFixture).success,
    ).toBe(true);
    expect(
      companyDevelopmentSchema.safeParse(commercializationDevelopmentFixture).success,
    ).toBe(true);
    expect(companySchema.safeParse(companyFixture).success).toBe(true);
    expect(dailyDigestSchema.safeParse(digestFixture).success).toBe(true);
    expect(watchItemSchema.safeParse(watchItemFixture).success).toBe(true);
    expect(
      internalAssessmentSchema.safeParse(internalAssessmentFixture).success,
    ).toBe(true);
    expect(automationRunSchema.safeParse(automationRunFixture).success).toBe(true);
  });

  it("rejects an illegal company development category", () => {
    expect(
      companyDevelopmentSchema.safeParse({
        ...technologyDevelopmentFixture,
        category: "RESEARCH",
      }).success,
    ).toBe(false);
  });

  it("requires original sources before publishable content can be public", () => {
    expect(
      fundingEventSchema.safeParse({
        ...fundingEventFixture,
        sourceIds: [],
      }).success,
    ).toBe(false);
    expect(
      companyDevelopmentSchema.safeParse({
        ...technologyDevelopmentFixture,
        sourceIds: [],
      }).success,
    ).toBe(false);
  });

  it("restricts importance scores to integers from one through five", () => {
    expect(
      fundingEventSchema.safeParse({
        ...fundingEventFixture,
        importanceScore: 6,
      }).success,
    ).toBe(false);
    expect(
      companyDevelopmentSchema.safeParse({
        ...technologyDevelopmentFixture,
        importanceScore: 0,
      }).success,
    ).toBe(false);
  });

  it("enforces disclosed amount consistency", () => {
    expect(
      fundingEventSchema.safeParse({
        ...fundingEventFixture,
        amountDisclosed: false,
        amount: "1000000",
        currency: "USD",
      }).success,
    ).toBe(false);
  });

  it("requires the model that produced a saved relevance assessment", () => {
    const relevance = { ...candidateFixture.relevance } as Partial<
      typeof candidateFixture.relevance
    >;
    delete relevance.model;
    expect(
      researchCandidateSchema.safeParse({ ...candidateFixture, relevance }).success,
    ).toBe(false);
  });

  it("rejects impossible internal assessment targets", () => {
    expect(
      internalAssessmentSchema.safeParse({
        ...internalAssessmentFixture,
        eventId: "event-2026-001",
      }).success,
    ).toBe(false);
  });
});
