// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GovernanceToken
 * @dev ERC20 compatible token with simple voting delegation and linear vesting.
 * Voting power is based on token balances plus delegated votes.
 */
contract GovernanceToken {
    string public constant name = "GovernanceToken";
    string public constant symbol = "GOV";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;

    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;

    // Delegation
    mapping(address => address) public delegates;
    mapping(address => uint256) private delegatedVotes;

    // Vesting schedule
    struct VestingSchedule {
        uint256 total;       // total amount to vest
        uint256 released;    // amount already released
        uint64  start;       // start timestamp
        uint64  cliff;       // cliff duration in seconds
        uint64  duration;    // vesting duration in seconds
    }
    mapping(address => VestingSchedule) public vesting;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event TokensReleased(address indexed beneficiary, uint256 amount);

    /**
     * @dev Mints `amount` tokens to `to`.
     */
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "mint to zero");
        totalSupply += amount;
        balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /**
     * @dev Creates a vesting schedule for `beneficiary`.
     */
    function _createVesting(address beneficiary, uint256 amount, uint64 start, uint64 cliffDuration, uint64 duration) internal {
        require(duration > 0, "duration 0");
        require(vesting[beneficiary].total == 0, "existing vesting");
        vesting[beneficiary] = VestingSchedule({
            total: amount,
            released: 0,
            start: start,
            cliff: start + cliffDuration,
            duration: duration
        });
        _mint(address(this), amount);
    }

    /**
     * @dev Releases vested tokens to the caller.
     */
    function release() external {
        VestingSchedule storage schedule = vesting[msg.sender];
        require(schedule.total > 0, "no schedule");
        uint256 vested = _vestedAmount(schedule);
        uint256 unreleased = vested - schedule.released;
        require(unreleased > 0, "nothing to release");
        schedule.released = vested;
        balances[address(this)] -= unreleased;
        balances[msg.sender] += unreleased;
        emit TokensReleased(msg.sender, unreleased);
        emit Transfer(address(this), msg.sender, unreleased);
    }

    /**
     * @dev Calculates vested amount for a schedule.
     */
    function _vestedAmount(VestingSchedule memory schedule) internal view returns (uint256) {
        if (block.timestamp < schedule.cliff) {
            return 0;
        } else if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.total;
        } else {
            uint256 elapsed = block.timestamp - schedule.start;
            return (schedule.total * elapsed) / schedule.duration;
        }
    }

    /** ERC20 Methods **/
    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowances[from][msg.sender];
        require(allowed >= amount, "allowance");
        allowances[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return allowances[owner][spender];
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "transfer to zero");
        require(balances[from] >= amount, "balance");
        balances[from] -= amount;
        balances[to] += amount;
        _moveDelegates(delegates[from], delegates[to], amount);
        emit Transfer(from, to, amount);
    }

    /** Voting delegation logic **/

    function delegate(address delegatee) external {
        address currentDelegate = delegates[msg.sender];
        delegates[msg.sender] = delegatee;
        emit DelegateChanged(msg.sender, currentDelegate, delegatee);
        uint256 balance = balances[msg.sender];
        _moveDelegates(currentDelegate, delegatee, balance);
    }

    function getVotes(address account) public view returns (uint256) {
        return balances[account] + delegatedVotes[account];
    }

    function _moveDelegates(address from, address to, uint256 amount) internal {
        if (from != to && amount > 0) {
            if (from != address(0)) {
                delegatedVotes[from] -= amount;
            }
            if (to != address(0)) {
                delegatedVotes[to] += amount;
            }
        }
    }
}

