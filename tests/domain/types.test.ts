import { describe, expect, it } from "vitest";

import {
  automationRunFixture,
  candidateFixture,
  commercializationDevelopmentFixture,
  companyFixture,
  digestFixture,
  fundingEventFixture,
  internalAssessmentFixture,
  publicCompanyFixture,
  publicDigestFixture,
  publicFundingEventFixture,
  publicTechnologyDevelopmentFixture,
  productDevelopmentFixture,
  technologyDevelopmentFixture,
  watchItemFixture,
} from "../fixtures/domain";
import { sortDigestSection } from "../../lib/domain";

const internalOnlyKeys = [
  "assessmentId",
  "attentionLevel",
  "strategicAssessment",
  "followUpStatus",
  "owner",
  "internalNotes",
  "reviewStatus",
  "isPublic",
  "candidateId",
] as const;

describe("domain fixtures", () => {
  it("preserves the required runtime invariants for every domain object", () => {
    expect(candidateFixture.candidateId).toMatch(/^candidate-/);
    expect(candidateFixture.extractedFacts?.amountDisclosed).toBe(false);
    expect(candidateFixture.extractedFacts?.amount).toBeNull();

    expect(fundingEventFixture.eventId).toMatch(/^event-/);
    expect(fundingEventFixture.sourceIds).toHaveLength(1);
    expect(companyFixture.companyId).toBe(fundingEventFixture.companyId);

    expect(digestFixture.fundingEventIds).toContain(fundingEventFixture.eventId);
    expect(digestFixture.technologyProductDevelopmentIds).toEqual([
      technologyDevelopmentFixture.developmentId,
      productDevelopmentFixture.developmentId,
    ]);
    expect(digestFixture.commercializationDevelopmentIds).toEqual([
      commercializationDevelopmentFixture.developmentId,
    ]);

    expect(watchItemFixture.enabled).toBe(true);
    expect(internalAssessmentFixture.companyId).toBe(companyFixture.companyId);
    expect(internalAssessmentFixture.eventId).toBeNull();
    expect(automationRunFixture.finishedAt).not.toBeNull();
  });

  it("keeps internal and pending fields out of every public DTO at runtime", () => {
    const publicRecords = [
      publicFundingEventFixture,
      publicCompanyFixture,
      publicDigestFixture,
      publicTechnologyDevelopmentFixture,
    ];

    for (const record of publicRecords) {
      for (const key of internalOnlyKeys) {
        expect(record).not.toHaveProperty(key);
      }
    }

    expect(publicFundingEventFixture.sourceEvidence[0]).not.toHaveProperty(
      "supportsFacts",
    );
    expect(publicFundingEventFixture.publicationStatus).toBe("PUBLISHED");
    expect(publicDigestFixture.publicationStatus).toBe("PUBLISHED");
    expect(publicDigestFixture).not.toHaveProperty("sources");
    for (const section of [
      publicDigestFixture.funding,
      publicDigestFixture.technologyProduct,
      publicDigestFixture.commercialization,
    ]) {
      for (const item of section) {
        expect(item.sources.length).toBeGreaterThan(0);
      }
    }
  });

  it("sorts each digest section by importance unless manual order overrides it", () => {
    const defaultOrder = sortDigestSection(
      [
        { id: productDevelopmentFixture.developmentId, importanceScore: 4 },
        { id: technologyDevelopmentFixture.developmentId, importanceScore: 5 },
      ],
      [],
      "TECHNOLOGY_PRODUCT",
    );
    expect(defaultOrder.map((item) => item.id)).toEqual([
      technologyDevelopmentFixture.developmentId,
      productDevelopmentFixture.developmentId,
    ]);

    const manualOrder = sortDigestSection(
      [
        { id: technologyDevelopmentFixture.developmentId, importanceScore: 5 },
        { id: productDevelopmentFixture.developmentId, importanceScore: 4 },
      ],
      digestFixture.sectionOrder,
      "TECHNOLOGY_PRODUCT",
    );
    expect(manualOrder.map((item) => item.id)).toEqual([
      productDevelopmentFixture.developmentId,
      technologyDevelopmentFixture.developmentId,
    ]);
  });
});
