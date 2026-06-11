// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IEscrowChallengeHooks {
    function jobParties(
        uint256 jobId
    ) external view returns (address client, address provider, address evaluator);
    function markChallenged(uint256 jobId) external;
    function refundForChallenge(uint256 jobId) external;
    function unfreezeForChallenge(uint256 jobId) external;
}

contract ProofMarketChallengeManager {
    enum ChallengeType {
        SourceNotFound,
        LocatorInvalid,
        ExcerptMismatch,
        NumericMismatch,
        CoverageMiss
    }

    enum ChallengeResult {
        Pending,
        ProviderFault,
        ProviderNotFault
    }

    struct Juror {
        // Registration-time commitments (model version hash + judging prompt
        // hash) so any verdict can be re-run offline against the committed
        // parameters. Accountability staking/slashing is out of scope for now.
        bytes32 modelHash;
        bytes32 promptHash;
        bool registered;
    }

    struct Challenge {
        uint256 challengeId;
        uint256 jobId;
        ChallengeType challengeType;
        bytes32 challengeHash;
        ChallengeResult result;
        address challenger;
        address provider;
        // Anchor for the defense window: jurors may not vote until
        // openedAt + defenseWindow has passed (mandatory audi alteram partem).
        uint64 openedAt;
        // Hash of the provider's defense statement; 0 = no defense submitted.
        bytes32 defenseHash;
        uint8 faultVotes;
        uint8 notFaultVotes;
    }

    uint256 public constant BPS_DENOMINATOR = 10_000;

    uint256 public nextChallengeId = 1;
    address public owner;
    address public treasury;
    address public escrow;
    IERC20Minimal public token;

    uint256 public minStake;
    uint256 public challengeDeposit;
    uint256 public slashBps;
    uint256 public slashRewardBps;
    // Jury fee F, collected from the challenger alongside the deposit and
    // split equally among jurors at resolution (division dust goes to the
    // treasury so every branch conserves funds exactly).
    uint256 public juryFee;
    // Provider defense window R_w in seconds.
    uint256 public defenseWindow;
    // Jury size N (odd, majority = N/2 + 1).
    uint256 public jurySize;

    address[] public jurorList;
    mapping(address => Juror) public jurors;

    mapping(uint256 => Challenge) public challenges;
    // votes[challengeId][juror]: Pending = has not voted yet.
    mapping(uint256 => mapping(address => ChallengeResult)) public votes;
    mapping(uint256 => mapping(address => bytes32)) public voteReasonHash;
    mapping(address => uint256) public stake;
    // Portion of stake[provider] bonded to in-flight escrow jobs (minStake per
    // job, locked at createJob, released at terminal settlement). Invariant:
    // lockedStake[provider] <= stake[provider]. Only free stake (the difference)
    // is withdrawable, so a provider cannot pull the bond out from under a job.
    mapping(address => uint256) public lockedStake;
    mapping(address => uint256) public activeChallenges;

    event EscrowSet(address indexed escrow);
    event StakeDeposited(address indexed provider, uint256 amount, uint256 totalStake);
    event StakeWithdrawn(address indexed provider, uint256 amount, uint256 remainingStake);
    event StakeLocked(address indexed provider, uint256 amount, uint256 totalLocked);
    event StakeUnlocked(address indexed provider, uint256 amount, uint256 totalLocked);
    event JurorRegistered(address indexed juror, bytes32 modelHash, bytes32 promptHash);
    event DefenseSubmitted(uint256 indexed challengeId, bytes32 defenseHash);
    event JurorVoted(
        uint256 indexed challengeId,
        address indexed juror,
        ChallengeResult result,
        bytes32 reasonHash
    );
    event ChallengeOpened(
        uint256 indexed challengeId,
        uint256 indexed jobId,
        ChallengeType challengeType,
        bytes32 challengeHash,
        address indexed challenger,
        address provider
    );
    event ChallengeResolved(
        uint256 indexed challengeId,
        ChallengeResult result,
        uint256 slashAmount,
        uint256 challengerPayout,
        uint256 juryPayout,
        uint256 treasuryPayout
    );

    constructor(
        address token_,
        address treasury_,
        uint256 minStake_,
        uint256 challengeDeposit_,
        uint256 slashBps_,
        uint256 slashRewardBps_,
        uint256 juryFee_,
        uint256 defenseWindow_,
        uint256 jurySize_
    ) {
        require(token_ != address(0), "token required");
        require(treasury_ != address(0), "treasury required");
        require(slashBps_ <= BPS_DENOMINATOR, "slashBps too high");
        require(slashRewardBps_ <= BPS_DENOMINATOR, "slashRewardBps too high");
        // Economic parameter constraints (design doc section 4.3): the
        // treasury share must be non-negative on both branches.
        require(juryFee_ < challengeDeposit_, "F must be < D");
        uint256 slashAmount_ = (minStake_ * slashBps_) / BPS_DENOMINATOR;
        uint256 reward_ = (slashAmount_ * slashRewardBps_) / BPS_DENOMINATOR;
        require(reward_ + juryFee_ < slashAmount_, "R+F must be < S");
        require(jurySize_ >= 1 && jurySize_ % 2 == 1, "jury size must be odd");

        owner = msg.sender;
        token = IERC20Minimal(token_);
        treasury = treasury_;
        minStake = minStake_;
        challengeDeposit = challengeDeposit_;
        slashBps = slashBps_;
        slashRewardBps = slashRewardBps_;
        juryFee = juryFee_;
        defenseWindow = defenseWindow_;
        jurySize = jurySize_;
    }

    function setEscrow(address escrow_) external {
        require(msg.sender == owner, "only owner");
        require(escrow == address(0), "escrow already set");
        require(escrow_ != address(0), "escrow required");

        escrow = escrow_;
        emit EscrowSet(escrow_);
    }

    function registerJuror(address account, bytes32 modelHash, bytes32 promptHash) external {
        require(msg.sender == owner, "only owner");
        require(account != address(0), "juror required");
        require(modelHash != bytes32(0) && promptHash != bytes32(0), "commitments required");
        require(!jurors[account].registered, "already registered");
        require(jurorList.length < jurySize, "jury full");

        jurors[account] = Juror({modelHash: modelHash, promptHash: promptHash, registered: true});
        jurorList.push(account);
        emit JurorRegistered(account, modelHash, promptHash);
    }

    function jurorCount() external view returns (uint256) {
        return jurorList.length;
    }

    function depositStake(uint256 amount) external {
        require(amount > 0, "amount required");

        stake[msg.sender] += amount;
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "stake transfer failed"
        );

        emit StakeDeposited(msg.sender, amount, stake[msg.sender]);
    }

    function withdrawStake(uint256 amount) external {
        require(amount > 0, "amount required");
        require(activeChallenges[msg.sender] == 0, "active challenge pending");
        // Only FREE stake is withdrawable; stake bonded to in-flight jobs stays.
        require(
            stake[msg.sender] - lockedStake[msg.sender] >= amount,
            "insufficient stake"
        );

        stake[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "stake transfer failed");

        emit StakeWithdrawn(msg.sender, amount, stake[msg.sender]);
    }

    function hasMinStake(address provider) external view returns (bool) {
        return stake[provider] >= minStake;
    }

    /// @notice Bond minStake of the provider's free stake to a job being created.
    /// @dev Only callable by the escrow (from createJob). Reverts if the
    ///      provider's free stake cannot cover another minStake bond, which is
    ///      what enforces the create-time stake gate.
    function lockStakeForJob(address provider) external {
        require(msg.sender == escrow, "only escrow");
        require(
            stake[provider] - lockedStake[provider] >= minStake,
            "provider stake too low"
        );

        lockedStake[provider] += minStake;
        emit StakeLocked(provider, minStake, lockedStake[provider]);
    }

    /// @notice Release the minStake bond when a job reaches a terminal state
    ///         through the escrow (complete / reject / expireAndRefund).
    /// @dev Challenged jobs that end via refundForChallenge are settled inside
    ///      resolve() instead, never here.
    function unlockStakeForJob(address provider) external {
        require(msg.sender == escrow, "only escrow");
        require(lockedStake[provider] >= minStake, "nothing locked");

        lockedStake[provider] -= minStake;
        emit StakeUnlocked(provider, minStake, lockedStake[provider]);
    }

    function openChallenge(
        uint256 jobId,
        ChallengeType challengeType,
        bytes32 challengeHash
    ) external returns (uint256 challengeId) {
        require(escrow != address(0), "escrow not set");
        require(jurorList.length == jurySize, "jury not seated");
        require(jobId > 0, "job required");
        require(challengeHash != bytes32(0), "challenge hash required");

        // The challenged provider is read from the job itself, never supplied by
        // the caller, so a challenge can only ever slash the job's real provider.
        (address client, address provider, address evaluator) =
            IEscrowChallengeHooks(escrow).jobParties(jobId);
        require(provider != address(0), "job not found");
        // Only parties to the job may challenge it; anyone else freezing
        // arbitrary jobs would be pure griefing.
        require(
            msg.sender == client || msg.sender == evaluator,
            "only client or evaluator"
        );
        require(stake[provider] > 0, "provider has no stake");

        challengeId = nextChallengeId++;
        challenges[challengeId] = Challenge({
            challengeId: challengeId,
            jobId: jobId,
            challengeType: challengeType,
            challengeHash: challengeHash,
            result: ChallengeResult.Pending,
            challenger: msg.sender,
            provider: provider,
            openedAt: uint64(block.timestamp),
            defenseHash: bytes32(0),
            faultVotes: 0,
            notFaultVotes: 0
        });
        activeChallenges[provider] += 1;

        // Lock the challenger's deposit D plus the jury fee F in this contract.
        require(
            token.transferFrom(msg.sender, address(this), challengeDeposit + juryFee),
            "deposit transfer failed"
        );

        // Freeze the escrowed job until the challenge is resolved.
        IEscrowChallengeHooks(escrow).markChallenged(jobId);

        emit ChallengeOpened(
            challengeId,
            jobId,
            challengeType,
            challengeHash,
            msg.sender,
            provider
        );
    }

    /// @notice Provider files its defense statement hash within the defense
    ///         window R_w. Optional: skipping it forfeits the chance, but the
    ///         jury still waits out the window before voting.
    function submitDefense(uint256 challengeId, bytes32 defenseHash) external {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.challengeId != 0, "challenge not found");
        require(challenge.result == ChallengeResult.Pending, "already resolved");
        require(msg.sender == challenge.provider, "only provider");
        require(
            block.timestamp <= uint256(challenge.openedAt) + defenseWindow,
            "defense window closed"
        );
        require(defenseHash != bytes32(0), "defense hash required");
        require(challenge.defenseHash == bytes32(0), "defense already submitted");

        challenge.defenseHash = defenseHash;
        emit DefenseSubmitted(challengeId, defenseHash);
    }

    /// @notice One vote per registered juror per challenge, only after the
    ///         defense window has fully passed, and only with a non-zero
    ///         reason-book hash (a vote without a reason book is invalid).
    function castVote(
        uint256 challengeId,
        ChallengeResult result,
        bytes32 reasonHash
    ) external {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.challengeId != 0, "challenge not found");
        require(challenge.result == ChallengeResult.Pending, "already resolved");
        require(jurors[msg.sender].registered, "only juror");
        require(
            block.timestamp > uint256(challenge.openedAt) + defenseWindow,
            "defense window open"
        );
        require(result != ChallengeResult.Pending, "result required");
        require(reasonHash != bytes32(0), "reason book required");
        require(
            votes[challengeId][msg.sender] == ChallengeResult.Pending,
            "already voted"
        );

        votes[challengeId][msg.sender] = result;
        voteReasonHash[challengeId][msg.sender] = reasonHash;
        if (result == ChallengeResult.ProviderFault) {
            challenge.faultVotes += 1;
        } else {
            challenge.notFaultVotes += 1;
        }

        emit JurorVoted(challengeId, msg.sender, result, reasonHash);
    }

    /// @notice Execute the majority verdict. Callable by anyone once a strict
    ///         majority exists — the votes are on-chain, so execution carries
    ///         no discretion.
    function resolve(uint256 challengeId) external {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.challengeId != 0, "challenge not found");
        require(challenge.result == ChallengeResult.Pending, "already resolved");

        uint256 majority = jurySize / 2 + 1;
        require(
            challenge.faultVotes >= majority || challenge.notFaultVotes >= majority,
            "no majority yet"
        );
        ChallengeResult result = challenge.faultVotes >= majority
            ? ChallengeResult.ProviderFault
            : ChallengeResult.ProviderNotFault;

        challenge.result = result;
        activeChallenges[challenge.provider] -= 1;

        // Jury fee splits equally; integer-division dust goes to the treasury
        // so the books balance to the wei on both branches.
        uint256 feePerJuror = juryFee / jurorList.length;
        uint256 juryPayout = feePerJuror * jurorList.length;
        uint256 dust = juryFee - juryPayout;

        uint256 slashAmount = 0;
        uint256 challengerPayout = 0;
        uint256 treasuryPayout = 0;

        if (result == ChallengeResult.ProviderFault) {
            // Slash against the stake bonded to this job at createJob (minStake),
            // not the provider's floating balance. The job ends terminal
            // (Rejected via refundForChallenge below), so the whole minStake
            // bond settles here: slashAmount is burned out of stake, and the
            // un-slashed remainder returns to free stake by reducing
            // lockedStake by the full minStake while stake only drops by
            // slashAmount.
            slashAmount = (minStake * slashBps) / BPS_DENOMINATOR;
            stake[challenge.provider] -= slashAmount;
            lockedStake[challenge.provider] -= minStake;

            uint256 reward = (slashAmount * slashRewardBps) / BPS_DENOMINATOR;
            // Challenge upheld: deposit D and fee F fully refunded plus reward
            // R; the jury fee is borne by the slash (design doc section 4.3).
            challengerPayout = reward + challengeDeposit + juryFee;
            treasuryPayout = slashAmount - reward - juryFee + dust;

            require(
                token.transfer(challenge.challenger, challengerPayout),
                "challenger transfer failed"
            );

            // Escrow refunds the buyer; the job ends Rejected.
            IEscrowChallengeHooks(escrow).refundForChallenge(challenge.jobId);
        } else {
            // Challenge failed: the jury fee is paid out of the forfeited
            // deposit; the rest of the deposit goes to the treasury.
            treasuryPayout = challengeDeposit + dust;

            // Unfreeze the job so it can complete normally.
            IEscrowChallengeHooks(escrow).unfreezeForChallenge(challenge.jobId);
        }

        for (uint256 i = 0; i < jurorList.length; i++) {
            require(token.transfer(jurorList[i], feePerJuror), "juror transfer failed");
        }
        if (treasuryPayout > 0) {
            require(
                token.transfer(treasury, treasuryPayout),
                "treasury transfer failed"
            );
        }

        emit ChallengeResolved(
            challengeId,
            result,
            slashAmount,
            challengerPayout,
            juryPayout,
            treasuryPayout
        );
    }
}
