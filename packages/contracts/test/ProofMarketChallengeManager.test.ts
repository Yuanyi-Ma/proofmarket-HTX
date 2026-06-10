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
  const JobState = {
    Open: 0n,
    Funded: 1n,
    Submitted: 2n,
    Completed: 3n,
    Rejected: 4n,
    Expired: 5n,
    Challenged: 6n
  } as const;

  const minStake = 10_000_000n;
  const challengeDeposit = 2_000_000n;
  const slashBps = 5_000n;
  const slashRewardBps = 5_000n;
  const budget = 1_000_000n;

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
      .map((log: unknown) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
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
    const [deployer, resolver, treasury, client, provider, evaluator, challenger, other] =
      await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();

    const Escrow = await ethers.getContractFactory("ProofMarketEscrow");
    const escrow = await Escrow.deploy();

    const Manager = await ethers.getContractFactory("ProofMarketChallengeManager");
    const manager = await Manager.deploy(
      await token.getAddress(),
      resolver.address,
      treasury.address,
      minStake,
      challengeDeposit,
      slashBps,
      slashRewardBps
    );

    await escrow.setChallengeManager(await manager.getAddress());
    await manager.setEscrow(await escrow.getAddress());

    // Provider stakes the exact minimum.
    await token.mint(provider.address, minStake);
    await token.connect(provider).approve(await manager.getAddress(), minStake);
    await manager.connect(provider).depositStake(minStake);

    // The evaluator is the challenging party: holds one deposit, pre-approved.
    await token.mint(evaluator.address, challengeDeposit);
    await token
      .connect(evaluator)
      .approve(await manager.getAddress(), challengeDeposit);

    // A funded, approved outsider — proves non-party rejections are about
    // authorization, not funds.
    await token.mint(challenger.address, challengeDeposit);
    await token
      .connect(challenger)
      .approve(await manager.getAddress(), challengeDeposit);

    const challengeHash = ethers.keccak256(
      ethers.toUtf8Bytes("coverage miss: no Block-STM evidence")
    );

    return {
      deployer,
      resolver,
      treasury,
      client,
      provider,
      evaluator,
      challenger,
      other,
      token,
      escrow,
      manager,
      challengeHash
    };
  }

  async function deployWithFundedJob() {
    const fixture = await deployFixture();
    const { escrow, token, client, provider, evaluator } = fixture;

    const latestBlock = await ethers.provider.getBlock("latest");
    const expiredAt = BigInt((latestBlock?.timestamp ?? 0) + 1800);
    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("task_001"));
    const coverageHash = ethers.keccak256(ethers.toUtf8Bytes("coverage"));
    const deliverableHash = ethers.keccak256(ethers.toUtf8Bytes("package"));
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("valid"));

    await escrow
      .connect(client)
      .createJob(
        1,
        provider.address,
        4,
        evaluator.address,
        await token.getAddress(),
        expiredAt,
        descriptionHash,
        coverageHash
      );
    await escrow.connect(client).setBudget(1, budget);
    await token.mint(client.address, budget);
    await token.connect(client).approve(await escrow.getAddress(), budget);
    await escrow.connect(client).fund(1, budget);

    return { ...fixture, deliverableHash, reasonHash, jobId: 1n };
  }

  async function deployWithSubmittedJob() {
    const fixture = await deployWithFundedJob();

    await fixture.escrow
      .connect(fixture.provider)
      .submit(1, fixture.deliverableHash);

    return fixture;
  }

  describe("deployment wiring", () => {
    it("only the owner can set the escrow, and only once", async () => {
      const { resolver, other, token, treasury } = await deployFixture();

      const Manager = await ethers.getContractFactory(
        "ProofMarketChallengeManager"
      );
      const fresh = await Manager.deploy(
        await token.getAddress(),
        resolver.address,
        treasury.address,
        minStake,
        challengeDeposit,
        slashBps,
        slashRewardBps
      );

      await expectRevert(
        fresh.connect(other).setEscrow(other.address),
        "only owner"
      );

      await fresh.setEscrow(other.address);
      expect(await fresh.escrow()).to.equal(other.address);

      await expectRevert(fresh.setEscrow(other.address), "escrow already set");
    });

    it("rejects opening a challenge before the escrow is wired", async () => {
      const { resolver, token, treasury, challengeHash } = await deployFixture();

      const Manager = await ethers.getContractFactory(
        "ProofMarketChallengeManager"
      );
      const fresh = await Manager.deploy(
        await token.getAddress(),
        resolver.address,
        treasury.address,
        minStake,
        challengeDeposit,
        slashBps,
        slashRewardBps
      );

      await expectRevert(
        fresh.openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
        "escrow not set"
      );
    });
  });

  describe("staking", () => {
    it("deposits and withdraws provider stake, moving tokens", async () => {
      const { manager, token, provider } = await deployFixture();

      expect(await manager.stake(provider.address)).to.equal(minStake);
      expect(await manager.hasMinStake(provider.address)).to.equal(true);
      expect(await token.balanceOf(await manager.getAddress())).to.equal(
        minStake
      );

      await expectEvent(
        manager.connect(provider).withdrawStake(minStake / 2n),
        manager,
        "StakeWithdrawn",
        [provider.address, minStake / 2n, minStake / 2n]
      );

      expect(await manager.stake(provider.address)).to.equal(minStake / 2n);
      expect(await manager.hasMinStake(provider.address)).to.equal(false);
      expect(await token.balanceOf(provider.address)).to.equal(minStake / 2n);
    });

    it("emits StakeDeposited and accumulates stake", async () => {
      const { manager, token, other } = await deployFixture();

      await token.mint(other.address, 3_000_000n);
      await token.connect(other).approve(await manager.getAddress(), 3_000_000n);

      await expectEvent(
        manager.connect(other).depositStake(1_000_000n),
        manager,
        "StakeDeposited",
        [other.address, 1_000_000n, 1_000_000n]
      );
      await expectEvent(
        manager.connect(other).depositStake(2_000_000n),
        manager,
        "StakeDeposited",
        [other.address, 2_000_000n, 3_000_000n]
      );
    });

    it("rejects withdrawing more than the staked amount", async () => {
      const { manager, provider } = await deployFixture();

      await expectRevert(
        manager.connect(provider).withdrawStake(minStake + 1n),
        "insufficient stake"
      );
    });

    it("blocks stake withdrawal while a challenge is pending against the provider", async () => {
      const { manager, provider, evaluator, challengeHash } =
        await deployWithSubmittedJob();

      await manager
        .connect(evaluator)
        .openChallenge(1, ChallengeType.CoverageMiss, challengeHash);

      await expectRevert(
        manager.connect(provider).withdrawStake(1n),
        "active challenge pending"
      );
    });

    it("bonds minStake to the job at creation so it cannot be withdrawn (HIGH-1)", async () => {
      const { manager, token, provider, evaluator, reasonHash, escrow } =
        await deployWithSubmittedJob();

      // createJob locked the full bond.
      expect(await manager.lockedStake(provider.address)).to.equal(minStake);

      // The provider cannot pull even one unit of the bonded stake.
      await expectRevert(
        manager.connect(provider).withdrawStake(1n),
        "insufficient stake"
      );
      await expectRevert(
        manager.connect(provider).withdrawStake(minStake),
        "insufficient stake"
      );

      // Terminal settlement (complete) releases the bond...
      await escrow.connect(evaluator).complete(1, reasonHash);
      expect(await manager.lockedStake(provider.address)).to.equal(0n);

      // ...and the stake becomes withdrawable again.
      await manager.connect(provider).withdrawStake(minStake);
      expect(await token.balanceOf(provider.address)).to.equal(
        minStake + budget
      );
    });

    it("rejects creating a second job that would over-commit the free stake (HIGH-1)", async () => {
      const fixture = await deployWithSubmittedJob();
      const { escrow, manager, token, client, provider, evaluator } = fixture;

      const latestBlock = await ethers.provider.getBlock("latest");
      const expiredAt = BigInt((latestBlock?.timestamp ?? 0) + 1800);
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("task_002"));
      const coverageHash = ethers.keccak256(ethers.toUtf8Bytes("coverage_2"));

      // All of the provider's stake is already bonded to job 1.
      await expectRevert(
        escrow
          .connect(client)
          .createJob(
            2,
            provider.address,
            4,
            evaluator.address,
            await token.getAddress(),
            expiredAt,
            descriptionHash,
            coverageHash
          ),
        "provider stake too low"
      );

      // Topping up free stake makes a second job possible again.
      await token.mint(provider.address, minStake);
      await token.connect(provider).approve(await manager.getAddress(), minStake);
      await manager.connect(provider).depositStake(minStake);

      await escrow
        .connect(client)
        .createJob(
          2,
          provider.address,
          4,
          evaluator.address,
          await token.getAddress(),
          expiredAt,
          descriptionHash,
          coverageHash
        );
      expect(await manager.lockedStake(provider.address)).to.equal(
        minStake * 2n
      );
    });

    it("only the escrow can lock or unlock job bonds", async () => {
      const { manager, provider, other } = await deployFixture();

      await expectRevert(
        manager.connect(other).lockStakeForJob(provider.address),
        "only escrow"
      );
      await expectRevert(
        manager.connect(other).unlockStakeForJob(provider.address),
        "only escrow"
      );
    });
  });

  describe("openChallenge", () => {
    it("locks the challenger deposit and freezes the job", async () => {
      const {
        manager,
        escrow,
        token,
        provider,
        evaluator,
        reasonHash,
        challengeHash
      } = await deployWithSubmittedJob();

      const managerBalanceBefore = await token.balanceOf(
        await manager.getAddress()
      );

      await expectEvent(
        manager
          .connect(evaluator)
          .openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
        manager,
        "ChallengeOpened",
        [1n, 1n, ChallengeType.CoverageMiss, challengeHash, evaluator.address, provider.address]
      );

      expect(await token.balanceOf(evaluator.address)).to.equal(0n);
      expect(await token.balanceOf(await manager.getAddress())).to.equal(
        managerBalanceBefore + challengeDeposit
      );

      const challenge = await manager.challenges(1);
      expect(challenge.challenger).to.equal(evaluator.address);
      // The challenged provider is bound from the job record, not caller input.
      expect(challenge.provider).to.equal(provider.address);
      expect(challenge.result).to.equal(ChallengeResult.Pending);
      expect(await manager.activeChallenges(provider.address)).to.equal(1n);

      const job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Challenged);

      // The frozen job cannot be completed.
      await expectRevert(
        escrow.connect(evaluator).complete(1, reasonHash),
        "not submitted"
      );
    });

    it("rejects challengers who are not party to the job (HIGH-2)", async () => {
      const { manager, token, client, provider, challenger, challengeHash } =
        await deployWithSubmittedJob();

      // The outsider is funded and approved, so the rejection is purely
      // an authorization failure.
      await expectRevert(
        manager
          .connect(challenger)
          .openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
        "only client or evaluator"
      );

      // The client is a valid challenger and the challenge binds to the job's
      // real provider.
      await token.mint(client.address, challengeDeposit);
      await token
        .connect(client)
        .approve(await manager.getAddress(), challengeDeposit);
      await manager
        .connect(client)
        .openChallenge(1, ChallengeType.CoverageMiss, challengeHash);

      const challenge = await manager.challenges(1);
      expect(challenge.challenger).to.equal(client.address);
      expect(challenge.provider).to.equal(provider.address);
    });

    it("rejects invalid challenge records", async () => {
      const { manager, evaluator, challengeHash } =
        await deployWithSubmittedJob();

      await expectRevert(
        manager
          .connect(evaluator)
          .openChallenge(0, ChallengeType.CoverageMiss, challengeHash),
        "job required"
      );

      await expectRevert(
        manager
          .connect(evaluator)
          .openChallenge(1, ChallengeType.CoverageMiss, ethers.ZeroHash),
        "challenge hash required"
      );

      // A nonexistent job has no provider to read from escrow.
      await expectRevert(
        manager
          .connect(evaluator)
          .openChallenge(99, ChallengeType.CoverageMiss, challengeHash),
        "job not found"
      );
    });

    it("rejects a challenger who cannot fund the deposit", async () => {
      const { manager, token, client, challengeHash } =
        await deployWithSubmittedJob();

      // The client (a valid party) spent everything funding the job:
      // the deposit transfer reverts inside the token.
      await expectRevert(
        manager
          .connect(client)
          .openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
        "insufficient balance"
      );

      // Balance but no approval: still rejected.
      await token.mint(client.address, challengeDeposit);
      await expectRevert(
        manager
          .connect(client)
          .openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
        "insufficient allowance"
      );
    });
  });

  describe("resolve", () => {
    async function openChallengeFixture() {
      const fixture = await deployWithSubmittedJob();

      await fixture.manager
        .connect(fixture.evaluator)
        .openChallenge(1, ChallengeType.CoverageMiss, fixture.challengeHash);

      return fixture;
    }

    it("ProviderFault: slashes stake, pays the challenger, funds the treasury, refunds the buyer", async () => {
      const { manager, escrow, token, resolver, treasury, client, provider, evaluator } =
        await openChallengeFixture();

      const slashAmount = (minStake * slashBps) / 10_000n; // 5 mUSDC
      const reward = (slashAmount * slashRewardBps) / 10_000n; // 2.5 mUSDC

      await expectEvent(
        manager
          .connect(resolver)
          .resolve(1, ChallengeResult.ProviderFault),
        manager,
        "ChallengeResolved",
        [
          1n,
          ChallengeResult.ProviderFault,
          slashAmount,
          reward + challengeDeposit,
          slashAmount - reward
        ]
      );

      // Provider stake slashed by 50% of the job bond.
      expect(await manager.stake(provider.address)).to.equal(
        minStake - slashAmount
      );
      // The job bond settled in resolve: nothing stays locked.
      expect(await manager.lockedStake(provider.address)).to.equal(0n);
      // Challenger (the evaluator) gets the reward plus their deposit back.
      expect(await token.balanceOf(evaluator.address)).to.equal(
        reward + challengeDeposit
      );
      // Treasury gets the rest of the slashed stake.
      expect(await token.balanceOf(treasury.address)).to.equal(
        slashAmount - reward
      );
      // Buyer is refunded the escrowed budget.
      expect(await token.balanceOf(client.address)).to.equal(budget);

      const job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Rejected);

      // Challenge is closed and the bond released, so the provider can
      // withdraw the remaining stake.
      expect(await manager.activeChallenges(provider.address)).to.equal(0n);
      await manager.connect(provider).withdrawStake(minStake - slashAmount);
      expect(await token.balanceOf(provider.address)).to.equal(
        minStake - slashAmount
      );
    });

    it("ProviderNotFault: forfeits the deposit to the treasury and unfreezes the job", async () => {
      const {
        manager,
        escrow,
        token,
        resolver,
        treasury,
        provider,
        evaluator,
        reasonHash
      } = await openChallengeFixture();

      await expectEvent(
        manager
          .connect(resolver)
          .resolve(1, ChallengeResult.ProviderNotFault),
        manager,
        "ChallengeResolved",
        [1n, ChallengeResult.ProviderNotFault, 0n, 0n, challengeDeposit]
      );

      // Deposit forfeited; stake untouched and still bonded to the live job.
      expect(await token.balanceOf(treasury.address)).to.equal(challengeDeposit);
      expect(await token.balanceOf(evaluator.address)).to.equal(0n);
      expect(await manager.stake(provider.address)).to.equal(minStake);
      expect(await manager.lockedStake(provider.address)).to.equal(minStake);

      // Job restored to Submitted, then completes normally.
      let job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Submitted);

      await escrow.connect(evaluator).complete(1, reasonHash);
      job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Completed);
      expect(await token.balanceOf(provider.address)).to.equal(budget);
      // Completion released the job bond.
      expect(await manager.lockedStake(provider.address)).to.equal(0n);
    });

    it("restores a Funded job to Funded after a failed challenge (HIGH-3)", async () => {
      const {
        manager,
        escrow,
        token,
        resolver,
        client,
        provider,
        evaluator,
        challengeHash,
        deliverableHash,
        reasonHash
      } = await deployWithFundedJob();

      // Challenge the job before any deliverable is submitted.
      await manager
        .connect(evaluator)
        .openChallenge(1, ChallengeType.CoverageMiss, challengeHash);
      let job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Challenged);

      await manager.connect(resolver).resolve(1, ChallengeResult.ProviderNotFault);

      // The job goes back to Funded, NOT Submitted.
      job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Funded);

      // No payout for an empty deliverable.
      await expectRevert(
        escrow.connect(evaluator).complete(1, reasonHash),
        "not submitted"
      );

      // The normal flow still works afterwards.
      await escrow.connect(provider).submit(1, deliverableHash);
      await escrow.connect(evaluator).complete(1, reasonHash);
      job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Completed);
      expect(await token.balanceOf(provider.address)).to.equal(budget);
      expect(await token.balanceOf(client.address)).to.equal(0n);
    });

    it("only the resolver can resolve, exactly once, with a non-pending result", async () => {
      const { manager, resolver, other } = await openChallengeFixture();

      await expectRevert(
        manager.connect(other).resolve(1, ChallengeResult.ProviderFault),
        "only resolver"
      );

      await expectRevert(
        manager.connect(resolver).resolve(1, ChallengeResult.Pending),
        "result required"
      );

      await expectRevert(
        manager.connect(resolver).resolve(2, ChallengeResult.ProviderFault),
        "challenge not found"
      );

      await manager.connect(resolver).resolve(1, ChallengeResult.ProviderFault);

      await expectRevert(
        manager.connect(resolver).resolve(1, ChallengeResult.ProviderNotFault),
        "already resolved"
      );
    });
  });
});
