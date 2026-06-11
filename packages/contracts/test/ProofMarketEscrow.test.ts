import { expect } from "chai";
import { ethers } from "hardhat";

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

describe("ProofMarketEscrow", () => {
  const budget = 1_000_000n;
  const minStake = 10_000_000n;
  const challengeDeposit = 2_000_000n;
  const juryFee = 500_000n;
  const defenseWindow = 120n;
  const JobState = {
    Open: 0n,
    Funded: 1n,
    Submitted: 2n,
    Completed: 3n,
    Rejected: 4n,
    Expired: 5n,
    Challenged: 6n
  } as const;

  async function deployFixture() {
    const [client, provider, evaluator, other, resolver, treasury, juror1, juror2, juror3] =
      await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();
    await token.mint(client.address, budget);

    const Escrow = await ethers.getContractFactory("ProofMarketEscrow");
    // Escrow flow tests are not about the W_c gate: zero window so complete()
    // works without time warps. The gate has its own describe block below.
    const escrow = await Escrow.deploy(0);

    const Manager = await ethers.getContractFactory(
      "ProofMarketChallengeManager"
    );
    const manager = await Manager.deploy(
      await token.getAddress(),
      treasury.address,
      minStake,
      challengeDeposit,
      5_000n,
      5_000n,
      juryFee,
      defenseWindow,
      3n
    );

    await escrow.connect(client).setChallengeManager(await manager.getAddress());
    await manager.connect(client).setEscrow(await escrow.getAddress());

    const jurorSigners = [juror1, juror2, juror3];
    for (const [i, juror] of jurorSigners.entries()) {
      await manager
        .connect(client)
        .registerJuror(
          juror.address,
          ethers.keccak256(ethers.toUtf8Bytes(`model-${i}`)),
          ethers.keccak256(ethers.toUtf8Bytes(`prompt-${i}`))
        );
    }

    // Stake the provider so createJob passes the min-stake gate.
    await token.mint(provider.address, minStake);
    await token.connect(provider).approve(await manager.getAddress(), minStake);
    await manager.connect(provider).depositStake(minStake);

    const latestBlock = await ethers.provider.getBlock("latest");
    const expiredAt = BigInt((latestBlock?.timestamp ?? 0) + 1800);
    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("task_001"));
    const coverageHash = ethers.keccak256(ethers.toUtf8Bytes("coverage"));
    const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("package"));
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("valid"));

    return {
      client,
      provider,
      evaluator,
      other,
      resolver,
      treasury,
      juror1,
      juror2,
      juror3,
      token,
      escrow,
      manager,
      expiredAt,
      descriptionHash,
      coverageHash,
      deliverableHash,
      reasonHash
    };
  }

  async function advancePastExpiry(expiredAt: bigint) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(expiredAt) + 1]);
    await ethers.provider.send("evm_mine", []);
  }

  async function createJob() {
    const fixture = await deployFixture();

    await expectEvent(
      fixture.escrow.createJob(
        1,
        fixture.provider.address,
        4,
        fixture.evaluator.address,
        await fixture.token.getAddress(),
        fixture.expiredAt,
        fixture.descriptionHash,
        fixture.coverageHash
      ),
      fixture.escrow,
      "JobCreated",
      [1n, fixture.client.address, fixture.provider.address]
    );

    return fixture;
  }

  async function createAndFundJob() {
    const fixture = await createJob();

    await fixture.escrow.setBudget(1, budget);
    await fixture.token.approve(await fixture.escrow.getAddress(), budget);

    await expectEvent(fixture.escrow.fund(1, budget), fixture.escrow, "JobFunded", [
      1n,
      budget
    ]);

    return fixture;
  }

  it("creates, funds, submits, and completes one job", async () => {
    const { escrow, token, provider, evaluator, deliverableHash, reasonHash } =
      await createAndFundJob();

    await expectEvent(
      escrow.connect(provider).submit(1, deliverableHash),
      escrow,
      "DeliverableSubmitted",
      [1n, deliverableHash]
    );

    await expectEvent(
      escrow.connect(evaluator).complete(1, reasonHash),
      escrow,
      "JobCompleted",
      [1n, reasonHash]
    );

    expect(await token.balanceOf(provider.address)).to.equal(budget);
    const job = await escrow.jobs(1);
    expect(job.state).to.equal(JobState.Completed);
    expect(job.deliverableHash).to.equal(deliverableHash);
  });

  it("refunds the client when the evaluator rejects a funded job", async () => {
    const { escrow, token, client, evaluator, reasonHash } = await createAndFundJob();

    expect(await token.balanceOf(client.address)).to.equal(0n);

    await expectEvent(
      escrow.connect(evaluator).reject(1, reasonHash),
      escrow,
      "JobRejected",
      [1n, reasonHash]
    );

    expect(await token.balanceOf(client.address)).to.equal(budget);
    const job = await escrow.jobs(1);
    expect(job.state).to.equal(JobState.Rejected);
  });

  it("prevents provider submission after the funded job expires", async () => {
    const { escrow, provider, expiredAt, deliverableHash } = await createAndFundJob();

    await advancePastExpiry(expiredAt);

    await expectRevert(
      escrow.connect(provider).submit(1, deliverableHash),
      "job expired"
    );
  });

  it("lets the client expire and refund a funded job after expiry", async () => {
    const { escrow, token, client, expiredAt } = await createAndFundJob();

    await advancePastExpiry(expiredAt);

    await expectEvent(escrow.expireAndRefund(1), escrow, "JobExpired", [1n]);

    expect(await token.balanceOf(client.address)).to.equal(budget);
    const job = await escrow.jobs(1);
    expect(job.state).to.equal(JobState.Expired);
  });

  it("enforces client-only budget and funding operations", async () => {
    const { escrow, token, other } = await createJob();

    await expectRevert(escrow.connect(other).setBudget(1, budget), "only client");

    await escrow.setBudget(1, budget);
    await token.approve(await escrow.getAddress(), budget);

    await expectRevert(escrow.connect(other).fund(1, budget), "only client");
  });

  it("rejects zero budgets", async () => {
    const { escrow } = await createJob();

    await expectRevert(escrow.setBudget(1, 0n), "budget required");
  });

  it("rejects fund calls with the wrong expected amount", async () => {
    const { escrow, token } = await createJob();

    await escrow.setBudget(1, budget);
    await token.approve(await escrow.getAddress(), budget);

    await expectRevert(escrow.fund(1, budget - 1n), "amount mismatch");
  });

  it("rejects open-state operations after a job is funded", async () => {
    const { escrow } = await createAndFundJob();

    await expectRevert(escrow.setBudget(1, budget), "not open");
    await expectRevert(escrow.fund(1, budget), "not open");
  });

  it("rejects submit when the job is not funded", async () => {
    const { escrow, provider, deliverableHash } = await createJob();

    await expectRevert(
      escrow.connect(provider).submit(1, deliverableHash),
      "not funded"
    );
  });

  it("rejects complete when the job is not submitted", async () => {
    const { escrow, evaluator, reasonHash } = await createAndFundJob();

    await expectRevert(
      escrow.connect(evaluator).complete(1, reasonHash),
      "not submitted"
    );
  });

  it("rejects refund expiry before the funded job is expired", async () => {
    const { escrow } = await createAndFundJob();

    await expectRevert(escrow.expireAndRefund(1), "job not expired");
  });

  it("rejects expiry refund when the job is not rejectable as expired", async () => {
    const { escrow, expiredAt } = await createJob();

    await advancePastExpiry(expiredAt);

    await expectRevert(escrow.expireAndRefund(1), "not funded");
  });

  it("rejects evaluator rejection when the job is not rejectable", async () => {
    const { escrow, evaluator, reasonHash } = await createJob();

    await expectRevert(
      escrow.connect(evaluator).reject(1, reasonHash),
      "not rejectable"
    );
  });

  it("rejects job creation for a provider below the minimum stake", async () => {
    const fixture = await deployFixture();

    await expectRevert(
      fixture.escrow.createJob(
        1,
        fixture.other.address, // unstaked provider
        4,
        fixture.evaluator.address,
        await fixture.token.getAddress(),
        fixture.expiredAt,
        fixture.descriptionHash,
        fixture.coverageHash
      ),
      "provider stake too low"
    );

    // Partial stake below the minimum is still rejected.
    await fixture.token.mint(fixture.other.address, minStake - 1n);
    await fixture.token
      .connect(fixture.other)
      .approve(await fixture.manager.getAddress(), minStake - 1n);
    await fixture.manager.connect(fixture.other).depositStake(minStake - 1n);

    await expectRevert(
      fixture.escrow.createJob(
        1,
        fixture.other.address,
        4,
        fixture.evaluator.address,
        await fixture.token.getAddress(),
        fixture.expiredAt,
        fixture.descriptionHash,
        fixture.coverageHash
      ),
      "provider stake too low"
    );
  });

  it("rejects job creation when no challenge manager is wired", async () => {
    const fixture = await deployFixture();

    const Escrow = await ethers.getContractFactory("ProofMarketEscrow");
    const bareEscrow = await Escrow.deploy(0);

    await expectRevert(
      bareEscrow.createJob(
        1,
        fixture.provider.address,
        4,
        fixture.evaluator.address,
        await fixture.token.getAddress(),
        fixture.expiredAt,
        fixture.descriptionHash,
        fixture.coverageHash
      ),
      "provider stake too low"
    );
  });

  it("only the owner can set the challenge manager, and only once", async () => {
    const fixture = await deployFixture();

    const Escrow = await ethers.getContractFactory("ProofMarketEscrow");
    const bareEscrow = await Escrow.deploy(0);

    await expectRevert(
      bareEscrow
        .connect(fixture.other)
        .setChallengeManager(await fixture.manager.getAddress()),
      "only owner"
    );

    await bareEscrow.setChallengeManager(await fixture.manager.getAddress());
    expect(await bareEscrow.challengeManager()).to.equal(
      await fixture.manager.getAddress()
    );

    await expectRevert(
      bareEscrow.setChallengeManager(await fixture.manager.getAddress()),
      "challenge manager already set"
    );
  });

  it("exposes the job parties for challenge binding", async () => {
    const { escrow, client, provider, evaluator } = await createJob();

    const [partyClient, partyProvider, partyEvaluator] =
      await escrow.jobParties(1);
    expect(partyClient).to.equal(client.address);
    expect(partyProvider).to.equal(provider.address);
    expect(partyEvaluator).to.equal(evaluator.address);

    // Nonexistent jobs return zero parties.
    const [noClient, noProvider] = await escrow.jobParties(99);
    expect(noClient).to.equal(ethers.ZeroAddress);
    expect(noProvider).to.equal(ethers.ZeroAddress);
  });

  it("bonds provider stake on createJob and releases it when the evaluator rejects", async () => {
    const { escrow, manager, provider, evaluator, reasonHash } =
      await createAndFundJob();

    expect(await manager.lockedStake(provider.address)).to.equal(minStake);
    await expectRevert(
      manager.connect(provider).withdrawStake(minStake),
      "insufficient stake"
    );

    await escrow.connect(evaluator).reject(1, reasonHash);

    expect(await manager.lockedStake(provider.address)).to.equal(0n);
    await manager.connect(provider).withdrawStake(minStake);
  });

  it("releases the provider bond when an expired job is refunded", async () => {
    const { escrow, manager, provider, expiredAt } = await createAndFundJob();

    expect(await manager.lockedStake(provider.address)).to.equal(minStake);

    await advancePastExpiry(expiredAt);
    await escrow.expireAndRefund(1);

    expect(await manager.lockedStake(provider.address)).to.equal(0n);
    await manager.connect(provider).withdrawStake(minStake);
  });

  it("restores a Funded job to Funded when a challenge fails (HIGH-3)", async () => {
    const {
      escrow,
      manager,
      token,
      provider,
      evaluator,
      other,
      juror1,
      juror2,
      reasonHash
    } = await createAndFundJob();

    const challengeHash = ethers.keccak256(
      ethers.toUtf8Bytes("premature challenge")
    );
    await token.mint(evaluator.address, challengeDeposit + juryFee);
    await token
      .connect(evaluator)
      .approve(await manager.getAddress(), challengeDeposit + juryFee);

    await manager.connect(evaluator).openChallenge(1, 4, challengeHash);
    let job = await escrow.jobs(1);
    expect(job.state).to.equal(JobState.Challenged);

    // ProviderNotFault majority unfreezes back to the pre-challenge state.
    await ethers.provider.send("evm_increaseTime", [Number(defenseWindow) + 1]);
    await ethers.provider.send("evm_mine", []);
    const reasonBookHash = ethers.keccak256(ethers.toUtf8Bytes("reason book"));
    await manager.connect(juror1).castVote(1, 2, reasonBookHash);
    await manager.connect(juror2).castVote(1, 2, reasonBookHash);
    await manager.connect(other).resolve(1);
    job = await escrow.jobs(1);
    expect(job.state).to.equal(JobState.Funded);

    // A never-submitted job still cannot pay out.
    await expectRevert(
      escrow.connect(evaluator).complete(1, reasonHash),
      "not submitted"
    );
    expect(await token.balanceOf(provider.address)).to.equal(0n);
  });

  it("restricts challenge hooks to the challenge manager", async () => {
    const { escrow, other } = await createAndFundJob();

    await expectRevert(
      escrow.connect(other).markChallenged(1),
      "only challenge manager"
    );
    await expectRevert(
      escrow.connect(other).refundForChallenge(1),
      "only challenge manager"
    );
    await expectRevert(
      escrow.connect(other).unfreezeForChallenge(1),
      "only challenge manager"
    );
  });

  it("enforces provider-only submit and evaluator-only completion", async () => {
    const { escrow, provider, other, deliverableHash, reasonHash } =
      await createAndFundJob();

    await expectRevert(
      escrow.connect(other).submit(1, deliverableHash),
      "only provider"
    );

    await escrow.connect(provider).submit(1, deliverableHash);

    await expectRevert(
      escrow.connect(other).complete(1, reasonHash),
      "only evaluator"
    );
  });

  describe("challenge window gate (W_c)", () => {
    const challengeWindow = 300n;

    it("blocks complete until the window after submit has fully passed", async () => {
      const fixture = await deployFixture();
      const { token, manager, client, provider, evaluator, deliverableHash, reasonHash } =
        fixture;

      const Escrow = await ethers.getContractFactory("ProofMarketEscrow");
      const gated = await Escrow.deploy(challengeWindow);
      expect(await gated.challengeWindow()).to.equal(challengeWindow);

      // Wire a fresh manager (the fixture manager is bound to the other escrow).
      const Manager = await ethers.getContractFactory("ProofMarketChallengeManager");
      const gatedManager = await Manager.deploy(
        await token.getAddress(),
        evaluator.address,
        minStake,
        challengeDeposit,
        5_000n,
        5_000n,
        juryFee,
        defenseWindow,
        3n
      );
      await gated.setChallengeManager(await gatedManager.getAddress());
      await gatedManager.setEscrow(await gated.getAddress());
      await token.mint(provider.address, minStake);
      await token.connect(provider).approve(await gatedManager.getAddress(), minStake);
      await gatedManager.connect(provider).depositStake(minStake);

      const latestBlock = await ethers.provider.getBlock("latest");
      const expiredAt = BigInt((latestBlock?.timestamp ?? 0) + 360000);
      await gated
        .connect(client)
        .createJob(
          1,
          provider.address,
          4,
          evaluator.address,
          await token.getAddress(),
          expiredAt,
          fixture.descriptionHash,
          fixture.coverageHash
        );
      await gated.connect(client).setBudget(1, budget);
      await token.mint(client.address, budget);
      await token.connect(client).approve(await gated.getAddress(), budget);
      await gated.connect(client).fund(1, budget);
      await gated.connect(provider).submit(1, deliverableHash);
      expect(await gated.submittedAt(1)).to.be.greaterThan(0n);

      // Inside the window: payout blocked, the challenge right is protected.
      await expectRevert(
        gated.connect(evaluator).complete(1, reasonHash),
        "challenge window open"
      );

      await ethers.provider.send("evm_increaseTime", [Number(challengeWindow) + 1]);
      await ethers.provider.send("evm_mine", []);

      await gated.connect(evaluator).complete(1, reasonHash);
      const job = await gated.jobs(1);
      expect(job.state).to.equal(JobState.Completed);
      expect(await token.balanceOf(provider.address)).to.equal(budget);
    });
  });
});

describe("MockUSDC", () => {
  it("uses six decimals and decreases allowance on transferFrom", async () => {
    const [owner, spender, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();

    await token.mint(owner.address, 100n);
    await token.approve(spender.address, 60n);
    await token.connect(spender).transferFrom(owner.address, recipient.address, 40n);

    expect(await token.decimals()).to.equal(6);
    expect(await token.allowance(owner.address, spender.address)).to.equal(20n);
    expect(await token.balanceOf(recipient.address)).to.equal(40n);
  });

  it("reverts transfers with insufficient balance or allowance", async () => {
    const [owner, spender, recipient] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();

    await expectRevert(token.transfer(recipient.address, 1n), "insufficient balance");

    await token.mint(owner.address, 10n);
    await expectRevert(
      token.connect(spender).transferFrom(owner.address, recipient.address, 1n),
      "insufficient allowance"
    );
  });
});
