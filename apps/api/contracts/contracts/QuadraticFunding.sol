// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract QuadraticFunding {
    struct Project {
        uint256 id;
        string name;
        mapping(address => uint256) contributions;
        uint256 totalContributions;
    }

    mapping(uint256 => Project) public projects;
    uint256 public projectCount;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addProject(string memory name) external onlyOwner {
        projectCount++;
        Project storage p = projects[projectCount];
        p.id = projectCount;
        p.name = name;
    }

    function contribute(uint256 projectId) external payable {
        Project storage p = projects[projectId];
        require(p.id != 0, "project not found");
        p.contributions[msg.sender] += msg.value;
        p.totalContributions += msg.value;
    }

    function calculateMatch(uint256 projectId) public view returns (uint256) {
        Project storage p = projects[projectId];
        uint256 sumSquare;
        uint256 sum;
        for (uint256 i = 0; i < 32; i++) {
            address contributor = address(uint160(uint256(keccak256(abi.encodePacked(projectId, i)))));
            uint256 c = p.contributions[contributor];
            if (c > 0) {
                uint256 sqrtC = sqrt(c);
                sumSquare += sqrtC * sqrtC;
                sum += sqrtC;
            }
        }
        return sum * sum - sumSquare;
    }

    function sqrt(uint256 x) internal pure returns (uint256) {
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
