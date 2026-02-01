// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "./LPToken.sol";
import "./AppExToken.sol";

/**
 * @title PaymentsVault
 * @dev Core lending/borrowing vault for AppEx protocol
 */
contract PaymentsVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    TimelockController public timelock;
    mapping(address => bool) public governors;
    uint256 public constant GOVERNOR_THRESHOLD = 2;
    address[] public governorList;
    uint256 public nextProposalId = 1;

    mapping(address => bytes32[]) public governorProposals; // Proposals created by each governor
    mapping(address => uint256) public governorApprovalCount; // Approvals made by each governor

    // Multi-Admin System
    mapping(address => bool) public admins;
    address[] public adminList;

    // Tokens
    IERC20 public immutable usdc;
    AppExToken public immutable appexToken;
    LPToken public immutable lpToken;

    // Vault state
    uint256 public totalDeposits;
    uint256 public totalLoansOutstanding;      // Total principal owed by borrowers
    uint256 public totalAppexFundedLoans;      // Portion of loans funded by borrower's APPEX (not vault USDC)
    uint256 public totalAccruedFees;           // Pending fees on active loans (calculated by updateNAV)
    uint256 public totalCollectedFees;         // Realized LP fees that have been paid
    uint256 public totalProtocolFees;          // Protocol fees + APPEX-converted amounts
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
        uint256 totalBorrowed; // Lifetime total borrowed
        uint256 totalRepaid;   // Lifetime total repaid (principal only)
        uint256 totalFeesPaid; // Lifetime fees paid
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
        bool repaid;           // Principal has been repaid
        bool protocolFeePaid;  // Protocol fee has been paid
        uint256 dailyAccrual;
        uint256 usdcPrincipal; // Actual USDC sent (may be less than principal if APPEX split)
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

    struct BorrowerProposal {
        address borrower;
        uint256 limit;
        uint256 lpYieldRate;
        uint256 protocolFeeRate;
        uint256 approvals;
        mapping(address => bool) hasApproved;
        uint256 proposedAt;
    }

    mapping(bytes32 => BorrowerProposal) public borrowerProposals;

    /**
     * @dev Detailed loan information for UI display
     */
    struct LoanDetails {
        uint256 loanId;
        address borrower;
        address publisher;
        uint256 principal;
        uint256 usdcPrincipal;  // Actual USDC sent (may be less if APPEX split)
        uint256 lpFee;
        uint256 protocolFee;
        uint256 totalDue;
        uint256 startTime;
        uint256 termDays;
        uint256 endTime;
        bool repaid;
        bool protocolFeePaid;
        uint256 daysElapsed;
        bool isOverdue;
        uint256 accruedFees;
    }

    /**
     * @dev Detailed borrower information for admin UI
     */
    struct BorrowerDetails {
        address borrowerAddress;
        bool approved;
        uint256 borrowLimit;
        uint256 currentDebt;
        uint256 availableCredit;
        uint256 utilizationRate; // in basis points
        uint256 lpYieldRate;
        uint256 protocolFeeRate;
        uint256 totalFeeRate;
        uint256 activeLoanCount;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 totalFeesPaid;
    }

    struct GovernorDetails {
        address governorAddress;
        bool isActive;
        uint256 proposalCount;
        uint256 approvalCount;
    }

    struct AdminDetails {
        address adminAddress;
        bool isActive;
    }

    // Events
    event RedemptionRequested(address indexed lp, uint256 amount);
    event Redeemed(address indexed lp, uint256 lpTokens, uint256 usdc);
    event BorrowerApproved(address indexed borrower, uint256 limit);
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed publisher,
        uint256 amount
    );
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 fees);
    event ProtocolFeePaid(uint256 indexed loanId, uint256 feeAmount, bool paidInAppex);
    event ProtocolFeesWithdrawn(address indexed recipient, uint256 amount);
    event Staked(address indexed lp, uint256 amount, uint256 duration);
    event Unstaked(address indexed lp, uint256 amount);
    event RewardsDistributed(uint256 amount);
    event Deposited(address indexed lp, uint256 amount, uint256 lpTokens);
    event GovernorAdded(address indexed governor, address indexed addedBy);
    event GovernorRemoved(address indexed governor, address indexed removedBy);
    event AdminAdded(address indexed admin, address indexed addedBy);
    event AdminRemoved(address indexed admin, address indexed removedBy);
    event TimelockSet(address indexed timelock);
    event BorrowerProposed(bytes32 proposalId, address borrower, uint256 limit);
    event BorrowerProposalApproved(
        bytes32 proposalId,
        address approver,
        uint256 approvals
    );

    modifier onlyAdmin() {
        require(
            msg.sender == owner() || admins[msg.sender],
            "Caller is not an admin"
        );
        _;
    }

    modifier onlyAdminOrGovernor() {
        require(
            msg.sender == owner() || admins[msg.sender] || governors[msg.sender],
            "Caller is not an admin or governor"
        );
        _;
    }

    modifier onlyGovernor() {
        require(governors[msg.sender], "Caller is not a governor");
        _;
    }

    constructor(
        address _usdc,
        address _appexToken,
        string memory lpName,
        string memory lpSymbol
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_appexToken != address(0), "Invalid APPEX address");
        usdc = IERC20(_usdc);
        appexToken = AppExToken(_appexToken);
        lpToken = new LPToken(lpName, lpSymbol);
        lastNAVUpdate = block.timestamp;
        lpToken.setVault(address(this));
    }

    // ==================== Admin Management Functions ====================

    /**
     * @dev Add a new admin (only owner can add admins)
     * @param admin Address to grant admin privileges
     */
    function addAdmin(address admin) external onlyOwner {
        require(admin != address(0), "Invalid admin address");
        require(!admins[admin], "Already an admin");
        require(admin != owner(), "Owner is already admin");

        admins[admin] = true;
        adminList.push(admin);

        emit AdminAdded(admin, msg.sender);
    }

    /**
     * @dev Remove an admin (only owner can remove admins)
     * @param admin Address to revoke admin privileges from
     */
    function removeAdmin(address admin) external onlyOwner {
        require(admins[admin], "Not an admin");

        admins[admin] = false;

        // Remove from adminList array
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminList[i] == admin) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }

        emit AdminRemoved(admin, msg.sender);
    }

    /**
     * @dev Check if an address is an admin (public view)
     * @param account Address to check
     * @return bool True if the address is an admin or owner
     */
    function isAdmin(address account) external view returns (bool) {
        return account == owner() || admins[account];
    }

    /**
     * @dev Get the total count of admins (excluding owner)
     * @return count Number of admins
     */
    function getAdminCount() public view returns (uint256) {
        return adminList.length;
    }

    /**
     * @dev Get list of all admins (public view)
     * @return addresses Array of all admin addresses
     * @return count Total number of admins
     */
    function getListOfAdmins()
        external
        view
        returns (address[] memory addresses, uint256 count)
    {
        count = adminList.length;
        addresses = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            addresses[i] = adminList[i];
        }
    }

    /**
     * @dev Get detailed information about all admins
     * @return addresses Array of admin addresses
     * @return adminDetails Array of detailed admin information
     * @return count Total number of admins
     */
    function getAdminsDetails()
        external
        view
        returns (
            address[] memory addresses,
            AdminDetails[] memory adminDetails,
            uint256 count
        )
    {
        count = adminList.length;
        addresses = new address[](count);
        adminDetails = new AdminDetails[](count);

        for (uint256 i = 0; i < count; i++) {
            address adm = adminList[i];
            addresses[i] = adm;
            adminDetails[i] = AdminDetails({
                adminAddress: adm,
                isActive: admins[adm]
            });
        }
    }

    // ==================== LP Functions ====================

    /**
     * @dev Deposit USDC and receive LP tokens
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        updateNAV();

        uint256 lpTokensToMint;
        uint256 currentSupply = lpToken.totalSupply();

        if (currentSupply == 0) {
            // First deposit: 1:1 ratio (both USDC and LP tokens have 6 decimals)
            lpTokensToMint = amount;
        } else {
            // Subsequent deposits: proportional to current NAV
            // Both amount and getNAV() are in 6 decimals (USDC)
            // currentSupply is in 6 decimals (LP tokens)
            lpTokensToMint = (amount * currentSupply) / getNAV();
        }

        // Update NAV tracking AFTER calculating LP tokens to mint
        totalDeposits += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        lpToken.mint(msg.sender, lpTokensToMint);

        emit Deposited(msg.sender, amount, lpTokensToMint);
    }

    /**
     * @dev Request redemption of LP tokens
     */
    function requestRedemption(uint256 lpTokenAmount) external nonReentrant {
        require(lpTokenAmount > 0, "Amount must be > 0");
        require(
            lpToken.balanceOf(msg.sender) >= lpTokenAmount,
            "Insufficient LP tokens"
        );

        updateNAV();

        redemptionQueue.push(
            RedemptionRequest({
                lp: msg.sender,
                amount: lpTokenAmount,
                timestamp: block.timestamp
            })
        );

        totalPendingRedemptions += lpTokenAmount;

        /**
         * @dev do we transfer or burn?
         */
        lpToken.transferFrom(msg.sender, address(this), lpTokenAmount);

        emit RedemptionRequested(msg.sender, lpTokenAmount);
    }

    /**
     * @dev Process redemption queue
     */
    function processRedemptions() external nonReentrant {
        updateNAV();

        uint256 nav = getNAV();
        uint256 availableUSDC = getAvailableUSDC();
        uint256 currentSupply = lpToken.totalSupply();
        uint256 dailyCap = (currentSupply * dailyRedemptionCap) / BASIS_POINTS;
        uint256 processedToday = 0;

        uint256 i = 0;
        while (i < redemptionQueue.length && processedToday < dailyCap) {
            RedemptionRequest memory request = redemptionQueue[i];
            uint256 usdcAmount = (request.amount * nav) / currentSupply;

            if (usdcAmount <= availableUSDC) {
                totalDeposits -= usdcAmount;
                totalPendingRedemptions -= request.amount;
                availableUSDC -= usdcAmount;
                processedToday += request.amount;

                redemptionQueue[i] = redemptionQueue[
                    redemptionQueue.length - 1
                ];
                redemptionQueue.pop();

                lpToken.burn(address(this), request.amount);
                usdc.safeTransfer(request.lp, usdcAmount);

                emit Redeemed(request.lp, request.amount, usdcAmount);
            } else {
                i++;
            }
        }
    }

    // ==================== Borrower Functions ====================

    /**
     * @dev Approve a borrower (admin or owner can approve)
     */
    function approveBorrower(
        address borrower,
        uint256 limit,
        uint256 lpYieldRate,
        uint256 protocolFeeRate
    ) external onlyAdmin {
        require(borrower != address(0), "Invalid borrower address");
        require(!borrowers[borrower].approved, "Already approved");

        borrowers[borrower] = Borrower({
            approved: true,
            borrowLimit: limit,
            currentDebt: 0,
            lpYieldRate: lpYieldRate,
            protocolFeeRate: protocolFeeRate,
            totalBorrowed: 0,
            totalRepaid: 0,
            totalFeesPaid: 0
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
        require(publisher != address(0), "Invalid publisher address");
        require(borrower.approved, "Not approved borrower");
        require(
            borrower.currentDebt + principal <= borrower.borrowLimit,
            "Exceeds limit"
        );
        require(principal > 0, "Principal must be > 0");
        require(appexPercentage <= 100, "Invalid percentage");

        updateNAV();

        uint256 lpFee = (principal * borrower.lpYieldRate) / BASIS_POINTS;
        uint256 protocolFee = (principal * borrower.protocolFeeRate) /
            BASIS_POINTS;

        // Calculate USDC vs APPEX split
        uint256 appexFundedAmount = (payInAppEx && appexPercentage > 0) 
            ? (principal * appexPercentage) / 100 
            : 0;
        uint256 usdcFundedAmount = principal - appexFundedAmount;

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
            protocolFeePaid: false,
            dailyAccrual: lpFee / termDays,
            usdcPrincipal: usdcFundedAmount  // Track USDC portion for repayment accounting
        });

        activeLoans.push(loanId);
        borrower.currentDebt += principal;           // Borrower owes full principal
        borrower.totalBorrowed += principal;         // Track full amount borrowed
        totalLoansOutstanding += principal;          // Full principal is "outstanding"
        totalAppexFundedLoans += appexFundedAmount;  // But this portion wasn't funded by vault USDC

        // Handle payment to publisher
        if (appexFundedAmount > 0) {
            if (usdcFundedAmount > 0) {
                usdc.safeTransfer(publisher, usdcFundedAmount);
            }
            // In production, this would buy APPEX from DEX
            // For demo, transfer APPEX from vault's holdings
            appexToken.transfer(publisher, appexFundedAmount * 10 ** 12); // Adjust for decimals
        } else {
            usdc.safeTransfer(publisher, principal);
        }

        emit LoanCreated(loanId, msg.sender, publisher, principal);

        return loanId;
    }

    /**
     * @dev Repay a loan (principal + LP fee)
     */
    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(!loan.repaid, "Already repaid");
        require(loan.borrower == msg.sender, "Not loan borrower");

        updateNAV();

        // Borrower pays back full principal + LP fee in USDC
        uint256 usdcAmount = loan.principal + loan.lpFee;

        loan.repaid = true;
        borrowers[msg.sender].currentDebt -= loan.principal;
        borrowers[msg.sender].totalRepaid += loan.principal;
        
        // Calculate APPEX-funded portion
        uint256 appexFundedPortion = loan.principal - loan.usdcPrincipal;
        
        // Update loan tracking
        totalLoansOutstanding -= loan.principal;         // Reduce by full principal
        totalAppexFundedLoans -= appexFundedPortion;     // Remove APPEX-funded tracking
        
        // LP fee goes to collected fees (LP earnings)
        totalCollectedFees += loan.lpFee;
        
        // The APPEX-funded portion was paid by borrower's APPEX, not vault USDC.
        // When repaid in USDC, this "conversion" goes to protocol, not LPs.
        if (appexFundedPortion > 0) {
            totalProtocolFees += appexFundedPortion;
        }

        // Only remove from active loans if both principal AND protocol fee are paid
        if (loan.protocolFeePaid) {
            _removeFromActiveLoans(loanId);
        }

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        emit LoanRepaid(loanId, loan.principal, loan.lpFee);
    }

    /**
     * @dev Pay protocol fee for a loan (can use APPEX for 25% discount)
     */
    function payProtocolFee(uint256 loanId, bool payInAppex) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(!loan.protocolFeePaid, "Protocol fee already paid");
        require(loan.borrower == msg.sender, "Not loan borrower");

        loan.protocolFeePaid = true;
        borrowers[msg.sender].totalFeesPaid += loan.protocolFee;

        if (payInAppex) {
            // 25% discount when paying in APPEX
            uint256 discountedFee = (loan.protocolFee * 75) / 100;
            // Scale from 6 decimals (USDC) to 18 decimals (APPEX)
            uint256 appexAmount = discountedFee * 10 ** 12;
            appexToken.transferFrom(msg.sender, address(this), appexAmount);
            distributeAppExFees(appexAmount);
            // Track discounted amount in USDC terms
            totalProtocolFees += discountedFee;
        } else {
            usdc.safeTransferFrom(msg.sender, address(this), loan.protocolFee);
            totalProtocolFees += loan.protocolFee;
        }

        // Remove from active loans if principal is also repaid
        if (loan.repaid) {
            _removeFromActiveLoans(loanId);
        }

        emit ProtocolFeePaid(loanId, loan.protocolFee, payInAppex);
    }

    /**
     * @dev Internal function to remove loan from active loans array
     */
    function _removeFromActiveLoans(uint256 loanId) internal {
        for (uint256 i = 0; i < activeLoans.length; i++) {
            if (activeLoans[i] == loanId) {
                activeLoans[i] = activeLoans[activeLoans.length - 1];
                activeLoans.pop();
                break;
            }
        }
    }

    // ==================== Staking Functions ====================

    /**
     * @dev Stake APPEX tokens
     * Note: LP tokens have 6 decimals, APPEX has 18 decimals
     * Staking cap is based on LP token holdings scaled to APPEX decimals
     */
    function stake(uint256 amount, uint256 lockDays) external nonReentrant {
        require(
            lockDays == 0 || lockDays == 90 || lockDays == 180,
            "Invalid lock period"
        );
        require(amount > 0, "Amount must be > 0");

        uint256 lpBalance = lpToken.balanceOf(msg.sender);  // 6 decimals
        // Scale LP balance (6 decimals) to APPEX scale (18 decimals) for comparison
        // maxStake = lpBalance * 10^12 * stakingMultiplier / 100
        uint256 maxStake = (lpBalance * stakingMultiplier * 10**12) / 100;

        StakingPosition storage position = stakingPositions[msg.sender];
        require(
            position.appexStaked + amount <= maxStake,
            "Exceeds staking cap"
        );

        uint256 multiplier = lockDays == 0 ? 1 : (lockDays == 90 ? 2 : 3);
        uint256 weight = amount * multiplier;

        if (position.appexStaked > 0) {
            totalStakingWeight -=
                position.appexStaked *
                getMultiplier(position.lockDuration);
        }

        position.appexStaked += amount;
        position.lockDuration = lockDays;
        position.lockEnd = block.timestamp + (lockDays * 1 days);

        totalStaked += amount;
        totalStakingWeight += weight;

        appexToken.transferFrom(msg.sender, address(this), amount);

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
     * @dev Get current NAV (Net Asset Value for LPs)
     * NAV = LP's USDC + USDC-funded loans outstanding + Pending LP Fees
     * 
     * IMPORTANT: Only counts loans funded by vault USDC, not APPEX portions.
     * Protocol fees and APPEX-converted amounts are excluded (belong to protocol).
     */
    function getNAV() public view returns (uint256) {
        uint256 usdcBalance = usdc.balanceOf(address(this));
        
        // USDC balance includes protocol fees which don't belong to LPs
        uint256 lpUsdcBalance = usdcBalance > totalProtocolFees 
            ? usdcBalance - totalProtocolFees 
            : 0;
        
        // Only count the USDC-funded portion of loans as LP assets
        // totalAppexFundedLoans represents portions funded by borrower's APPEX, not vault USDC
        uint256 usdcFundedLoans = totalLoansOutstanding > totalAppexFundedLoans
            ? totalLoansOutstanding - totalAppexFundedLoans
            : 0;
        
        // NAV = LP's liquid USDC + USDC-funded loans + Pending LP Fees
        return lpUsdcBalance + usdcFundedLoans + totalAccruedFees;
    }

    /**
     * @dev Get available USDC for redemptions/loans
     * Available = 85% of liquid NAV (NAV minus loans outstanding)
     * 
     * This represents what LPs can actually access - the portion of NAV
     * that isn't tied up in outstanding loans.
     */
    function getAvailableUSDC() public view returns (uint256) {
        uint256 nav = getNAV();
        
        // Liquid portion of NAV = NAV minus ALL outstanding loans
        // This is what's not locked in loan receivables
        uint256 liquidNAV = nav > totalLoansOutstanding 
            ? nav - totalLoansOutstanding 
            : 0;
        
        // Available = liquid NAV minus 15% buffer for redemptions
        // i.e., 85% of liquid NAV
        uint256 available = (liquidNAV * (BASIS_POINTS - liquidityBuffer)) / BASIS_POINTS;
        
        // Cap at actual LP USDC in vault (can't lend more than we have)
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 lpUsdcBalance = usdcBalance > totalProtocolFees 
            ? usdcBalance - totalProtocolFees 
            : 0;
        
        return available < lpUsdcBalance ? available : lpUsdcBalance;
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
                uint256 daysElapsed = (block.timestamp - loan.startTime) /
                    1 days;
                uint256 maxAccrual = loan.lpFee;
                uint256 calculatedAccrual = loan.dailyAccrual * daysElapsed;
                accruedFees += calculatedAccrual > maxAccrual
                    ? maxAccrual
                    : calculatedAccrual;
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
    function getVaultStats()
        external
        view
        returns (
            uint256 nav,
            uint256 sharePrice,
            uint256 totalLPs,
            uint256 availableLiquidity,
            uint256 utilizationRate,
            uint256 activeLoansCount
        )
    {
        nav = getNAV();
        sharePrice = getSharePrice();
        totalLPs = lpToken.totalSupply();
        availableLiquidity = getAvailableUSDC();
        utilizationRate = nav > 0
            ? (totalLoansOutstanding * BASIS_POINTS) / nav
            : 0;
        activeLoansCount = activeLoans.length;
    }

    /**
     * @dev Get detailed fee breakdown and accounting
     */
    function getFeeBreakdown()
        external
        view
        returns (
            uint256 pendingLPFees,         // Fees accruing on active loans (not yet collected)
            uint256 collectedLPFees,       // LP fees that have been collected (part of NAV)
            uint256 collectedProtocolFees, // Protocol fees collected (not part of NAV)
            uint256 totalLPFees,           // Total LP fees (pending + collected)
            uint256 vaultUSDCBalance       // Actual USDC in vault
        )
    {
        pendingLPFees = totalAccruedFees;
        collectedLPFees = totalCollectedFees;
        collectedProtocolFees = totalProtocolFees;
        totalLPFees = totalAccruedFees + totalCollectedFees;
        vaultUSDCBalance = usdc.balanceOf(address(this));
    }

    /**
     * @dev Get complete vault accounting breakdown
     * Useful for verifying all numbers add up correctly
     */
    function getAccountingBreakdown()
        external
        view
        returns (
            uint256 usdcBalance,           // Actual USDC in vault
            uint256 lpUsdcShare,           // USDC belonging to LPs (balance - protocol fees)
            uint256 protocolUsdcShare,     // USDC belonging to protocol (withdrawable)
            uint256 loansOutstanding,      // Total principal owed by borrowers
            uint256 appexFundedLoans,      // Portion funded by APPEX (not vault USDC)
            uint256 usdcFundedLoans,       // Portion funded by vault USDC (loansOutstanding - appexFunded)
            uint256 pendingFees,           // LP fees accruing on active loans
            uint256 nav,                   // Total NAV (LP value)
            uint256 availableLiquidity     // What can be used for new loans/redemptions
        )
    {
        usdcBalance = usdc.balanceOf(address(this));
        protocolUsdcShare = totalProtocolFees;
        lpUsdcShare = usdcBalance > protocolUsdcShare ? usdcBalance - protocolUsdcShare : 0;
        loansOutstanding = totalLoansOutstanding;
        appexFundedLoans = totalAppexFundedLoans;
        usdcFundedLoans = loansOutstanding > appexFundedLoans ? loansOutstanding - appexFundedLoans : 0;
        pendingFees = totalAccruedFees;
        nav = getNAV();
        availableLiquidity = getAvailableUSDC();
    }

    /**
     * @dev Withdraw protocol fees (admin only)
     * Protocol fees belong to the protocol, not LPs
     */
    function withdrawProtocolFees(address recipient, uint256 amount) external onlyAdmin {
        require(amount <= totalProtocolFees, "Exceeds protocol fees");
        require(recipient != address(0), "Invalid recipient");
        
        totalProtocolFees -= amount;
        usdc.safeTransfer(recipient, amount);
        
        emit ProtocolFeesWithdrawn(recipient, amount);
    }

    /**
     * @dev Get borrower info
     */
    function getBorrowerInfo(
        address borrower
    )
        external
        view
        returns (
            bool approved,
            uint256 limit,
            uint256 currentDebt,
            uint256 available,
            uint256 lpYieldRate,
            uint256 protocolFeeRate
        )
    {
        Borrower memory b = borrowers[borrower];
        approved = b.approved;
        limit = b.borrowLimit;
        currentDebt = b.currentDebt;
        available = b.borrowLimit > b.currentDebt
            ? b.borrowLimit - b.currentDebt
            : 0;
        lpYieldRate = b.lpYieldRate;
        protocolFeeRate = b.protocolFeeRate;
    }

    /**
     * @dev Get staking info
     */
    function getStakingInfo(
        address account
    )
        external
        view
        returns (
            uint256 staked,
            uint256 maxStake,
            uint256 lockEnd,
            uint256 multiplier,
            uint256 pendingRewards
        )
    {
        StakingPosition memory position = stakingPositions[account];
        uint256 lpBalance = lpToken.balanceOf(account);

        staked = position.appexStaked;
        // Scale LP balance (6 decimals) to APPEX scale (18 decimals)
        maxStake = (lpBalance * stakingMultiplier * 10**12) / 100;
        lockEnd = position.lockEnd;
        multiplier = getMultiplier(position.lockDuration);
        pendingRewards = position.pendingRewards;
    }

    /**
     * @dev Get comprehensive list of all loans with their details
     * @param startIndex Starting index for pagination
     * @param count Number of loans to return (0 = return all from startIndex)
     * @return loanIds Array of loan IDs
     * @return loanDetails Array of loan information
     * @return totalLoans Total number of loans in the system
     */
    function getListOfLoans(
        uint256 startIndex,
        uint256 count
    )
        external
        view
        returns (
            uint256[] memory loanIds,
            LoanDetails[] memory loanDetails,
            uint256 totalLoans
        )
    {
        totalLoans = nextLoanId - 1; // Since nextLoanId starts at 1

        if (startIndex >= totalLoans) {
            return (new uint256[](0), new LoanDetails[](0), totalLoans);
        }

        uint256 endIndex = count == 0
            ? totalLoans
            : (
                startIndex + count > totalLoans
                    ? totalLoans
                    : startIndex + count
            );
        uint256 resultCount = endIndex - startIndex;

        loanIds = new uint256[](resultCount);
        loanDetails = new LoanDetails[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            uint256 loanId = startIndex + i + 1; // Loan IDs start at 1
            Loan memory loan = loans[loanId];

            loanIds[i] = loanId;
            loanDetails[i] = LoanDetails({
                loanId: loanId,
                borrower: loan.borrower,
                publisher: loan.publisher,
                principal: loan.principal,
                usdcPrincipal: loan.usdcPrincipal,
                lpFee: loan.lpFee,
                protocolFee: loan.protocolFee,
                totalDue: loan.principal + loan.lpFee + loan.protocolFee,
                startTime: loan.startTime,
                termDays: loan.termDays,
                endTime: loan.startTime + (loan.termDays * 1 days),
                repaid: loan.repaid,
                protocolFeePaid: loan.protocolFeePaid,
                daysElapsed: (block.timestamp - loan.startTime) / 1 days,
                isOverdue: block.timestamp >
                    loan.startTime + (loan.termDays * 1 days) &&
                    !loan.repaid,
                accruedFees: _calculateAccruedFees(loan)
            });
        }
    }

    /**
     * @dev Get only active (unpaid) loans
     * @return loanIds Array of active loan IDs
     * @return loanDetails Array of loan information for active loans
     * @return count Number of active loans
     */
    function getActiveLoans()
        external
        view
        returns (
            uint256[] memory loanIds,
            LoanDetails[] memory loanDetails,
            uint256 count
        )
    {
        count = activeLoans.length;
        loanIds = new uint256[](count);
        loanDetails = new LoanDetails[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 loanId = activeLoans[i];
            Loan memory loan = loans[loanId];

            loanIds[i] = loanId;
            loanDetails[i] = LoanDetails({
                loanId: loanId,
                borrower: loan.borrower,
                publisher: loan.publisher,
                principal: loan.principal,
                usdcPrincipal: loan.usdcPrincipal,
                lpFee: loan.lpFee,
                protocolFee: loan.protocolFee,
                totalDue: loan.principal + loan.lpFee + loan.protocolFee,
                startTime: loan.startTime,
                termDays: loan.termDays,
                endTime: loan.startTime + (loan.termDays * 1 days),
                repaid: loan.repaid,
                protocolFeePaid: loan.protocolFeePaid,
                daysElapsed: (block.timestamp - loan.startTime) / 1 days,
                isOverdue: block.timestamp >
                    loan.startTime + (loan.termDays * 1 days),
                accruedFees: _calculateAccruedFees(loan)
            });
        }
    }

    /**
     * @dev Get loans for a specific borrower
     * @param borrowerAddr The borrower's address
     * @return loanIds Array of loan IDs for this borrower
     * @return loanDetails Array of loan information
     * @return count Number of loans found
     */
    function getLoansByBorrower(
        address borrowerAddr
    )
        external
        view
        returns (
            uint256[] memory loanIds,
            LoanDetails[] memory loanDetails,
            uint256 count
        )
    {
        // First, count loans for this borrower
        uint256 totalLoans = nextLoanId - 1;
        uint256 borrowerLoanCount = 0;

        for (uint256 i = 1; i <= totalLoans; i++) {
            if (loans[i].borrower == borrowerAddr) {
                borrowerLoanCount++;
            }
        }

        loanIds = new uint256[](borrowerLoanCount);
        loanDetails = new LoanDetails[](borrowerLoanCount);
        count = borrowerLoanCount;

        uint256 resultIndex = 0;
        for (uint256 i = 1; i <= totalLoans && resultIndex < borrowerLoanCount; i++) {
            Loan memory loan = loans[i];
            if (loan.borrower == borrowerAddr) {
                loanIds[resultIndex] = i;
                loanDetails[resultIndex] = LoanDetails({
                    loanId: i,
                    borrower: loan.borrower,
                    publisher: loan.publisher,
                    principal: loan.principal,
                    usdcPrincipal: loan.usdcPrincipal,
                    lpFee: loan.lpFee,
                    protocolFee: loan.protocolFee,
                    totalDue: loan.principal + loan.lpFee + loan.protocolFee,
                    startTime: loan.startTime,
                    termDays: loan.termDays,
                    endTime: loan.startTime + (loan.termDays * 1 days),
                    repaid: loan.repaid,
                    protocolFeePaid: loan.protocolFeePaid,
                    daysElapsed: (block.timestamp - loan.startTime) / 1 days,
                    isOverdue: block.timestamp >
                        loan.startTime + (loan.termDays * 1 days) &&
                        !loan.repaid,
                    accruedFees: _calculateAccruedFees(loan)
                });
                resultIndex++;
            }
        }
    }

    /**
     * @dev Get comprehensive list of all borrowers with their details
     * @return addresses Array of borrower addresses
     * @return borrowerDetails Array of detailed borrower information
     * @return count Total number of borrowers
     */
    function getListOfBorrowers()
        external
        view
        returns (
            address[] memory addresses,
            BorrowerDetails[] memory borrowerDetails,
            uint256 count
        )
    {
        count = borrowerList.length;
        addresses = new address[](count);
        borrowerDetails = new BorrowerDetails[](count);

        for (uint256 i = 0; i < count; i++) {
            address borrowerAddr = borrowerList[i];
            Borrower memory b = borrowers[borrowerAddr];

            uint256 availableCredit = b.borrowLimit > b.currentDebt
                ? b.borrowLimit - b.currentDebt
                : 0;
            uint256 utilizationRate = b.borrowLimit > 0
                ? (b.currentDebt * BASIS_POINTS) / b.borrowLimit
                : 0;

            addresses[i] = borrowerAddr;
            borrowerDetails[i] = BorrowerDetails({
                borrowerAddress: borrowerAddr,
                approved: b.approved,
                borrowLimit: b.borrowLimit,
                currentDebt: b.currentDebt,
                availableCredit: availableCredit,
                utilizationRate: utilizationRate,
                lpYieldRate: b.lpYieldRate,
                protocolFeeRate: b.protocolFeeRate,
                totalFeeRate: b.lpYieldRate + b.protocolFeeRate,
                activeLoanCount: _countActiveLoansByBorrower(borrowerAddr),
                totalBorrowed: b.totalBorrowed,
                totalRepaid: b.totalRepaid,
                totalFeesPaid: b.totalFeesPaid
            });
        }
    }

    /**
     * @dev Helper function to calculate accrued fees for a loan
     */
    function _calculateAccruedFees(
        Loan memory loan
    ) internal view returns (uint256) {
        if (loan.repaid) {
            return loan.lpFee; // Fully accrued if repaid
        }

        uint256 daysElapsed = (block.timestamp - loan.startTime) / 1 days;
        uint256 calculatedAccrual = loan.dailyAccrual * daysElapsed;

        return calculatedAccrual > loan.lpFee ? loan.lpFee : calculatedAccrual;
    }

    /**
     * @dev Helper function to count active loans for a specific borrower
     * @param borrowerAddr The borrower address
     * @return count Number of active (unpaid) loans
     */
    function _countActiveLoansByBorrower(
        address borrowerAddr
    ) internal view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < activeLoans.length; i++) {
            if (loans[activeLoans[i]].borrower == borrowerAddr) {
                count++;
            }
        }
        return count;
    }

    function proposeBorrower(
        address borrower,
        uint256 limit,
        uint256 lpYieldRate,
        uint256 protocolFeeRate
    ) external onlyGovernor returns (bytes32) {
        require(borrower != address(0), "Invalid borrower address");
        require(limit > 0, "Limit must be greater than 0");
        require(!borrowers[borrower].approved, "Borrower already approved");

        // Use a counter-based approach for unique, non-predictable IDs
        bytes32 proposalId = keccak256(
            abi.encode(
                borrower,
                msg.sender,
                nextProposalId++,
                block.timestamp,
                block.number
            )
        );

        require(
            borrowerProposals[proposalId].borrower == address(0),
            "Proposal ID collision"
        );
        BorrowerProposal storage proposal = borrowerProposals[proposalId];

        proposal.borrower = borrower;
        proposal.limit = limit;
        proposal.lpYieldRate = lpYieldRate;
        proposal.protocolFeeRate = protocolFeeRate;
        proposal.proposedAt = block.timestamp;
        proposal.approvals = 1;
        proposal.hasApproved[msg.sender] = true;

        governorProposals[msg.sender].push(proposalId);
        governorApprovalCount[msg.sender]++; // Count initial approval

        emit BorrowerProposed(proposalId, borrower, limit);

        return proposalId;
    }

    function approveBorrowerProposal(bytes32 proposalId) external onlyGovernor {
        BorrowerProposal storage proposal = borrowerProposals[proposalId];
        require(!proposal.hasApproved[msg.sender], "Already approved");

        proposal.hasApproved[msg.sender] = true;
        proposal.approvals++;

        governorApprovalCount[msg.sender]++;

        emit BorrowerProposalApproved(
            proposalId,
            msg.sender,
            proposal.approvals
        );

        if (proposal.approvals >= GOVERNOR_THRESHOLD) {
            // Execute after timelock
            timelock.schedule(
                address(this),
                0,
                abi.encodeWithSelector(
                    this.approveBorrower.selector,
                    proposal.borrower,
                    proposal.limit,
                    proposal.lpYieldRate,
                    proposal.protocolFeeRate
                ),
                bytes32(0),
                bytes32(proposalId),
                2 days // timelock delay
            );
        }
    }

    /**
     * @dev Add a new governor (only existing governors can add new governors)
     * @param governor Address to grant governor privileges
     */
    function addGovernor(address governor) external onlyGovernor {
        require(governor != address(0), "Invalid governor address");
        require(!governors[governor], "Already a governor");

        governors[governor] = true;
        governorList.push(governor);

        emit GovernorAdded(governor, msg.sender);
    }

    /**
     * @dev Remove a governor (only existing governors can remove governors)
     * @param governor Address to revoke governor privileges from
     */
    function removeGovernor(address governor) external onlyGovernor {
        require(governors[governor], "Not a governor");
        require(governor != msg.sender, "Cannot remove yourself");

        // Get current count before removal
        uint256 currentCount = getGovernorCount();
        require(currentCount > 1, "Cannot remove last governor");

        governors[governor] = false;

        // Remove from governorList array
        for (uint256 i = 0; i < governorList.length; i++) {
            if (governorList[i] == governor) {
                governorList[i] = governorList[governorList.length - 1];
                governorList.pop();
                break;
            }
        }

        emit GovernorRemoved(governor, msg.sender);
    }

    /**
     * @dev Get list of all governors (public view)
     * @return addresses Array of all governor addresses
     * @return count Total number of governors
     */
    function getListOfGovernors()
        external
        view
        returns (address[] memory addresses, uint256 count)
    {
        count = governorList.length;
        addresses = new address[](count);

        for (uint256 i = 0; i < count; i++) {
            addresses[i] = governorList[i];
        }
    }

    /**
     * @dev Get detailed information about all governors
     * @return addresses Array of governor addresses
     * @return governorDetails Array of detailed governor information
     * @return count Total number of governors
     */
    function getGovernorsDetails()
        external
        view
        returns (
            address[] memory addresses,
            GovernorDetails[] memory governorDetails,
            uint256 count
        )
    {
        count = governorList.length;
        addresses = new address[](count);
        governorDetails = new GovernorDetails[](count);

        for (uint256 i = 0; i < count; i++) {
            address gov = governorList[i];
            addresses[i] = gov;
            governorDetails[i] = GovernorDetails({
                governorAddress: gov,
                isActive: governors[gov],
                proposalCount: _countProposalsByGovernor(gov),
                approvalCount: _countApprovalsByGovernor(gov)
            });
        }
    }

    /**
     * @dev Check if an address is a governor (public view)
     * @param account Address to check
     * @return bool True if the address is a governor
     */
    function isGovernor(address account) external view returns (bool) {
        return governors[account];
    }

    /**
     * @dev Get the total count of active governors
     * @return count Number of active governors
     */
    function getGovernorCount() public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < governorList.length; i++) {
            if (governors[governorList[i]]) {
                count++;
            }
        }
        return count;
    }

    /**
     * @dev Set the timelock controller (only owner - one-time setup)
     * @param _timelock Address of the TimelockController contract
     */
    function setTimelock(address _timelock) external onlyOwner {
        require(_timelock != address(0), "Invalid timelock address");
        require(address(timelock) == address(0), "Timelock already set");

        timelock = TimelockController(payable(_timelock));

        emit TimelockSet(_timelock);
    }

    /**
     * @dev Initialize the first governor (only owner, only callable once during setup)
     * @param initialGovernor Address of the first governor
     */
    function initializeGovernor(address initialGovernor) external onlyOwner {
        require(governorList.length == 0, "Governors already initialized");
        require(initialGovernor != address(0), "Invalid governor address");

        governors[initialGovernor] = true;
        governorList.push(initialGovernor);

        emit GovernorAdded(initialGovernor, msg.sender);
    }

    function _countProposalsByGovernor(
        address governor
    ) internal view returns (uint256) {
        return governorProposals[governor].length;
    }

    function _countApprovalsByGovernor(
        address governor
    ) internal view returns (uint256) {
        return governorApprovalCount[governor];
    }
}
