// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title MilestoneEscrow
 * @dev Escrow contract for milestone-based payments. Funds are deposited
 * by a payer and released to a payee upon confirmation of milestone
 * completion.
 */
contract MilestoneEscrow {
    struct Milestone {
        address payer;
        address payee;
        uint256 amount;
        bool released;
    }

    mapping(uint256 => Milestone) public milestones;
    uint256 public nextMilestoneId;

    event MilestoneCreated(uint256 indexed milestoneId, address indexed payer, address indexed payee, uint256 amount);
    event MilestoneReleased(uint256 indexed milestoneId);

    /**
     * @dev Create a new milestone and deposit ether.
     * @param _payee Address to receive funds when milestone is released.
     */
    function createMilestone(address _payee) external payable returns (uint256) {
        require(msg.value > 0, "Deposit required");
        uint256 id = nextMilestoneId++;
        milestones[id] = Milestone({
            payer: msg.sender,
            payee: _payee,
            amount: msg.value,
            released: false
        });
        emit MilestoneCreated(id, msg.sender, _payee, msg.value);
        return id;
    }

    /**
     * @dev Release milestone funds to payee. Can only be called by payer.
     * @param _milestoneId Id of the milestone.
     */
    function releaseMilestone(uint256 _milestoneId) external {
        Milestone storage m = milestones[_milestoneId];
        require(msg.sender == m.payer, "Only payer can release");
        require(!m.released, "Already released");

        m.released = true;
        payable(m.payee).transfer(m.amount);
        emit MilestoneReleased(_milestoneId);
    }
}
