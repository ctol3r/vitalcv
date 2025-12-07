// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Matching Pool based on unique contributor counts
/// @notice Sponsors deposit funds and projects receive matching funds
///         proportional to the number of unique contributors they have.
contract MatchingPool {
    mapping(address => uint256) public projectContributions;
    mapping(address => mapping(address => bool)) public hasContributed;
    mapping(address => uint256) public uniqueContributors;
    mapping(address => uint256) public projectMatches;
    mapping(address => bool) public isProject;
    address[] public projects;

    uint256 public totalUniqueContributors;
    uint256 public sponsorFunds;
    bool public allocated;

    /// @notice Deposit sponsor funds to the pool
    function addSponsorFunds() external payable {
        require(!allocated, "already allocated");
        sponsorFunds += msg.value;
    }

    /// @notice Contribute funds to a specific project
    /// @param project Address representing the project
    function contribute(address project) external payable {
        require(!allocated, "funding round ended");
        require(msg.value > 0, "no value");
        projectContributions[project] += msg.value;
        if (!isProject[project]) {
            isProject[project] = true;
            projects.push(project);
        }
        if (!hasContributed[project][msg.sender]) {
            hasContributed[project][msg.sender] = true;
            uniqueContributors[project] += 1;
            totalUniqueContributors += 1;
        }
    }

    /// @notice Allocate sponsor funds based on unique contributor counts
    function allocate() external {
        require(!allocated, "already allocated");
        allocated = true;
        uint256 total = sponsorFunds;
        if (total == 0 || totalUniqueContributors == 0) {
            return;
        }
        for (uint256 i = 0; i < projects.length; i++) {
            address project = projects[i];
            uint256 share = (total * uniqueContributors[project]) / totalUniqueContributors;
            projectMatches[project] = share;
        }
    }

    /// @notice Withdraw matching funds for a project
    function withdrawMatch(address payable project) external {
        require(allocated, "not allocated yet");
        uint256 projectShare = projectMatches[project];
        projectMatches[project] = 0;
        sponsorFunds -= projectShare;
        uint256 amount = projectContributions[project] + projectShare;
        projectContributions[project] = 0;
        (bool sent, ) = project.call{value: amount}("");
        require(sent, "transfer failed");
    }
}
