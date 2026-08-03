export const openAIResearchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "relevance",
    "extractedFacts",
    "conflicts",
    "sources",
    "publicSummary",
    "publicWhyItMatters",
  ],
  properties: {
    relevance: {
      type: "object",
      additionalProperties: false,
      required: ["decision", "confidence", "reason"],
      properties: {
        decision: {
          type: "string",
          enum: ["RELEVANT", "NOT_RELEVANT", "UNCERTAIN"],
        },
        confidence: {
          type: "object",
          additionalProperties: false,
          required: ["level", "score", "reasons"],
          properties: {
            level: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            score: { type: "number", minimum: 0, maximum: 1 },
            reasons: {
              type: "array",
              maxItems: 20,
              items: { type: "string", maxLength: 500 },
            },
          },
        },
        reason: { type: "string", maxLength: 1000 },
      },
    },
    extractedFacts: {
      type: "object",
      additionalProperties: false,
      required: [
        "companyName",
        "round",
        "amount",
        "currency",
        "amountDisclosed",
        "investors",
        "announcedAt",
        "region",
        "technologyTags",
      ],
      properties: {
        companyName: { type: ["string", "null"], maxLength: 300 },
        round: { type: ["string", "null"], maxLength: 100 },
        amount: {
          anyOf: [
            { type: "string", pattern: "^(0|[1-9][0-9]{0,99})(\\.[0-9]{1,18})?$" },
            { type: "null" },
          ],
        },
        currency: {
          type: ["string", "null"],
          enum: ["CNY", "USD", "EUR", "GBP", "JPY", "KRW", "OTHER", null],
        },
        amountDisclosed: { type: "boolean" },
        investors: {
          type: "array",
          maxItems: 100,
          items: { type: "string", maxLength: 300 },
        },
        announcedAt: {
          anyOf: [
            { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
            { type: "null" },
          ],
        },
        region: { type: ["string", "null"], maxLength: 100 },
        technologyTags: {
          type: "array",
          maxItems: 30,
          items: { type: "string", maxLength: 100 },
        },
      },
    },
    conflicts: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "values"],
        properties: {
          field: {
            type: "string",
            enum: [
              "companyName",
              "round",
              "amount",
              "currency",
              "amountDisclosed",
              "investors",
              "announcedAt",
              "region",
              "technologyTags",
            ],
          },
          values: {
            type: "array",
            minItems: 2,
            maxItems: 20,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["value", "sourceUrl"],
              properties: {
                value: { type: "string", maxLength: 500 },
                sourceUrl: { type: "string", maxLength: 2048 },
              },
            },
          },
        },
      },
    },
    sources: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sourceUrl",
          "sourceName",
          "sourceType",
          "sourceTier",
          "title",
          "publishedAt",
          "supportsFacts",
        ],
        properties: {
          sourceUrl: { type: "string", maxLength: 2048 },
          sourceName: { type: "string", maxLength: 200 },
          sourceType: {
            type: "string",
            enum: [
              "COMPANY",
              "INVESTOR",
              "REGULATOR",
              "GOVERNMENT",
              "FA",
              "MEDIA",
              "SOCIAL",
            ],
          },
          sourceTier: {
            type: "string",
            enum: ["PRIMARY", "AUTHORITATIVE", "SECONDARY"],
          },
          title: { type: "string", maxLength: 500 },
          publishedAt: {
            anyOf: [
              { type: "string", format: "date-time" },
              { type: "null" },
            ],
          },
          supportsFacts: {
            type: "array",
            minItems: 1,
            maxItems: 9,
            items: {
              type: "string",
              enum: [
                "companyName",
                "round",
                "amount",
                "currency",
                "amountDisclosed",
                "investors",
                "announcedAt",
                "region",
                "technologyTags",
              ],
            },
          },
        },
      },
    },
    publicSummary: { type: "string", maxLength: 2000 },
    publicWhyItMatters: { type: "string", maxLength: 1000 },
  },
} as const;
