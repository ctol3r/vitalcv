// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TrustRegistry
 * @dev Simple on-chain registry that tracks issuer reputation based on
 * weighted endorsement votes.
 */
contract TrustRegistry {
    struct Issuer {
        uint256 reputation; // sum of endorsement weights
        bool exists;
    }

    // issuer address => Issuer data
    mapping(address => Issuer) private issuers;

    // endorser => issuer => voted?
    mapping(address => mapping(address => bool)) public hasEndorsed;

    event IssuerRegistered(address indexed issuer);
    event IssuerEndorsed(address indexed issuer, address indexed endorser, uint256 weight, uint256 newReputation);

    /**
     * @notice Register a new issuer. Can be called by anyone.
     */
    function registerIssuer(address issuer) external {
        require(!issuers[issuer].exists, "Issuer already registered");
        issuers[issuer].exists = true;
        emit IssuerRegistered(issuer);
    }

    /**
     * @notice Submit a weighted endorsement for an issuer.
     * @param issuer The issuer address being endorsed.
     * @param weight The reputation weight to add.
     */
    function endorseIssuer(address issuer, uint256 weight) external {
        require(issuers[issuer].exists, "Issuer not registered");
        require(!hasEndorsed[msg.sender][issuer], "Already endorsed");
        require(weight > 0, "Weight must be positive");

        issuers[issuer].reputation += weight;
        hasEndorsed[msg.sender][issuer] = true;

        emit IssuerEndorsed(issuer, msg.sender, weight, issuers[issuer].reputation);
    }

    /**
     * @notice Returns the reputation score for an issuer.
     */
    function getReputation(address issuer) external view returns (uint256) {
        return issuers[issuer].reputation;
    }

    /**
     * @notice Checks whether an issuer is registered.
     */
    function isRegistered(address issuer) external view returns (bool) {
        return issuers[issuer].exists;
    }
}
