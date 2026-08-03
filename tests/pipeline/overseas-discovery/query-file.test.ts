import { describe, expect, it } from "vitest";

import {
  parseOverseasDiscoveryQueryFile,
} from "../../../lib/pipeline/overseas-discovery";

describe("D05.1 overseas discovery query file", () => {
  it("accepts a strict versioned query file", () => {
    expect(
      parseOverseasDiscoveryQueryFile({
        schemaVersion: "1",
        queries: [
          {
            queryId: "priority-companies",
            query: "search priority embodied AI companies",
          },
        ],
      }),
    ).toEqual({
      schemaVersion: "1",
      queries: [
        {
          queryId: "priority-companies",
          query: "search priority embodied AI companies",
        },
      ],
    });
  });

  it("rejects unknown fields and duplicate query IDs", () => {
    expect(() =>
      parseOverseasDiscoveryQueryFile({
        schemaVersion: "1",
        queries: [
          { queryId: "duplicate", query: "first", publicationStatus: "PUBLISHED" },
          { queryId: "duplicate", query: "second" },
        ],
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "OVERSEAS_DISCOVERY_QUERY_FILE_INVALID",
      }),
    );
  });
});
