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
  const juryFee = 500_000n;
  const defenseWindow = 120n;
  const jurySize = 3n;
  const budget = 1_000_000n;

  // Derived fund-flow constants (asserted to the wei in resolve tests).
  const slashAmount = (minStake * slashBps) / 10_000n; // 5 mUSDC
  const reward = (slashAmount * slashRewardBps) / 10_000n; // 2.5 mUSDC
  const feePerJuror = juryFee / jurySize; // 166_666
  const juryPayout = feePerJuror * jurySize; // 499_998
  const dust = juryFee - juryPayout; // 2

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

  async function warpPastDefenseWindow() {
    await ethers.provider.send("evm_increaseTime", [Number(defenseWindow) + 1]);
    await ethers.provider.send("evm_mine", []);
  }

  const modelHash = (tag: string) => ethers.keccak256(ethers.toUtf8Bytes(tag));

  async function deployManager(token: any, treasuryAddress: string) {
    const Manager = await ethers.getContractFactory("ProofMarketChallengeManager");
    return Manager.deploy(
      await token.getAddress(),
      treasuryAddress,
      minStake,
      challengeDeposit,
      slashBps,
      slashRewardBps,
      juryFee,
      defenseWindow,
      jurySize
    );
  }

  async function deployFixture() {
    const [
      deployer,
      treasury,
      client,
      provider,
      evaluator,
      challenger,
      other,
      juror1,
      juror2,
      juror3
    ] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();

    const Escrow = await ethers.getContractFactory("ProofMarketEscrow");
    // Challenge-manager tests are not about the W_c gate: deploy with a zero
    // window so complete() flows do not need time warps.
    const escrow = await Escrow.deploy(0);

    const manager = await deployManager(token, treasury.address);

    await escrow.setChallengeManager(await manager.getAddress());
    await manager.setEscrow(await escrow.getAddress());

    const jurorSigners = [juror1, juror2, juror3];
    for (const [i, juror] of jurorSigners.entries()) {
      await manager.registerJuror(
        juror.address,
        modelHash(`model-${i}`),
        modelHash(`prompt-${i}`)
      );
    }

    // Provider stakes the exact minimum.
    await token.mint(provider.address, minStake);
    await token.connect(provider).approve(await manager.getAddress(), minStake);
    await manager.connect(provider).depositStake(minStake);

    // The evaluator is the challenging party: holds one deposit + jury fee.
    await token.mint(evaluator.address, challengeDeposit + juryFee);
    await token
      .connect(evaluator)
      .approve(await manager.getAddress(), challengeDeposit + juryFee);

    // A funded, approved outsider — proves non-party rejections are about
    // authorization, not funds.
    await token.mint(challenger.address, challengeDeposit + juryFee);
    await token
      .connect(challenger)
      .approve(await manager.getAddress(), challengeDeposit + juryFee);

    const challengeHash = ethers.keccak256(
      ethers.toUtf8Bytes("coverage miss: no Block-STM evidence")
    );
    const defenseHash = ethers.keccak256(
      ethers.toUtf8Bytes("defense: query executed as declared")
    );
    const reasonBookHash = ethers.keccak256(
      ethers.toUtf8Bytes("reason book: three questions answered")
    );

    return {
      deployer,
      treasury,
      client,
      provider,
      evaluator,
      challenger,
      other,
      juror1,
      juror2,
      juror3,
      jurorSigners,
      token,
      escrow,
      manager,
      challengeHash,
      defenseHash,
      reasonBookHash
    };
  }

  async function deployWithFundedJob() {
    const fixture = await deployFixture();
    const { escrow, token, client, provider, evaluator } = fixture;

    const latestBlock = await ethers.provider.getBlock("latest");
    const expiredAt = BigInt((latestBlock?.timestamp ?? 0) + 360000);
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

  async function openChallengeFixture() {
    const fixture = await deployWithSubmittedJob();

    await fixture.manager
      .connect(fixture.evaluator)
      .openChallenge(1, ChallengeType.CoverageMiss, fixture.challengeHash);

    return fixture;
  }

  describe("constructor parameter constraints", () => {
    it("rejects a jury fee that is not below the deposit (F < D)", async () => {
      const { token, treasury } = await deployFixture();
      const Manager = await ethers.getContractFactory("ProofMarketChallengeManager");

      await expectRevert(
        Manager.deploy(
          await token.getAddress(),
          treasury.address,
          minStake,
          challengeDeposit,
          slashBps,
          slashRewardBps,
          challengeDeposit, // F == D
          defenseWindow,
          jurySize
        ),
        "F must be < D"
      );
    });

    it("rejects reward + fee that is not below the slash (R+F < S)", async () => {
      const { token, treasury } = await deployFixture();
      const Manager = await ethers.getContractFactory("ProofMarketChallengeManager");

      await expectRevert(
        Manager.deploy(
          await token.getAddress(),
          treasury.address,
          minStake,
          challengeDeposit,
          slashBps,
          10_000n, // R == S, so R + F > S
          juryFee,
          defenseWindow,
          jurySize
        ),
        "R+F must be < S"
      );
    });

    it("rejects an even jury size", async () => {
      const { token, treasury } = await deployFixture();
      const Manager = await ethers.getContractFactory("ProofMarketChallengeManager");

      await expectRevert(
        Manager.deploy(
          await token.getAddress(),
          treasury.address,
          minStake,
          challengeDeposit,
          slashBps,
          slashRewardBps,
          juryFee,
          defenseWindow,
          2n
        ),
        "jury size must be odd"
      );
    });
  });

  describe("deployment wiring", () => {
    it("only the owner can set the escrow, and only once", async () => {
      const { other, token, treasury } = await deployFixture();

      const fresh = await deployManager(token, treasury.address);

      await expectRevert(
        fresh.connect(other).setEscrow(other.address),
        "only owner"
      );

      await fresh.setEscrow(other.address);
      expect(await fresh.escrow()).to.equal(other.address);

      await expectRevert(fresh.setEscrow(other.address), "escrow already set");
    });

    it("rejects opening a challenge before the escrow is wired", async () => {
      const { token, treasury, challengeHash } = await deployFixture();

      const fresh = await deployManager(token, treasury.address);

      await expectRevert(
        fresh.openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
        "escrow not set"
      );
    });
  });

  describe("juror registration", () => {
    it("registers jurors with commitments, owner-only, no duplicates, capped at jury size", async () => {
      const { token, treasury, other, juror1, juror2, juror3 } =
        await deployFixture();

      const fresh = await deployManager(token, treasury.address);

      await expectRevert(
        fresh
          .connect(other)
          .registerJuror(juror1.address, modelHash("m"), modelHash("p")),
        "only owner"
      );
      await expectRevert(
        fresh.registerJuror(juror1.address, ethers.ZeroHash, modelHash("p")),
        "commitments required"
      );

      await expectEvent(
        fresh.registerJuror(juror1.address, modelHash("m1"), modelHash("p1")),
        fresh,
        "JurorRegistered",
        [juror1.address, modelHash("m1"), modelHash("p1")]
      );
      await expectRevert(
        fresh.registerJuror(juror1.address, modelHash("m1"), modelHash("p1")),
        "already registered"
      );

      await fresh.registerJuror(juror2.address, modelHash("m2"), modelHash("p2"));
      await fresh.registerJuror(juror3.address, modelHash("m3"), modelHash("p3"));
      expect(await fresh.jurorCount()).to.equal(jurySize);

      await expectRevert(
        fresh.registerJuror(other.address, modelHash("m4"), modelHash("p4")),
        "jury full"
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

    it("rejects withdrawing more than the staked amount", async () => {
      const { manager, provider } = await deployFixture();

      await expectRevert(
        manager.connect(provider).withdrawStake(minStake + 1n),
        "insufficient stake"
      );
    });

    it("blocks stake withdrawal while a challenge is pending against the provider", async () => {
      const { manager, provider } = await openChallengeFixture();

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
      const expiredAt = BigInt((latestBlock?.timestamp ?? 0) + 360000);
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
    it("locks the challenger deposit plus jury fee and freezes the job", async () => {
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

      // D + F both locked in the manager.
      expect(await token.balanceOf(evaluator.address)).to.equal(0n);
      expect(await token.balanceOf(await manager.getAddress())).to.equal(
        managerBalanceBefore + challengeDeposit + juryFee
      );

      const challenge = await manager.challenges(1);
      expect(challenge.challenger).to.equal(evaluator.address);
      // The challenged provider is bound from the job record, not caller input.
      expect(challenge.provider).to.equal(provider.address);
      expect(challenge.result).to.equal(ChallengeResult.Pending);
      expect(challenge.openedAt).to.be.greaterThan(0n);
      expect(await manager.activeChallenges(provider.address)).to.equal(1n);

      const job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Challenged);

      // The frozen job cannot be completed.
      await expectRevert(
        escrow.connect(evaluator).complete(1, reasonHash),
        "not submitted"
      );
    });

    it("rejects opening a challenge before the jury is fully seated", async () => {
      const { token, treasury, challengeHash, juror1 } = await deployFixture();

      const fresh = await deployManager(token, treasury.address);
      await fresh.setEscrow(juror1.address); // any non-zero escrow
      await fresh.registerJuror(juror1.address, modelHash("m"), modelHash("p"));

      await expectRevert(
        fresh.openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
        "jury not seated"
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
      await token.mint(client.address, challengeDeposit + juryFee);
      await token
        .connect(client)
        .approve(await manager.getAddress(), challengeDeposit + juryFee);
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

    it("rejects a challenger who cannot fund the deposit plus fee", async () => {
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
      await token.mint(client.address, challengeDeposit + juryFee);
      await expectRevert(
        manager
          .connect(client)
          .openChallenge(1, ChallengeType.CoverageMiss, challengeHash),
        "insufficient allowance"
      );
    });
  });

  describe("submitDefense", () => {
    it("records the provider defense hash inside the window, once", async () => {
      const { manager, provider, defenseHash } = await openChallengeFixture();

      await expectEvent(
        manager.connect(provider).submitDefense(1, defenseHash),
        manager,
        "DefenseSubmitted",
        [1n, defenseHash]
      );

      const challenge = await manager.challenges(1);
      expect(challenge.defenseHash).to.equal(defenseHash);

      await expectRevert(
        manager.connect(provider).submitDefense(1, defenseHash),
        "defense already submitted"
      );
    });

    it("rejects defenses from non-providers, empty hashes, and late filings", async () => {
      const { manager, provider, evaluator, defenseHash } =
        await openChallengeFixture();

      await expectRevert(
        manager.connect(evaluator).submitDefense(1, defenseHash),
        "only provider"
      );
      await expectRevert(
        manager.connect(provider).submitDefense(1, ethers.ZeroHash),
        "defense hash required"
      );
      await expectRevert(
        manager.connect(provider).submitDefense(99, defenseHash),
        "challenge not found"
      );

      await warpPastDefenseWindow();
      await expectRevert(
        manager.connect(provider).submitDefense(1, defenseHash),
        "defense window closed"
      );
    });
  });

  describe("castVote", () => {
    it("blocks voting while the defense window is open (mandatory hearing)", async () => {
      const { manager, juror1, reasonBookHash } = await openChallengeFixture();

      await expectRevert(
        manager
          .connect(juror1)
          .castVote(1, ChallengeResult.ProviderFault, reasonBookHash),
        "defense window open"
      );
    });

    it("accepts one reasoned vote per registered juror after the window", async () => {
      const { manager, juror1, other, reasonBookHash } =
        await openChallengeFixture();

      await warpPastDefenseWindow();

      await expectRevert(
        manager
          .connect(other)
          .castVote(1, ChallengeResult.ProviderFault, reasonBookHash),
        "only juror"
      );
      await expectRevert(
        manager
          .connect(juror1)
          .castVote(1, ChallengeResult.ProviderFault, ethers.ZeroHash),
        "reason book required"
      );
      await expectRevert(
        manager
          .connect(juror1)
          .castVote(1, ChallengeResult.Pending, reasonBookHash),
        "result required"
      );

      await expectEvent(
        manager
          .connect(juror1)
          .castVote(1, ChallengeResult.ProviderFault, reasonBookHash),
        manager,
        "JurorVoted",
        [1n, juror1.address, ChallengeResult.ProviderFault, reasonBookHash]
      );

      await expectRevert(
        manager
          .connect(juror1)
          .castVote(1, ChallengeResult.ProviderNotFault, reasonBookHash),
        "already voted"
      );

      const challenge = await manager.challenges(1);
      expect(challenge.faultVotes).to.equal(1n);
      expect(challenge.notFaultVotes).to.equal(0n);
      expect(await manager.voteReasonHash(1, juror1.address)).to.equal(
        reasonBookHash
      );
    });
  });

  describe("resolve (majority verdict)", () => {
    it("rejects resolution before a strict majority exists", async () => {
      const { manager, juror1, other, reasonBookHash } =
        await openChallengeFixture();

      await expectRevert(manager.connect(other).resolve(1), "no majority yet");

      await warpPastDefenseWindow();
      await manager
        .connect(juror1)
        .castVote(1, ChallengeResult.ProviderFault, reasonBookHash);

      // 1 of 3 votes is not a majority.
      await expectRevert(manager.connect(other).resolve(1), "no majority yet");
      await expectRevert(manager.connect(other).resolve(99), "challenge not found");
    });

    it("2:1 ProviderFault: slashes stake, pays challenger and jury, funds treasury, refunds buyer", async () => {
      const {
        manager,
        escrow,
        token,
        treasury,
        client,
        provider,
        evaluator,
        other,
        juror1,
        juror2,
        juror3,
        jurorSigners,
        reasonBookHash
      } = await openChallengeFixture();

      await warpPastDefenseWindow();
      await manager
        .connect(juror1)
        .castVote(1, ChallengeResult.ProviderFault, reasonBookHash);
      await manager
        .connect(juror2)
        .castVote(1, ChallengeResult.ProviderFault, reasonBookHash);
      await manager
        .connect(juror3)
        .castVote(1, ChallengeResult.ProviderNotFault, reasonBookHash);

      const challengerPayout = reward + challengeDeposit + juryFee; // 5 mUSDC
      const treasuryPayout = slashAmount - reward - juryFee + dust; // 2_000_002

      // Executed by an unprivileged account: votes are on-chain, execution
      // carries no discretion.
      await expectEvent(
        manager.connect(other).resolve(1),
        manager,
        "ChallengeResolved",
        [
          1n,
          ChallengeResult.ProviderFault,
          slashAmount,
          challengerPayout,
          juryPayout,
          treasuryPayout
        ]
      );

      // Provider stake slashed by 50% of the job bond; bond fully released.
      expect(await manager.stake(provider.address)).to.equal(
        minStake - slashAmount
      );
      expect(await manager.lockedStake(provider.address)).to.equal(0n);
      // Challenger (the evaluator) gets D + F back plus the reward.
      expect(await token.balanceOf(evaluator.address)).to.equal(
        challengerPayout
      );
      // Each juror receives an equal fee share.
      for (const juror of jurorSigners) {
        expect(await token.balanceOf(juror.address)).to.equal(feePerJuror);
      }
      // Treasury gets the slash remainder plus division dust.
      expect(await token.balanceOf(treasury.address)).to.equal(treasuryPayout);
      // Buyer is refunded the escrowed budget.
      expect(await token.balanceOf(client.address)).to.equal(budget);
      // Conservation: the manager holds exactly the remaining stake.
      expect(await token.balanceOf(await manager.getAddress())).to.equal(
        minStake - slashAmount
      );

      const job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Rejected);

      // Challenge closed: remaining stake withdrawable.
      expect(await manager.activeChallenges(provider.address)).to.equal(0n);
      await manager.connect(provider).withdrawStake(minStake - slashAmount);
      expect(await token.balanceOf(provider.address)).to.equal(
        minStake - slashAmount
      );
    });

    it("2:1 NotFault: pays the jury from the forfeited deposit and unfreezes the job", async () => {
      const {
        manager,
        escrow,
        token,
        treasury,
        provider,
        evaluator,
        other,
        juror1,
        juror2,
        juror3,
        jurorSigners,
        reasonBookHash
      } = await openChallengeFixture();

      await warpPastDefenseWindow();
      await manager
        .connect(juror1)
        .castVote(1, ChallengeResult.ProviderNotFault, reasonBookHash);
      await manager
        .connect(juror2)
        .castVote(1, ChallengeResult.ProviderNotFault, reasonBookHash);
      await manager
        .connect(juror3)
        .castVote(1, ChallengeResult.ProviderFault, reasonBookHash);

      const treasuryPayout = challengeDeposit + dust; // 2_000_002

      await expectEvent(
        manager.connect(other).resolve(1),
        manager,
        "ChallengeResolved",
        [1n, ChallengeResult.ProviderNotFault, 0n, 0n, juryPayout, treasuryPayout]
      );

      // Challenger forfeits D + F; jury paid from F, treasury takes D + dust.
      expect(await token.balanceOf(evaluator.address)).to.equal(0n);
      for (const juror of jurorSigners) {
        expect(await token.balanceOf(juror.address)).to.equal(feePerJuror);
      }
      expect(await token.balanceOf(treasury.address)).to.equal(treasuryPayout);
      // Stake untouched and still bonded to the live job.
      expect(await manager.stake(provider.address)).to.equal(minStake);
      expect(await manager.lockedStake(provider.address)).to.equal(minStake);
      // Conservation: manager holds exactly the stake again.
      expect(await token.balanceOf(await manager.getAddress())).to.equal(
        minStake
      );

      // Job restored to Submitted, then completes normally (W_c = 0 here).
      let job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Submitted);

      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("valid"));
      await escrow.connect(evaluator).complete(1, reasonHash);
      job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Completed);
      expect(await token.balanceOf(provider.address)).to.equal(budget);
      expect(await manager.lockedStake(provider.address)).to.equal(0n);
    });

    it("restores a Funded job to Funded after a failed challenge (HIGH-3)", async () => {
      const {
        manager,
        escrow,
        token,
        client,
        provider,
        evaluator,
        other,
        juror1,
        juror2,
        challengeHash,
        deliverableHash,
        reasonHash,
        reasonBookHash
      } = await deployWithFundedJob();

      // Challenge the job before any deliverable is submitted.
      await manager
        .connect(evaluator)
        .openChallenge(1, ChallengeType.CoverageMiss, challengeHash);
      let job = await escrow.jobs(1);
      expect(job.state).to.equal(JobState.Challenged);

      await warpPastDefenseWindow();
      await manager
        .connect(juror1)
        .castVote(1, ChallengeResult.ProviderNotFault, reasonBookHash);
      await manager
        .connect(juror2)
        .castVote(1, ChallengeResult.ProviderNotFault, reasonBookHash);
      await manager.connect(other).resolve(1);

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

    it("resolves exactly once and freezes the vote set afterwards", async () => {
      const { manager, other, juror1, juror2, juror3, reasonBookHash } =
        await openChallengeFixture();

      await warpPastDefenseWindow();
      await manager
        .connect(juror1)
        .castVote(1, ChallengeResult.ProviderFault, reasonBookHash);
      await manager
        .connect(juror2)
        .castVote(1, ChallengeResult.ProviderFault, reasonBookHash);

      await manager.connect(other).resolve(1);

      await expectRevert(manager.connect(other).resolve(1), "already resolved");
      // Late votes against a resolved challenge are rejected.
      await expectRevert(
        manager
          .connect(juror3)
          .castVote(1, ChallengeResult.ProviderNotFault, reasonBookHash),
        "already resolved"
      );
    });
  });
});
