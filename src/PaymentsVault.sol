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
        uint256 lpFee;
        uint256 protocolFee;
        uint256 totalDue;
        uint256 startTime;
        uint256 termDays;
        uint256 endTime;
        bool repaid;
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
    }

    struct GovernorDetails {
        address governorAddress;
        bool isActive;
        uint256 proposalCount;
        uint256 approvalCount;
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
    event Staked(address indexed lp, uint256 amount, uint256 duration);
    event Unstaked(address indexed lp, uint256 amount);
    event RewardsDistributed(uint256 amount);
    event Deposited(address indexed lp, uint256 amount, uint256 lpTokens);
    event GovernorAdded(address indexed governor, address indexed addedBy);
    event GovernorRemoved(address indexed governor, address indexed removedBy);
    event TimelockSet(address indexed timelock);
    event BorrowerProposed(bytes32 proposalId, address borrower, uint256 limit);
    event BorrowerProposalApproved(
        bytes32 proposalId,
        address approver,
        uint256 approvals
    );

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

    // ==================== LP Functions ====================

    /**
     * @dev Deposit USDC and receive LP tokens
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        updateNAV();

        totalDeposits += amount;

        uint256 lpTokensToMint;
        uint256 currentSupply = lpToken.totalSupply();

        if (currentSupply == 0) {
            lpTokensToMint = amount * 10 ** 12;
        } else {
            lpTokensToMint = (amount * currentSupply) / getNAV();
        }

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
     * @dev Approve a borrower
     */
    function approveBorrower(
        address borrower,
        uint256 limit,
        uint256 lpYieldRate,
        uint256 protocolFeeRate
    ) external onlyOwner {
        require(borrower != address(0), "Invalid borrower address");
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
                appexToken.transfer(publisher, appexAmount * 10 ** 12); // Adjust for decimals
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
    function repayLoan(
        uint256 loanId,
        bool payFeeInAppEx
    ) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(!loan.repaid, "Already repaid");
        require(loan.borrower == msg.sender, "Not loan borrower");

        updateNAV();

        uint256 totalDue = loan.principal + loan.lpFee + loan.protocolFee;
        uint256 usdcAmount = loan.principal + loan.lpFee;
        uint256 appexFeeAmount = 0;

        if (payFeeInAppEx) {
            uint256 discountedFee = (loan.protocolFee * 75) / 100;
            appexFeeAmount = discountedFee * 10 ** 12;
        } else {
            usdcAmount = totalDue;
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

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        if (payFeeInAppEx) {
            appexToken.transferFrom(msg.sender, address(this), appexFeeAmount);
            distributeAppExFees(appexFeeAmount);
        }

        emit LoanRepaid(loanId, loan.principal, loan.lpFee + loan.protocolFee);
    }

    // ==================== Staking Functions ====================

    /**
     * @dev Stake APPEX tokens
     */
    function stake(uint256 amount, uint256 lockDays) external nonReentrant {
        require(
            lockDays == 0 || lockDays == 90 || lockDays == 180,
            "Invalid lock period"
        );
        require(amount > 0, "Amount must be > 0");

        uint256 lpBalance = lpToken.balanceOf(msg.sender);
        uint256 maxStake = (lpBalance * stakingMultiplier) / 100;

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
        maxStake = (lpBalance * stakingMultiplier) / 100;
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
        totalLoans = nextLoanId - 1; // Total loans created (IDs start at 1)

        // Determine how many loans to return
        uint256 endIndex;
        if (count == 0 || startIndex + count > totalLoans) {
            endIndex = totalLoans;
        } else {
            endIndex = startIndex + count;
        }

        // Ensure startIndex is valid
        require(
            startIndex > 0 && startIndex <= totalLoans,
            "Invalid start index"
        );

        uint256 resultCount = endIndex - startIndex + 1;
        loanIds = new uint256[](resultCount);
        loanDetails = new LoanDetails[](resultCount);

        uint256 resultIndex = 0;
        for (uint256 i = startIndex; i <= endIndex; i++) {
            Loan memory loan = loans[i];

            loanIds[resultIndex] = i;
            loanDetails[resultIndex] = LoanDetails({
                loanId: i,
                borrower: loan.borrower,
                publisher: loan.publisher,
                principal: loan.principal,
                lpFee: loan.lpFee,
                protocolFee: loan.protocolFee,
                totalDue: loan.principal + loan.lpFee + loan.protocolFee,
                startTime: loan.startTime,
                termDays: loan.termDays,
                endTime: loan.startTime + (loan.termDays * 1 days),
                repaid: loan.repaid,
                daysElapsed: loan.repaid
                    ? 0
                    : (block.timestamp - loan.startTime) / 1 days,
                isOverdue: !loan.repaid &&
                    block.timestamp >
                    (loan.startTime + (loan.termDays * 1 days)),
                accruedFees: _calculateAccruedFees(loan)
            });

            resultIndex++;
        }
    }

    /**
     * @dev Get comprehensive list of all approved borrowers (admin only)
     * @return borrowerAddresses Array of borrower addresses
     * @return borrowerDetails Array of borrower information
     * @return totalBorrowers Total number of borrowers
     */
    function getListOfBorrowers()
        external
        view
        onlyOwner
        returns (
            address[] memory borrowerAddresses,
            BorrowerDetails[] memory borrowerDetails,
            uint256 totalBorrowers
        )
    {
        totalBorrowers = borrowerList.length;
        borrowerAddresses = new address[](totalBorrowers);
        borrowerDetails = new BorrowerDetails[](totalBorrowers);

        for (uint256 i = 0; i < totalBorrowers; i++) {
            address borrowerAddr = borrowerList[i];
            Borrower memory borrower = borrowers[borrowerAddr];

            borrowerAddresses[i] = borrowerAddr;
            borrowerDetails[i] = BorrowerDetails({
                borrowerAddress: borrowerAddr,
                approved: borrower.approved,
                borrowLimit: borrower.borrowLimit,
                currentDebt: borrower.currentDebt,
                availableCredit: borrower.borrowLimit > borrower.currentDebt
                    ? borrower.borrowLimit - borrower.currentDebt
                    : 0,
                utilizationRate: borrower.borrowLimit > 0
                    ? (borrower.currentDebt * BASIS_POINTS) /
                        borrower.borrowLimit
                    : 0,
                lpYieldRate: borrower.lpYieldRate,
                protocolFeeRate: borrower.protocolFeeRate,
                totalFeeRate: borrower.lpYieldRate + borrower.protocolFeeRate,
                activeLoanCount: _countActiveLoansByBorrower(borrowerAddr)
            });
        }
    }

    /**
     * @dev Helper function to calculate accrued fees for a loan
     * @param loan The loan to calculate fees for
     * @return accruedFees The amount of fees accrued so far
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
