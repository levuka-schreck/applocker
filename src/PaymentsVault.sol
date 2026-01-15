// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LPToken.sol";
import "./AppExToken.sol";

/**
 * @title PaymentsVault
 * @dev Core lending/borrowing vault for AppEx protocol
 */
contract PaymentsVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Tokens
    IERC20 public immutable usdc;
    AppExToken public immutable appexToken;
    LPToken public immutable lpToken;

    // Vault state
    uint256 public totalDeposits;
    uint256 public totalLoansOutstanding;
    uint256 public totalAccruedFees;
    uint256 public lastNAVUpdate;

    // Parameters
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public dailyRedemptionCap = 500; // 5% in basis points
    uint256 public liquidityBuffer = 1500; // 15% in basis points
    uint256 public stakingMultiplier = 100; // 1:1 default

    // Borrowers
    struct Borrower {
        bool approved;
        uint256 borrowLimit;
        uint256 currentDebt;
        uint256 lpYieldRate; // basis points per loan
        uint256 protocolFeeRate; // basis points per loan
    }
    mapping(address => Borrower) public borrowers;
    address[] public borrowerList;

    // Loans
    struct Loan {
        address borrower;
        address publisher;
        uint256 principal;
        uint256 lpFee;
        uint256 protocolFee;
        uint256 startTime;
        uint256 termDays;
        bool repaid;
        uint256 dailyAccrual;
    }
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId = 1;
    uint256[] public activeLoans;

    // Staking
    struct StakingPosition {
        uint256 appexStaked;
        uint256 lockDuration; // 0, 90, or 180 days
        uint256 lockEnd;
        uint256 pendingRewards;
    }
    mapping(address => StakingPosition) public stakingPositions;
    uint256 public totalStaked;
    uint256 public totalStakingWeight;

    // Redemption queue
    struct RedemptionRequest {
        address lp;
        uint256 amount;
        uint256 timestamp;
    }
    RedemptionRequest[] public redemptionQueue;
    uint256 public totalPendingRedemptions;

    // Events
    event Deposited(address indexed lp, uint256 amount, uint256 lpTokens);
    event RedemptionRequested(address indexed lp, uint256 amount);
    event Redeemed(address indexed lp, uint256 lpTokens, uint256 usdc);
    event BorrowerApproved(address indexed borrower, uint256 limit);
    event LoanCreated(uint256 indexed loanId, address indexed borrower, address indexed publisher, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 fees);
    event Staked(address indexed lp, uint256 amount, uint256 duration);
    event Unstaked(address indexed lp, uint256 amount);
    event RewardsDistributed(uint256 amount);

    constructor(
        address _usdc,
        address _appexToken,
        string memory lpName,
        string memory lpSymbol
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        appexToken = AppExToken(_appexToken);
        lpToken = new LPToken(lpName, lpSymbol);
        lpToken.setVault(address(this));
        lastNAVUpdate = block.timestamp;
    }

    // ==================== LP Functions ====================

    /**
     * @dev Deposit USDC and receive LP tokens
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        updateNAV();
        
        uint256 lpTokensToMint;
        if (lpToken.totalSupply() == 0) {
            // First deposit: convert USDC (6 decimals) to LP tokens (18 decimals)
            // 1 USDC = 1 LP token, but need to account for decimal difference
            lpTokensToMint = amount * 10**12; // Convert 6 decimals to 18 decimals
        } else {
            lpTokensToMint = (amount * lpToken.totalSupply()) / getNAV();
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposits += amount;
        lpToken.mint(msg.sender, lpTokensToMint);

        emit Deposited(msg.sender, amount, lpTokensToMint);
    }

    /**
     * @dev Request redemption of LP tokens
     */
    function requestRedemption(uint256 lpTokenAmount) external nonReentrant {
        require(lpTokenAmount > 0, "Amount must be > 0");
        require(lpToken.balanceOf(msg.sender) >= lpTokenAmount, "Insufficient LP tokens");

        updateNAV();

        // Transfer LP tokens to vault
        lpToken.transferFrom(msg.sender, address(this), lpTokenAmount);

        redemptionQueue.push(RedemptionRequest({
            lp: msg.sender,
            amount: lpTokenAmount,
            timestamp: block.timestamp
        }));

        totalPendingRedemptions += lpTokenAmount;

        emit RedemptionRequested(msg.sender, lpTokenAmount);
    }

    /**
     * @dev Process redemption queue
     */
    function processRedemptions() external nonReentrant {
        updateNAV();

        uint256 nav = getNAV();
        uint256 availableUSDC = getAvailableUSDC();
        uint256 dailyCap = (lpToken.totalSupply() * dailyRedemptionCap) / BASIS_POINTS;
        uint256 processedToday = 0;

        uint256 i = 0;
        while (i < redemptionQueue.length && processedToday < dailyCap) {
            RedemptionRequest memory request = redemptionQueue[i];
            uint256 usdcAmount = (request.amount * nav) / lpToken.totalSupply();

            if (usdcAmount <= availableUSDC) {
                // Process redemption
                lpToken.burn(address(this), request.amount);
                usdc.safeTransfer(request.lp, usdcAmount);
                
                totalDeposits -= usdcAmount;
                totalPendingRedemptions -= request.amount;
                availableUSDC -= usdcAmount;
                processedToday += request.amount;

                emit Redeemed(request.lp, request.amount, usdcAmount);

                // Remove from queue
                redemptionQueue[i] = redemptionQueue[redemptionQueue.length - 1];
                redemptionQueue.pop();
            } else {
                i++;
            }
        }
    }

    // ==================== Borrower Functions ====================

    /**
     * @dev Approve a borrower
     */
    function approveBorrower(
        address borrower,
        uint256 limit,
        uint256 lpYieldRate,
        uint256 protocolFeeRate
    ) external onlyOwner {
        require(!borrowers[borrower].approved, "Already approved");
        
        borrowers[borrower] = Borrower({
            approved: true,
            borrowLimit: limit,
            currentDebt: 0,
            lpYieldRate: lpYieldRate,
            protocolFeeRate: protocolFeeRate
        });

        borrowerList.push(borrower);

        emit BorrowerApproved(borrower, limit);
    }

    /**
     * @dev Create a loan for instant publisher payout
     */
    function createLoan(
        address publisher,
        uint256 principal,
        uint256 termDays,
        bool payInAppEx,
        uint256 appexPercentage
    ) external nonReentrant returns (uint256) {
        Borrower storage borrower = borrowers[msg.sender];
        require(borrower.approved, "Not approved borrower");
        require(borrower.currentDebt + principal <= borrower.borrowLimit, "Exceeds limit");
        require(principal > 0, "Principal must be > 0");
        require(appexPercentage <= 100, "Invalid percentage");

        updateNAV();

        uint256 lpFee = (principal * borrower.lpYieldRate) / BASIS_POINTS;
        uint256 protocolFee = (principal * borrower.protocolFeeRate) / BASIS_POINTS;

        uint256 loanId = nextLoanId++;
        
        loans[loanId] = Loan({
            borrower: msg.sender,
            publisher: publisher,
            principal: principal,
            lpFee: lpFee,
            protocolFee: protocolFee,
            startTime: block.timestamp,
            termDays: termDays,
            repaid: false,
            dailyAccrual: lpFee / termDays
        });

        activeLoans.push(loanId);
        borrower.currentDebt += principal;
        totalLoansOutstanding += principal;

        // Handle payment to publisher
        if (payInAppEx && appexPercentage > 0) {
            uint256 appexAmount = (principal * appexPercentage) / 100;
            uint256 usdcAmount = principal - appexAmount;

            if (usdcAmount > 0) {
                usdc.safeTransfer(publisher, usdcAmount);
            }

            if (appexAmount > 0) {
                // In production, this would buy APPEX from DEX
                // For demo, direct transfer
                appexToken.transfer(publisher, appexAmount * 10**12); // Adjust for decimals
            }
        } else {
            usdc.safeTransfer(publisher, principal);
        }

        emit LoanCreated(loanId, msg.sender, publisher, principal);

        return loanId;
    }

    /**
     * @dev Repay a loan
     */
    function repayLoan(uint256 loanId, bool payFeeInAppEx) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(!loan.repaid, "Already repaid");
        require(loan.borrower == msg.sender, "Not loan borrower");

        updateNAV();

        uint256 totalDue = loan.principal + loan.lpFee + loan.protocolFee;

        if (payFeeInAppEx) {
            // 25% discount on protocol fees if paid in APPEX
            uint256 discountedFee = (loan.protocolFee * 75) / 100;
            uint256 appexFeeAmount = discountedFee * 10**12; // Adjust decimals

            usdc.safeTransferFrom(msg.sender, address(this), loan.principal + loan.lpFee);
            appexToken.transferFrom(msg.sender, address(this), appexFeeAmount);

            // Distribute APPEX fees to stakers
            distributeAppExFees(appexFeeAmount);
        } else {
            usdc.safeTransferFrom(msg.sender, address(this), totalDue);
        }

        loan.repaid = true;
        borrowers[msg.sender].currentDebt -= loan.principal;
        totalLoansOutstanding -= loan.principal;
        totalAccruedFees += loan.lpFee;

        // Remove from active loans
        for (uint256 i = 0; i < activeLoans.length; i++) {
            if (activeLoans[i] == loanId) {
                activeLoans[i] = activeLoans[activeLoans.length - 1];
                activeLoans.pop();
                break;
            }
        }

        emit LoanRepaid(loanId, loan.principal, loan.lpFee + loan.protocolFee);
    }

    // ==================== Staking Functions ====================

    /**
     * @dev Stake APPEX tokens
     */
    function stake(uint256 amount, uint256 lockDays) external nonReentrant {
        require(lockDays == 0 || lockDays == 90 || lockDays == 180, "Invalid lock period");
        require(amount > 0, "Amount must be > 0");
        
        uint256 lpBalance = lpToken.balanceOf(msg.sender);
        uint256 maxStake = (lpBalance * stakingMultiplier) / 100;
        
        StakingPosition storage position = stakingPositions[msg.sender];
        require(position.appexStaked + amount <= maxStake, "Exceeds staking cap");

        appexToken.transferFrom(msg.sender, address(this), amount);

        uint256 multiplier = lockDays == 0 ? 1 : (lockDays == 90 ? 2 : 3);
        uint256 weight = amount * multiplier;

        if (position.appexStaked > 0) {
            // Update existing position
            totalStakingWeight -= position.appexStaked * getMultiplier(position.lockDuration);
        }

        position.appexStaked += amount;
        position.lockDuration = lockDays;
        position.lockEnd = block.timestamp + (lockDays * 1 days);
        
        totalStaked += amount;
        totalStakingWeight += weight;

        emit Staked(msg.sender, amount, lockDays);
    }

    /**
     * @dev Unstake APPEX tokens
     */
    function unstake(uint256 amount) external nonReentrant {
        StakingPosition storage position = stakingPositions[msg.sender];
        require(position.appexStaked >= amount, "Insufficient staked");
        require(block.timestamp >= position.lockEnd, "Still locked");

        uint256 multiplier = getMultiplier(position.lockDuration);
        totalStakingWeight -= amount * multiplier;
        
        position.appexStaked -= amount;
        totalStaked -= amount;

        appexToken.transfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    // ==================== View Functions ====================

    /**
     * @dev Get current NAV
     */
    function getNAV() public view returns (uint256) {
        return totalDeposits + totalLoansOutstanding + totalAccruedFees;
    }

    /**
     * @dev Get available USDC for redemptions/loans
     */
    function getAvailableUSDC() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        uint256 requiredBuffer = (getNAV() * liquidityBuffer) / BASIS_POINTS;
        return balance > requiredBuffer ? balance - requiredBuffer : 0;
    }

    /**
     * @dev Get LP share price
     */
    function getSharePrice() public view returns (uint256) {
        uint256 supply = lpToken.totalSupply();
        if (supply == 0) return 1e6; // Initial price
        return (getNAV() * 1e18) / supply;
    }

    /**
     * @dev Get staking multiplier based on lock duration
     */
    function getMultiplier(uint256 lockDays) internal pure returns (uint256) {
        if (lockDays == 0) return 1;
        if (lockDays == 90) return 2;
        return 3;
    }

    /**
     * @dev Update NAV with accrued fees
     */
    function updateNAV() public {
        uint256 timeElapsed = block.timestamp - lastNAVUpdate;
        if (timeElapsed == 0) return;

        uint256 accruedFees = 0;
        for (uint256 i = 0; i < activeLoans.length; i++) {
            Loan memory loan = loans[activeLoans[i]];
            if (!loan.repaid) {
                uint256 daysElapsed = (block.timestamp - loan.startTime) / 1 days;
                uint256 maxAccrual = loan.lpFee;
                uint256 calculatedAccrual = loan.dailyAccrual * daysElapsed;
                accruedFees += calculatedAccrual > maxAccrual ? maxAccrual : calculatedAccrual;
            }
        }

        totalAccruedFees = accruedFees;
        lastNAVUpdate = block.timestamp;
    }

    /**
     * @dev Distribute APPEX fees to stakers
     */
    function distributeAppExFees(uint256 amount) internal {
        if (totalStakingWeight == 0) return;

        // Simple proportional distribution
        // In production, would accumulate and distribute monthly
        emit RewardsDistributed(amount);
    }

    /**
     * @dev Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 nav,
        uint256 sharePrice,
        uint256 totalLPs,
        uint256 availableLiquidity,
        uint256 utilizationRate,
        uint256 activeLoansCount
    ) {
        nav = getNAV();
        sharePrice = getSharePrice();
        totalLPs = lpToken.totalSupply();
        availableLiquidity = getAvailableUSDC();
        utilizationRate = nav > 0 ? (totalLoansOutstanding * BASIS_POINTS) / nav : 0;
        activeLoansCount = activeLoans.length;
    }

    /**
     * @dev Get borrower info
     */
    function getBorrowerInfo(address borrower) external view returns (
        bool approved,
        uint256 limit,
        uint256 currentDebt,
        uint256 available,
        uint256 lpYieldRate,
        uint256 protocolFeeRate
    ) {
        Borrower memory b = borrowers[borrower];
        approved = b.approved;
        limit = b.borrowLimit;
        currentDebt = b.currentDebt;
        available = b.borrowLimit > b.currentDebt ? b.borrowLimit - b.currentDebt : 0;
        lpYieldRate = b.lpYieldRate;
        protocolFeeRate = b.protocolFeeRate;
    }

    /**
     * @dev Get staking info
     */
    function getStakingInfo(address account) external view returns (
        uint256 staked,
        uint256 maxStake,
        uint256 lockEnd,
        uint256 multiplier,
        uint256 pendingRewards
    ) {
        StakingPosition memory position = stakingPositions[account];
        uint256 lpBalance = lpToken.balanceOf(account);
        
        staked = position.appexStaked;
        maxStake = (lpBalance * stakingMultiplier) / 100;
        lockEnd = position.lockEnd;
        multiplier = getMultiplier(position.lockDuration);
        pendingRewards = position.pendingRewards;
    }
}
