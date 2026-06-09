import { describe, expect, it } from "vitest";
import { defaultQuestion, providerProfiles } from "../src/fixtures";

describe("provider fixtures", () => {
  it("defines the demo question and three provider profiles", () => {
    expect(defaultQuestion).toContain("区块链交易执行加速");
    expect(providerProfiles).toHaveLength(3);
    expect(providerProfiles.map((provider) => provider.id)).toEqual([
      "execution-research-expert",
      "shallow-search-provider",
      "general-web-summary"
    ]);
  });

  it("marks the recommended provider as the happy-path demo provider", () => {
    expect(providerProfiles[0]).toMatchObject({
      role: "recommended",
      demoBehavior: "happy",
      reputationScore: 970
    });
  });
});
