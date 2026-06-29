// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ProofMarketIdentityRegistry {
    uint256 public nextAgentId = 1;

    mapping(uint256 => address) private owners;
    mapping(uint256 => string) private uris;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    function register(string calldata agentURI) external returns (uint256 agentId) {
        require(bytes(agentURI).length > 0, "agentURI required");

        agentId = nextAgentId++;
        owners[agentId] = msg.sender;
        uris[agentId] = agentURI;

        emit Transfer(address(0), msg.sender, agentId);
        emit Registered(agentId, agentURI, msg.sender);
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        address owner = owners[agentId];
        require(owner != address(0), "agent not found");
        return owner;
    }

    function tokenURI(uint256 agentId) external view returns (string memory) {
        require(owners[agentId] != address(0), "agent not found");
        return uris[agentId];
    }
}
