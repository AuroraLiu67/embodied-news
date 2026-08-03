import { describe, expect, it } from "vitest";

import { site } from "../lib/site";

describe("site metadata", () => {
  it("provides the minimum homepage content", () => {
    expect(site.name).toBe("具身智能融资雷达");
    expect(site.eyebrow).toMatch(/Funding Radar/);
    expect(site.summary.length).toBeGreaterThan(20);
  });
});
