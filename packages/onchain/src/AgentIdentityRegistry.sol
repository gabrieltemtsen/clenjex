// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ClenjexAgentIdentityRegistry
/// @notice ERC-8004 Identity Registry — Agents are NFTs with registration metadata URIs.
///         Each NFT represents one agent. The tokenURI points to an Agent Registration JSON
///         containing capabilities, endpoints (A2A, MCP), and supported trust models.
contract AgentIdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    /// @notice The operational wallet used by the agent to sign TradeIntents.
    ///         Must be verified via EIP-712/ERC-1271. Supports Safe wallets.
    mapping(uint256 => address) public agentWallets;
    mapping(uint256 => string) public agentNames;
    mapping(uint256 => string) public agentCapabilities; // JSON string of capabilities

    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed agentWallet,
        string name,
        string uri
    );
    event AgentWalletUpdated(uint256 indexed tokenId, address newWallet);
    event AgentWalletUnset(uint256 indexed tokenId);

    error NotTokenOwner();
    error ZeroAddressWallet();

    constructor() ERC721("ClenjexAgentIdentity", "CAI") Ownable(msg.sender) {}

    /// @notice Register a new agent. Mints an NFT representing its identity.
    /// @param to Owner of the agent NFT (usually the deployer / operator)
    /// @param agentWallet Operational wallet — can be an EOA or Safe (EIP-1271)
    /// @param name Human-readable agent name
    /// @param uri IPFS URI pointing to Agent Registration JSON (ERC-8004 spec)
    function registerAgent(
        address to,
        address agentWallet,
        string memory name,
        string memory uri
    ) external returns (uint256 tokenId) {
        if (agentWallet == address(0)) revert ZeroAddressWallet();
        tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        agentWallets[tokenId] = agentWallet;
        agentNames[tokenId] = name;
        emit AgentRegistered(tokenId, to, agentWallet, name, uri);
    }

    /// @notice Update the operational wallet (e.g., after Safe deployment)
    function setAgentWallet(uint256 tokenId, address wallet) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (wallet == address(0)) revert ZeroAddressWallet();
        agentWallets[tokenId] = wallet;
        emit AgentWalletUpdated(tokenId, wallet);
    }

    /// @notice Clear the operational wallet (ERC-8004 v1.2 requirement)
    function unsetAgentWallet(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        agentWallets[tokenId] = address(0);
        emit AgentWalletUnset(tokenId);
    }

    /// @notice Total number of registered agents
    function totalAgents() external view returns (uint256) {
        return _nextTokenId;
    }
}
