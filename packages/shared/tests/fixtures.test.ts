import { describe, expect, it } from "vitest";
import { defaultQuestion, getDefaultQuestion, getProviderProfiles, providerProfiles } from "../src/fixtures";

describe("provider fixtures", () => {
  it("defines the demo question and three provider profiles", () => {
    expect(defaultQuestion).toContain("blockchain transaction execution acceleration");
    expect(getDefaultQuestion("zh")).toContain("区块链交易执行加速");
    expect(providerProfiles).toHaveLength(3);
    expect(getProviderProfiles("zh")[0].name).toContain("区块链系统专家");
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
