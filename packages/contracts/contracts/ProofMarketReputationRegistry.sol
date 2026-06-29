// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IProofMarketIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}

contract ProofMarketReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        string feedbackURI;
        bytes32 feedbackHash;
        bool revoked;
    }

    struct FeedbackReadResult {
        address[] clients;
        uint64[] feedbackIndexes;
        int128[] values;
        uint8[] valueDecimals;
        string[] tag1s;
        string[] tag2s;
        bool[] revokedStatuses;
    }

    IProofMarketIdentityRegistry public immutable identity;

    mapping(uint256 => address[]) private clientsByAgent;
    mapping(uint256 => mapping(address => bool)) private hasClient;
    mapping(uint256 => mapping(address => Feedback[])) private feedbackByAgentAndClient;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        string indexed indexedTag1,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    constructor(address identity_) {
        require(identity_ != address(0), "identity required");
        identity = IProofMarketIdentityRegistry(identity_);
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external {
        require(identity.ownerOf(agentId) != msg.sender, "Self-feedback not allowed");

        if (!hasClient[agentId][msg.sender]) {
            hasClient[agentId][msg.sender] = true;
            clientsByAgent[agentId].push(msg.sender);
        }

        Feedback[] storage feedbacks = feedbackByAgentAndClient[agentId][msg.sender];
        require(feedbacks.length <= type(uint64).max, "too many feedbacks");
        uint64 feedbackIndex = uint64(feedbacks.length);

        feedbacks.push(
            Feedback({
                value: value,
                valueDecimals: valueDecimals,
                tag1: tag1,
                tag2: tag2,
                endpoint: endpoint,
                feedbackURI: feedbackURI,
                feedbackHash: feedbackHash,
                revoked: false
            })
        );

        _emitNewFeedback(agentId, feedbackIndex, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash);
    }

    function getClients(uint256 agentId) external view returns (address[] memory) {
        return clientsByAgent[agentId];
    }

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) {
        require(clientAddresses.length > 0, "clientAddresses required");

        int256 total = 0;
        bool decimalsSet = false;

        for (uint256 i = 0; i < clientAddresses.length; i++) {
            Feedback[] storage feedbacks = feedbackByAgentAndClient[agentId][clientAddresses[i]];
            for (uint256 j = 0; j < feedbacks.length; j++) {
                Feedback storage feedback = feedbacks[j];
                if (!_matches(feedback, tag1, tag2, false)) continue;

                if (!decimalsSet) {
                    summaryValueDecimals = feedback.valueDecimals;
                    decimalsSet = true;
                } else {
                    require(
                        summaryValueDecimals == feedback.valueDecimals,
                        "mixed decimals unsupported"
                    );
                }

                total += feedback.value;
                count++;
            }
        }

        if (count == 0) return (0, 0, 0);
        summaryValue = int128(total / int256(uint256(count)));
    }

    function readAllFeedback(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    )
        external
        view
        returns (
            address[] memory,
            uint64[] memory,
            int128[] memory,
            uint8[] memory,
            string[] memory,
            string[] memory,
            bool[] memory
        )
    {
        uint256 matched = _countMatches(agentId, clientAddresses, tag1, tag2, includeRevoked);

        FeedbackReadResult memory result = FeedbackReadResult({
            clients: new address[](matched),
            feedbackIndexes: new uint64[](matched),
            values: new int128[](matched),
            valueDecimals: new uint8[](matched),
            tag1s: new string[](matched),
            tag2s: new string[](matched),
            revokedStatuses: new bool[](matched)
        });

        _fillReadResult(result, agentId, clientAddresses, tag1, tag2, includeRevoked);

        return (
            result.clients,
            result.feedbackIndexes,
            result.values,
            result.valueDecimals,
            result.tag1s,
            result.tag2s,
            result.revokedStatuses
        );
    }

    function _fillReadResult(
        FeedbackReadResult memory result,
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) private view {
        uint256 cursor = 0;
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            address clientAddress = clientAddresses[i];
            Feedback[] storage feedbacks = feedbackByAgentAndClient[agentId][clientAddress];
            for (uint256 j = 0; j < feedbacks.length; j++) {
                Feedback storage feedback = feedbacks[j];
                if (!_matches(feedback, tag1, tag2, includeRevoked)) continue;

                result.clients[cursor] = clientAddress;
                result.feedbackIndexes[cursor] = uint64(j);
                result.values[cursor] = feedback.value;
                result.valueDecimals[cursor] = feedback.valueDecimals;
                result.tag1s[cursor] = feedback.tag1;
                result.tag2s[cursor] = feedback.tag2;
                result.revokedStatuses[cursor] = feedback.revoked;
                cursor++;
            }
        }
    }

    function _countMatches(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) private view returns (uint256 matched) {
        for (uint256 i = 0; i < clientAddresses.length; i++) {
            Feedback[] storage feedbacks = feedbackByAgentAndClient[agentId][clientAddresses[i]];
            for (uint256 j = 0; j < feedbacks.length; j++) {
                if (_matches(feedbacks[j], tag1, tag2, includeRevoked)) matched++;
            }
        }
    }

    function _matches(
        Feedback storage feedback,
        string calldata tag1,
        string calldata tag2,
        bool includeRevoked
    ) private view returns (bool) {
        if (!includeRevoked && feedback.revoked) return false;
        if (bytes(tag1).length > 0 && !_same(feedback.tag1, tag1)) return false;
        if (bytes(tag2).length > 0 && !_same(feedback.tag2, tag2)) return false;
        return true;
    }

    function _same(string storage left, string calldata right) private pure returns (bool) {
        return keccak256(bytes(left)) == keccak256(bytes(right));
    }

    function _emitNewFeedback(
        uint256 agentId,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) private {
        emit NewFeedback(
            agentId,
            msg.sender,
            tag1,
            feedbackIndex,
            value,
            valueDecimals,
            tag1,
            tag2,
            endpoint,
            feedbackURI,
            feedbackHash
        );
    }
}
