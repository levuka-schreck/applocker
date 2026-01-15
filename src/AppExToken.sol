// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AppExToken
 * @dev $APPEX token with vesting schedules
 */
contract AppExToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public immutable deploymentTime;

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 tgeUnlock;
        uint256 released;
        uint256 startTime;
    }

    mapping(address => VestingSchedule) public vestingSchedules;

    event VestingScheduleCreated(
        address indexed beneficiary,
        uint256 totalAmount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        uint256 tgeUnlock
    );
    event TokensReleased(address indexed beneficiary, uint256 amount);

    constructor() ERC20("AppEx Token", "APPEX") Ownable(msg.sender) {
        deploymentTime = block.timestamp;
        _mint(address(this), TOTAL_SUPPLY);
    }

    /**
     * @dev Create a vesting schedule for a beneficiary
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        uint256 tgeUnlockPercent
    ) external onlyOwner {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(vestingSchedules[beneficiary].totalAmount == 0, "Schedule exists");
        require(totalAmount > 0, "Amount must be > 0");

        uint256 tgeUnlock = (totalAmount * tgeUnlockPercent) / 100;
        
        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: totalAmount,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            tgeUnlock: tgeUnlock,
            released: 0,
            startTime: deploymentTime
        });

        emit VestingScheduleCreated(
            beneficiary,
            totalAmount,
            cliffDuration,
            vestingDuration,
            tgeUnlock
        );
    }

    /**
     * @dev Calculate releasable amount for a beneficiary
     */
    function releasableAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        
        if (schedule.totalAmount == 0) {
            return 0;
        }

        uint256 elapsed = block.timestamp - schedule.startTime;
        
        // Before cliff
        if (elapsed < schedule.cliffDuration) {
            return schedule.tgeUnlock > schedule.released ? 
                   schedule.tgeUnlock - schedule.released : 0;
        }

        // After cliff, calculate vested amount
        uint256 vestedAmount;
        if (elapsed >= schedule.cliffDuration + schedule.vestingDuration) {
            // Fully vested
            vestedAmount = schedule.totalAmount;
        } else {
            // Linearly vested
            uint256 vestingElapsed = elapsed - schedule.cliffDuration;
            uint256 vestingAmount = schedule.totalAmount - schedule.tgeUnlock;
            vestedAmount = schedule.tgeUnlock + 
                          (vestingAmount * vestingElapsed) / schedule.vestingDuration;
        }

        return vestedAmount > schedule.released ? vestedAmount - schedule.released : 0;
    }

    /**
     * @dev Release vested tokens to beneficiary
     */
    function release() external {
        uint256 amount = releasableAmount(msg.sender);
        require(amount > 0, "No tokens to release");

        vestingSchedules[msg.sender].released += amount;
        _transfer(address(this), msg.sender, amount);

        emit TokensReleased(msg.sender, amount);
    }

    /**
     * @dev Get vesting info for a beneficiary
     */
    function getVestingInfo(address beneficiary) external view returns (
        uint256 totalAmount,
        uint256 released,
        uint256 releasable,
        uint256 locked
    ) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        totalAmount = schedule.totalAmount;
        released = schedule.released;
        releasable = releasableAmount(beneficiary);
        locked = totalAmount - released - releasable;
    }

    /**
     * @dev Transfer tokens directly (for Public and Liquidity allocations)
     */
    function transferTokens(address to, uint256 amount) external onlyOwner {
        _transfer(address(this), to, amount);
    }
}
