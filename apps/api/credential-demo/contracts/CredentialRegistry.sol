// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CredentialRegistry {
    mapping(address => string) public credentials;

    event CredentialIssued(address indexed to, string credential);

    function issueCredential(address to, string calldata credential) external {
        require(bytes(credentials[to]).length == 0, "Already issued");
        credentials[to] = credential;
        emit CredentialIssued(to, credential);
    }
}
