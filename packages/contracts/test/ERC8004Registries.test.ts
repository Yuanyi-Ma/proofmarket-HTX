import { expect } from "chai";
import { ethers } from "hardhat";

describe("ERC8004 minimal registries", () => {
  it("registers agents and records reputation summaries", async () => {
    const [owner, rater] = await ethers.getSigners();

    const Identity = await ethers.getContractFactory("ProofMarketIdentityRegistry");
    const identity = await Identity.deploy();
    await identity.waitForDeployment();

    const Reputation = await ethers.getContractFactory("ProofMarketReputationRegistry");
    const reputation = await Reputation.deploy(await identity.getAddress());
    await reputation.waitForDeployment();

    const registerTx = await identity.register("proofmarket://agent/execution-research-expert");
    const receipt = await registerTx.wait();
    const registered = receipt?.logs
      .map((log) => {
        try {
          return identity.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event) => event?.name === "Registered");
    const agentId = registered?.args.agentId as bigint;

    expect(agentId).to.equal(1n);
    expect(await identity.ownerOf(agentId)).to.equal(owner.address);
    expect(await identity.tokenURI(agentId)).to.equal(
      "proofmarket://agent/execution-research-expert"
    );

    await expect(
      reputation.giveFeedback(
        agentId,
        500,
        2,
        "proofmarket",
        "self",
        "",
        "proofmarket://self",
        ethers.ZeroHash
      )
    ).to.be.revertedWith("Self-feedback not allowed");

    await reputation
      .connect(rater)
      .giveFeedback(
        agentId,
        480,
        2,
        "proofmarket",
        "seed",
        "",
        "proofmarket://seed/execution-research-expert",
        ethers.ZeroHash
      );

    expect(await reputation.getClients(agentId)).to.deep.equal([rater.address]);

    const summary = await reputation.getSummary(
      agentId,
      [rater.address],
      "proofmarket",
      "seed"
    );
    expect(summary.count).to.equal(1n);
    expect(summary.summaryValue).to.equal(480n);
    expect(summary.summaryValueDecimals).to.equal(2n);
  });
});
