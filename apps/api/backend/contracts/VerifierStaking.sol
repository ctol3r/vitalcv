// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VerifierStaking
 * @dev Simple staking contract for verifiers. Verifiers lock tokens as stake
 * and may be slashed for incorrect verifications. The contract owner controls
 * the slashing logic and may slash a verifier's stake when mis-verification is
 * detected.
 */
contract VerifierStaking {
    mapping(address => uint256) public stakes;
    uint256 public totalStaked;
    address public owner;

    event Staked(address indexed verifier, uint256 amount);
    event Withdrawn(address indexed verifier, uint256 amount);
    event Slashed(address indexed verifier, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Stake tokens by sending ether to the contract.
     */
    function stake() external payable {
        require(msg.value > 0, "stake > 0");
        stakes[msg.sender] += msg.value;
        totalStaked += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw staked tokens.
     * @param amount The amount to withdraw.
     */
    function withdraw(uint256 amount) external {
        require(stakes[msg.sender] >= amount, "insufficient stake");
        stakes[msg.sender] -= amount;
        totalStaked -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @dev Slash a verifier's stake. Can only be called by owner.
     * @param verifier The address of the verifier to slash.
     * @param amount The amount to slash.
     */
    function slash(address verifier, uint256 amount) external onlyOwner {
        require(stakes[verifier] >= amount, "insufficient stake to slash");
        stakes[verifier] -= amount;
        totalStaked -= amount;
        emit Slashed(verifier, amount);
    }
}
