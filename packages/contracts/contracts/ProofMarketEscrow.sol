// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IChallengeManagerHooks {
    function lockStakeForJob(address provider) external;
    function unlockStakeForJob(address provider) external;
}

contract ProofMarketEscrow {
    enum JobState {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,
        Expired,
        Challenged
    }

    struct Job {
        uint256 jobId;
        address client;
        uint256 providerAgentId;
        address provider;
        uint256 verifierAgentId;
        address evaluator;
        address token;
        uint256 budget;
        uint256 expiredAt;
        JobState state;
        bytes32 descriptionHash;
        bytes32 deliverableHash;
        bytes32 coverageHash;
    }

    uint256 public nextJobId = 1;
    address public owner;
    address public challengeManager;
    // Challenge window W_c: the client may accept immediately; a separate
    // evaluator cannot complete until this many seconds have passed since
    // submit(), preserving the client's challenge right.
    uint256 public challengeWindow;
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => uint256) public submittedAt;
    // State a job held immediately before it was frozen by markChallenged, so a
    // failed challenge restores it exactly (Funded stays Funded, Submitted stays
    // Submitted) instead of promoting an empty deliverable to Submitted.
    mapping(uint256 => JobState) private preChallengeState;

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed provider);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event DeliverableSubmitted(uint256 indexed jobId, bytes32 deliverableHash);
    event JobCompleted(uint256 indexed jobId, bytes32 reasonHash);
    event JobRejected(uint256 indexed jobId, bytes32 reasonHash);
    event JobExpired(uint256 indexed jobId);
    event JobChallenged(uint256 indexed jobId);
    event JobRefundedForChallenge(uint256 indexed jobId);
    event JobUnfrozenForChallenge(uint256 indexed jobId);
    event ChallengeManagerSet(address indexed challengeManager);

    constructor(uint256 challengeWindow_) {
        owner = msg.sender;
        challengeWindow = challengeWindow_;
    }

    modifier onlyChallengeManager() {
        require(msg.sender == challengeManager, "only challenge manager");
        _;
    }

    function setChallengeManager(address challengeManager_) external {
        require(msg.sender == owner, "only owner");
        require(challengeManager == address(0), "challenge manager already set");
        require(challengeManager_ != address(0), "challenge manager required");

        challengeManager = challengeManager_;
        emit ChallengeManagerSet(challengeManager_);
    }

    function createJob(
        uint256 providerAgentId,
        address provider,
        uint256 verifierAgentId,
        address evaluator,
        address token,
        uint256 expiredAt,
        bytes32 descriptionHash,
        bytes32 coverageHash
    ) external returns (uint256 jobId) {
        require(provider != address(0), "provider required");
        require(evaluator != address(0), "evaluator required");
        require(token != address(0), "token required");
        require(expiredAt > block.timestamp, "expiry must be future");
        // Same message as the lock revert below: with no challenge manager wired
        // there is no stake system, so the provider cannot have bonded stake.
        require(challengeManager != address(0), "provider stake too low");

        // Bond minStake of the provider's free stake to this job before any job
        // state is written: the lock reverts on insufficient free stake, so
        // createJob aborts atomically and can never leave a job without a bond.
        IChallengeManagerHooks(challengeManager).lockStakeForJob(provider);

        jobId = nextJobId++;
        jobs[jobId] = Job({
            jobId: jobId,
            client: msg.sender,
            providerAgentId: providerAgentId,
            provider: provider,
            verifierAgentId: verifierAgentId,
            evaluator: evaluator,
            token: token,
            budget: 0,
            expiredAt: expiredAt,
            state: JobState.Open,
            descriptionHash: descriptionHash,
            deliverableHash: bytes32(0),
            coverageHash: coverageHash
        });

        emit JobCreated(jobId, msg.sender, provider);
    }

    function jobParties(
        uint256 jobId
    ) external view returns (address client, address provider, address evaluator) {
        Job storage job = jobs[jobId];
        return (job.client, job.provider, job.evaluator);
    }

    function setBudget(uint256 jobId, uint256 amount) external {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        require(msg.sender == job.client, "only client");
        require(job.state == JobState.Open, "not open");
        require(amount > 0, "budget required");

        job.budget = amount;
    }

    function fund(uint256 jobId, uint256 expectedAmount) external {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        require(msg.sender == job.client, "only client");
        require(job.state == JobState.Open, "not open");
        require(job.expiredAt > block.timestamp, "job expired");
        require(job.budget > 0, "budget required");
        require(job.budget == expectedAmount, "amount mismatch");

        job.state = JobState.Funded;
        require(
            IERC20Like(job.token).transferFrom(msg.sender, address(this), expectedAmount),
            "transfer failed"
        );

        emit JobFunded(jobId, expectedAmount);
    }

    function submit(uint256 jobId, bytes32 deliverableHash) external {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        require(msg.sender == job.provider, "only provider");
        require(job.state == JobState.Funded, "not funded");
        require(job.expiredAt > block.timestamp, "job expired");

        job.deliverableHash = deliverableHash;
        job.state = JobState.Submitted;
        submittedAt[jobId] = block.timestamp;

        emit DeliverableSubmitted(jobId, deliverableHash);
    }

    function complete(uint256 jobId, bytes32 reasonHash) external {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        bool isClient = msg.sender == job.client;
        bool isEvaluator = msg.sender == job.evaluator;
        require(isClient || isEvaluator, "only client or evaluator");
        require(job.state == JobState.Submitted, "not submitted");
        require(
            isClient || block.timestamp >= submittedAt[jobId] + challengeWindow,
            "challenge window open"
        );

        job.state = JobState.Completed;
        require(IERC20Like(job.token).transfer(job.provider, job.budget), "transfer failed");
        // Terminal settlement: release the stake bonded to this job.
        IChallengeManagerHooks(challengeManager).unlockStakeForJob(job.provider);

        emit JobCompleted(jobId, reasonHash);
    }

    function reject(uint256 jobId, bytes32 reasonHash) external {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        require(msg.sender == job.evaluator, "only evaluator");
        require(
            job.state == JobState.Funded || job.state == JobState.Submitted,
            "not rejectable"
        );

        job.state = JobState.Rejected;
        require(IERC20Like(job.token).transfer(job.client, job.budget), "transfer failed");
        // Terminal settlement: release the stake bonded to this job.
        IChallengeManagerHooks(challengeManager).unlockStakeForJob(job.provider);

        emit JobRejected(jobId, reasonHash);
    }

    function expireAndRefund(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        require(msg.sender == job.client, "only client");
        require(job.state == JobState.Funded, "not funded");
        require(job.expiredAt <= block.timestamp, "job not expired");

        job.state = JobState.Expired;
        require(IERC20Like(job.token).transfer(job.client, job.budget), "transfer failed");
        // Terminal settlement: release the stake bonded to this job.
        IChallengeManagerHooks(challengeManager).unlockStakeForJob(job.provider);

        emit JobExpired(jobId);
    }

    function markChallenged(uint256 jobId) external onlyChallengeManager {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        require(
            job.state == JobState.Funded || job.state == JobState.Submitted,
            "not challengeable"
        );

        preChallengeState[jobId] = job.state;
        job.state = JobState.Challenged;

        emit JobChallenged(jobId);
    }

    function refundForChallenge(uint256 jobId) external onlyChallengeManager {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        require(job.state == JobState.Challenged, "not challenged");

        job.state = JobState.Rejected;
        delete preChallengeState[jobId];
        // NOTE: no unlockStakeForJob call here. This hook is invoked by the
        // challenge manager inside resolve(), which settles the locked-stake
        // accounting for the challenged job itself (slash + release). Calling
        // back would double-unlock.
        require(IERC20Like(job.token).transfer(job.client, job.budget), "transfer failed");

        emit JobRefundedForChallenge(jobId);
    }

    function unfreezeForChallenge(uint256 jobId) external onlyChallengeManager {
        Job storage job = jobs[jobId];
        require(job.client != address(0), "job not found");
        require(job.state == JobState.Challenged, "not challenged");

        // Restore the exact pre-challenge state: a Funded job must not become
        // Submitted, or complete() could pay out for an empty deliverable.
        job.state = preChallengeState[jobId];
        delete preChallengeState[jobId];

        emit JobUnfrozenForChallenge(jobId);
    }
}
