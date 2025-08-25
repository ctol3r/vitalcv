pragma solidity ^0.8.0;

/// @title Challenge Rewards
/// @notice Handles reward distribution for challenge-based gamification events.
contract ChallengeRewards {
    struct Challenge {
        uint256 id;
        uint256 reward;
        bool isActive;
    }

    mapping(uint256 => Challenge) public challenges;
    mapping(address => mapping(uint256 => bool)) public completed;

    event RewardDistributed(address indexed participant, uint256 indexed challengeId, uint256 reward);

    /// @notice Add a new challenge with a fixed reward amount.
    /// @param id The unique challenge identifier.
    /// @param reward The reward to distribute when the challenge is completed.
    function addChallenge(uint256 id, uint256 reward) external {
        require(!challenges[id].isActive, "challenge already exists");
        challenges[id] = Challenge({id: id, reward: reward, isActive: true});
    }

    /// @notice Mark a challenge as completed and emit a reward distribution event.
    /// @param participant The address of the participant completing the challenge.
    /// @param challengeId The identifier of the challenge.
    function completeChallenge(address participant, uint256 challengeId) external {
        Challenge memory c = challenges[challengeId];
        require(c.isActive, "invalid challenge");
        require(!completed[participant][challengeId], "challenge already completed");
        completed[participant][challengeId] = true;

        // In a real implementation, token transfers would happen here.
        emit RewardDistributed(participant, challengeId, c.reward);
    }
}
