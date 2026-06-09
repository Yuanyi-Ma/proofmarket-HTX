// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

    struct Challenge {
        uint256 challengeId;
        uint256 jobId;
        ChallengeType challengeType;
        bytes32 challengeHash;
        ChallengeResult result;
    }

    uint256 public nextChallengeId = 1;
    address public resolver;
    mapping(uint256 => Challenge) public challenges;

    event ChallengeOpened(
        uint256 indexed challengeId,
        uint256 indexed jobId,
        ChallengeType challengeType,
        bytes32 challengeHash
    );
    event ChallengeResolved(uint256 indexed challengeId, ChallengeResult result);

    constructor(address resolver_) {
        require(resolver_ != address(0), "resolver required");
        resolver = resolver_;
    }

    function openChallenge(
        uint256 jobId,
        ChallengeType challengeType,
        bytes32 challengeHash
    ) external returns (uint256 challengeId) {
        require(jobId > 0, "job required");
        require(challengeHash != bytes32(0), "challenge hash required");

        challengeId = nextChallengeId++;
        challenges[challengeId] = Challenge({
            challengeId: challengeId,
            jobId: jobId,
            challengeType: challengeType,
            challengeHash: challengeHash,
            result: ChallengeResult.Pending
        });

        emit ChallengeOpened(challengeId, jobId, challengeType, challengeHash);
    }

    function resolve(uint256 challengeId, ChallengeResult result) external {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.challengeId != 0, "challenge not found");
        require(msg.sender == resolver, "only resolver");
        require(challenge.result == ChallengeResult.Pending, "already resolved");
        require(result != ChallengeResult.Pending, "result required");

        challenge.result = result;

        emit ChallengeResolved(challengeId, result);
    }
}
