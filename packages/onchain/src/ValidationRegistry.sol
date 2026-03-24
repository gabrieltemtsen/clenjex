// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ClenjexValidationRegistry
/// @notice ERC-8004 Validation Registry.
///         Independent validators post validation requests + update status with evidence.
///         responseHash is stored in status (ERC-8004 v1.2 requirement).
contract ValidationRegistry {
    enum ValidationStatus { Pending, Approved, Rejected, Expired }

    struct Validation {
        uint256 agentId;
        address validator;
        ValidationStatus status;
        string evidenceURI;   // IPFS URI with validation data
        bytes32 responseHash; // hash of the validator's response (v1.2)
        uint256 timestamp;
    }

    uint256 private _validationCount;
    mapping(uint256 => Validation) public validations;
    mapping(uint256 => uint256[]) public agentValidations;

    event ValidationSubmitted(
        uint256 indexed validationId,
        uint256 indexed agentId,
        address indexed validator,
        string evidenceURI
    );
    event ValidationStatusUpdated(
        uint256 indexed validationId,
        ValidationStatus status,
        bytes32 responseHash
    );

    error NotValidator();
    error ValidationNotFound();

    /// @notice Submit a new validation request for an agent
    function submitValidation(uint256 agentId, string calldata evidenceURI)
        external
        returns (uint256 validationId)
    {
        validationId = ++_validationCount;
        validations[validationId] = Validation({
            agentId: agentId,
            validator: msg.sender,
            status: ValidationStatus.Pending,
            evidenceURI: evidenceURI,
            responseHash: bytes32(0),
            timestamp: block.timestamp
        });
        agentValidations[agentId].push(validationId);
        emit ValidationSubmitted(validationId, agentId, msg.sender, evidenceURI);
    }

    /// @notice Validator updates status + attaches response hash
    function updateStatus(
        uint256 validationId,
        ValidationStatus status,
        bytes32 responseHash
    ) external {
        Validation storage v = validations[validationId];
        if (v.validator != msg.sender) revert NotValidator();
        v.status = status;
        v.responseHash = responseHash;
        emit ValidationStatusUpdated(validationId, status, responseHash);
    }

    /// @notice Returns status + responseHash for a validation (ERC-8004 v1.2 spec)
    function getValidationStatus(uint256 validationId)
        external
        view
        returns (ValidationStatus status, bytes32 responseHash)
    {
        Validation storage v = validations[validationId];
        return (v.status, v.responseHash);
    }

    /// @notice Returns all validation IDs for an agent
    function getAgentValidations(uint256 agentId) external view returns (uint256[] memory) {
        return agentValidations[agentId];
    }

    function totalValidations() external view returns (uint256) {
        return _validationCount;
    }
}
