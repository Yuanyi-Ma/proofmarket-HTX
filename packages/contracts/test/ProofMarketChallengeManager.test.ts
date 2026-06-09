import { expect } from "chai";
import { ethers } from "hardhat";

describe("ProofMarketChallengeManager", () => {
  const ChallengeType = {
    CoverageMiss: 4n
  } as const;
  const ChallengeResult = {
    Pending: 0n,
    ProviderFault: 1n,
    ProviderNotFault: 2n
  } as const;

  async function expectRevert(
    promise: Promise<unknown>,
    message: string
  ): Promise<void> {
    let error: unknown;

    try {
      await promise;
    } catch (caught) {
      error = caught;
    }

    expect(error, `expected revert containing "${message}"`).to.be.instanceOf(
      Error
    );
    expect((error as Error).message).to.include(message);
  }

  async function expectEvent(
    transactionPromise: Promise<any>,
    contract: any,
    eventName: string,
    expectedArgs: readonly unknown[]
  ): Promise<void> {
    const transaction = await transactionPromise;
    const receipt = await transaction.wait();
    const matchingEvents = receipt.logs
      .map((log: unknown) => contract.interface.parseLog(log))
      .filter((event: { name: string } | null) => event?.name === eventName);

    expect(matchingEvents.length, `expected ${eventName} event`).to.be.greaterThan(
      0
    );
    const args = Array.from(matchingEvents[0].args).slice(
      0,
      expectedArgs.length
    );
    expect(args).to.deep.equal([...expectedArgs]);
  }

  async function deployFixture() {
    const [resolver, other] = await ethers.getSigners();
    const Manager = await ethers.getContractFactory("ProofMarketChallengeManager");
    const manager = await Manager.deploy(resolver.address);
    const challengeHash = ethers.keccak256(
      ethers.toUtf8Bytes("coverage miss: no Block-STM evidence")
    );

    return { resolver, other, manager, challengeHash };
  }

  it("opens and resolves a provider-fault coverage challenge once", async () => {
    const { manager, challengeHash } = await deployFixture();

    await expectEvent(
      manager.openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
      manager,
      "ChallengeOpened",
      [1n, 1n, ChallengeType.CoverageMiss, challengeHash]
    );

    await expectEvent(
      manager.resolve(1, ChallengeResult.ProviderFault),
      manager,
      "ChallengeResolved",
      [1n, ChallengeResult.ProviderFault]
    );

    const challenge = await manager.challenges(1);
    expect(challenge.result).to.equal(ChallengeResult.ProviderFault);

    await expectRevert(
      manager.resolve(1, ChallengeResult.ProviderNotFault),
      "already resolved"
    );
  });

  it("requires the resolver to resolve a challenge", async () => {
    const { manager, other, challengeHash } = await deployFixture();

    await manager.openChallenge(1, ChallengeType.CoverageMiss, challengeHash);

    await expectRevert(
      manager.connect(other).resolve(1, ChallengeResult.ProviderFault),
      "only resolver"
    );
  });

  it("rejects invalid challenge records", async () => {
    const { manager, challengeHash } = await deployFixture();

    await expectRevert(
      manager.openChallenge(0, ChallengeType.CoverageMiss, challengeHash),
      "job required"
    );

    await expectRevert(
      manager.openChallenge(1, ChallengeType.CoverageMiss, ethers.ZeroHash),
      "challenge hash required"
    );
  });

  it("rejects unknown challenges and pending resolution results", async () => {
    const { manager, challengeHash } = await deployFixture();

    await expectRevert(
      manager.resolve(1, ChallengeResult.ProviderFault),
      "challenge not found"
    );

    await manager.openChallenge(1, ChallengeType.CoverageMiss, challengeHash);

    await expectRevert(manager.resolve(1, ChallengeResult.Pending), "result required");
  });
});
