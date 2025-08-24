pragma solidity ^0.8.0;

/// @title CHAI Credential Bridge
/// @notice Simple bridge contract allowing Ethereum smart contracts to
///         validate hashed CHAI credentials registered by an off-chain
///         verifier or another blockchain.
contract ChaiCredentialBridge {
    /// @dev Mapping of credential hashes to their validity state
    mapping(bytes32 => bool) public isCredentialValid;

    /// @notice Emitted when a credential hash is marked as valid
    event CredentialValidated(bytes32 indexed credentialHash);

    /// @notice Mark a credential hash as valid
    /// @dev In a production setting this function would be restricted to a
    ///      bridge operator that verifies the credential on the CHAI chain.
    /// @param credentialHash The keccak256 hash of the credential to enable
    function setCredentialValid(bytes32 credentialHash) external {
        isCredentialValid[credentialHash] = true;
        emit CredentialValidated(credentialHash);
    }

    /// @notice Query whether a credential hash is valid
    /// @param credentialHash The keccak256 hash of the credential
    /// @return True if the credential was validated through the bridge
    function validate(bytes32 credentialHash) external view returns (bool) {
        return isCredentialValid[credentialHash];
    }
}
