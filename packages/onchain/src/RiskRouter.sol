// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ClenjexRiskRouter
/// @notice Accepts EIP-712 signed TradeIntents from agents (EOA or Safe via EIP-1271).
///         Enforces: whitelisted pairs, slippage limits, deadline, nonces.
///         Emits on-chain events for leaderboard indexing + reputation scoring.
///         Chain-ID is embedded in the intent (EIP-155) for replay protection.
contract RiskRouter is EIP712, Ownable {
    using ECDSA for bytes32;

    // ---- EIP-712 type hash ----
    bytes32 public constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(uint256 agentId,string pair,string side,string amount,uint256 maxSlippage,uint256 deadline,uint256 nonce,uint256 chainId)"
    );

    // ---- Risk parameters (configurable by owner) ----
    uint256 public maxSlippageBps = 500;   // 5% max slippage
    uint256 public dailyLossLimitBps = 1000; // 10% daily loss limit

    // ---- State ----
    mapping(address => uint256) public nonces;
    mapping(string => bool) public whitelistedPairs;

    // ---- Structs ----
    struct TradeIntent {
        uint256 agentId;
        string pair;
        string side;       // "buy" or "sell"
        string amount;     // decimal string
        uint256 maxSlippage; // basis points
        uint256 deadline;
        uint256 nonce;
        uint256 chainId;   // EIP-155 chain binding
    }

    // ---- Events (indexed for leaderboard + reputation) ----
    event TradeIntentSubmitted(
        uint256 indexed agentId,
        address indexed agent,
        string pair,
        string side,
        string amount,
        uint256 nonce,
        bytes32 indexed intentHash
    );
    event PairWhitelisted(string pair, bool allowed);
    event RiskParamsUpdated(uint256 maxSlippageBps, uint256 dailyLossLimitBps);

    // ---- Errors ----
    error SlippageTooHigh(uint256 given, uint256 max);
    error PairNotWhitelisted(string pair);
    error DeadlineExpired(uint256 deadline, uint256 blockTime);
    error InvalidNonce(uint256 expected, uint256 given);
    error InvalidSignature();
    error ChainIdMismatch(uint256 intentChain, uint256 blockChain);

    constructor() EIP712("clenjex", "1") Ownable(msg.sender) {
        // Default whitelisted pairs
        whitelistedPairs["BTC/USD"] = true;
        whitelistedPairs["ETH/USD"] = true;
        whitelistedPairs["SOL/USD"] = true;
        whitelistedPairs["XRP/USD"] = true;
        whitelistedPairs["BTC/USDT"] = true;
        whitelistedPairs["ETH/USDT"] = true;
    }

    /// @notice Submit a signed TradeIntent. Works with EOA (ECDSA) and Safe (EIP-1271).
    /// @param intent The trade intent struct
    /// @param signature ECDSA signature (EOA) or EIP-1271 bytes (Safe)
    /// @return intentHash The EIP-712 typed-data hash of the intent
    function submitIntent(
        TradeIntent calldata intent,
        bytes calldata signature
    ) external returns (bytes32 intentHash) {
        // --- Validations ---
        if (block.timestamp > intent.deadline)
            revert DeadlineExpired(intent.deadline, block.timestamp);

        if (intent.chainId != block.chainid)
            revert ChainIdMismatch(intent.chainId, block.chainid);

        if (!whitelistedPairs[intent.pair])
            revert PairNotWhitelisted(intent.pair);

        if (intent.maxSlippage > maxSlippageBps)
            revert SlippageTooHigh(intent.maxSlippage, maxSlippageBps);

        if (intent.nonce != nonces[msg.sender])
            revert InvalidNonce(nonces[msg.sender], intent.nonce);

        // --- EIP-712 hash ---
        intentHash = keccak256(abi.encode(
            TRADE_INTENT_TYPEHASH,
            intent.agentId,
            keccak256(bytes(intent.pair)),
            keccak256(bytes(intent.side)),
            keccak256(bytes(intent.amount)),
            intent.maxSlippage,
            intent.deadline,
            intent.nonce,
            intent.chainId
        ));
        bytes32 digest = _hashTypedDataV4(intentHash);

        // --- Signature verification (EOA or EIP-1271 smart contract wallet) ---
        if (!_verifySignature(msg.sender, digest, signature))
            revert InvalidSignature();

        // --- Execute: record on-chain, increment nonce ---
        nonces[msg.sender]++;

        emit TradeIntentSubmitted(
            intent.agentId,
            msg.sender,
            intent.pair,
            intent.side,
            intent.amount,
            intent.nonce,
            intentHash
        );
    }

    /// @notice Verify signature — ECDSA for EOAs, EIP-1271 for Safe/smart wallets
    function _verifySignature(
        address signer,
        bytes32 digest,
        bytes calldata signature
    ) internal view returns (bool) {
        // Try ECDSA first (EOA)
        if (signature.length == 65) {
            address recovered = ECDSA.recover(digest, signature);
            if (recovered == signer) return true;
        }
        // Fallback: EIP-1271 (Safe, etc.)
        try IERC1271(signer).isValidSignature(digest, signature) returns (bytes4 magicValue) {
            return magicValue == IERC1271.isValidSignature.selector;
        } catch {}
        return false;
    }

    /// @notice Returns the EIP-712 domain separator (useful for client-side signing)
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getNonce(address agent) external view returns (uint256) {
        return nonces[agent];
    }

    // ---- Admin ----
    function whitelistPair(string calldata pair, bool allowed) external onlyOwner {
        whitelistedPairs[pair] = allowed;
        emit PairWhitelisted(pair, allowed);
    }

    function setRiskParams(uint256 _maxSlippageBps, uint256 _dailyLossLimitBps) external onlyOwner {
        maxSlippageBps = _maxSlippageBps;
        dailyLossLimitBps = _dailyLossLimitBps;
        emit RiskParamsUpdated(_maxSlippageBps, _dailyLossLimitBps);
    }
}
