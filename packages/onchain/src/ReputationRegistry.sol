// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ClenjexReputationRegistry
/// @notice ERC-8004 Reputation Registry.
///         Stores signed fixed-point feedback scores per agent.
///         Supports: ratings (87/100), trading yield (-3.2%), uptime (99.77%), revenues ($560).
///         value + valueDecimals pattern: e.g. value=-32, decimals=1 → -3.2%
contract ReputationRegistry {
    struct Feedback {
        address rater;
        uint256 agentId;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string metadataURI; // IPFS URI for extended metadata
        uint256 timestamp;
    }

    mapping(uint256 => Feedback[]) private _feedbacks;
    mapping(uint256 => int128) public summaryValue;
    mapping(uint256 => uint8) public summaryValueDecimals;
    mapping(uint256 => uint256) public feedbackCount;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed rater,
        int128 value,
        uint8 valueDecimals,
        string indexed tag1,      // indexed for efficient filtering
        string tag1Raw,            // non-indexed for log reading
        string metadataURI
    );

    error InvalidAgentId();

    /// @notice Submit feedback for an agent
    /// @param agentId The NFT token ID of the agent (from AgentIdentityRegistry)
    /// @param value Signed fixed-point value (e.g. 87 = 87 rating, -32 = -3.2% with 1 decimal)
    /// @param valueDecimals Number of decimal places in value
    /// @param tag1 Category tag (e.g. "tradingYield", "starred", "uptime", "responseTime")
    /// @param metadataURI IPFS URI for extended feedback data
    function submitFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata metadataURI
    ) external {
        Feedback memory fb = Feedback({
            rater: msg.sender,
            agentId: agentId,
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            metadataURI: metadataURI,
            timestamp: block.timestamp
        });
        _feedbacks[agentId].push(fb);
        feedbackCount[agentId]++;

        // Update running summary (weighted average would be better in production,
        // but using most-recent keeps the registry lightweight)
        summaryValue[agentId] = value;
        summaryValueDecimals[agentId] = valueDecimals;

        emit NewFeedback(agentId, msg.sender, value, valueDecimals, tag1, tag1, metadataURI);
    }

    /// @notice Returns summary stats for an agent (ERC-8004 spec interface)
    function getSummary(uint256 agentId)
        external
        view
        returns (uint256 count, int128 value, uint8 decimals)
    {
        return (feedbackCount[agentId], summaryValue[agentId], summaryValueDecimals[agentId]);
    }

    /// @notice Returns all feedbacks for an agent
    function getFeedbacks(uint256 agentId) external view returns (Feedback[] memory) {
        return _feedbacks[agentId];
    }
}
