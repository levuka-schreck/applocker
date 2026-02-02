// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

interface ILPToken is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/**
 * @title PaymentsVault
 * @dev Core vault functionality - deposits, loans, staking, governance
 * View functions are in VaultLens.sol to reduce contract size
 */
contract PaymentsVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Tokens
    IERC20 public immutable usdc;
    IERC20 public immutable appexToken;
    ILPToken public immutable lpToken;

    // Vault state
    uint256 public totalDeposits;
    uint256 public totalLoansOutstanding;
    uint256 public totalAppexFundedLoans;
    uint256 public totalAccruedFees;
    uint256 public totalCollectedFees;
    uint256 public totalProtocolFees;
    uint256 public lastNAVUpdate;

    // Parameters
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public liquidityBuffer = 1500;
    uint256 public dailyRedemptionCap = 500;
    uint256 public stakingMultiplier = 100;

    // Borrowers
    struct Borrower {
        bool approved;
        uint256 borrowLimit;
        uint256 currentDebt;
        uint256 lpYieldRate;
        uint256 protocolFeeRate;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 totalFeesPaid;
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
        bool protocolFeePaid;
        uint256 dailyAccrual;
        uint256 usdcPrincipal;
    }
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId = 1;
    uint256[] public activeLoans;

    // Staking
    struct StakingPosition {
        uint256 appexStaked;
        uint256 lockDuration;
        uint256 lockEnd;
        uint256 pendingRewards;
    }
    mapping(address => StakingPosition) public stakingPositions;
    uint256 public totalStaked;
    uint256 public totalStakingWeight;

    // Redemption queue
    struct RedemptionRequest {
        address user;
        uint256 lpTokens;
        uint256 requestTime;
    }
    RedemptionRequest[] public redemptionQueue;

    // Governance
    mapping(address => bool) public admins;
    address[] public adminList;
    mapping(address => bool) public governors;
    address[] public governorList;
    uint256 public constant GOVERNOR_THRESHOLD = 2;
    mapping(address => uint256) public governorApprovalCount;

    // Borrower Proposals
    struct BorrowerProposal {
        address borrower;
        uint256 limit;
        uint256 lpYieldRate;
        uint256 protocolFeeRate;
        uint256 approvals;
        mapping(address => bool) hasApproved;
        uint256 proposedAt;
        uint256 scheduledAt;
        bool executed;
    }
    mapping(bytes32 => BorrowerProposal) public borrowerProposals;
    TimelockController public timelock;

    // Events
    event Deposit(address indexed user, uint256 amount, uint256 lpTokens);
    event RedemptionRequested(address indexed user, uint256 lpTokens);
    event RedemptionProcessed(address indexed user, uint256 lpTokens, uint256 usdcAmount);
    event LoanCreated(uint256 indexed loanId, address indexed borrower, address indexed publisher, uint256 principal);
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 lpFee);
    event ProtocolFeePaid(uint256 indexed loanId, uint256 feeAmount, bool paidInAppex);
    event ProtocolFeesWithdrawn(address indexed recipient, uint256 amount);
    event Staked(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstaked(address indexed user, uint256 amount);
    event BorrowerApproved(address indexed borrower, uint256 limit);
    event GovernorAdded(address indexed governor, address indexed addedBy);
    event GovernorRemoved(address indexed governor, address indexed removedBy);
    event AdminAdded(address indexed admin, address indexed addedBy);
    event AdminRemoved(address indexed admin, address indexed removedBy);
    event TimelockSet(address indexed timelock);
    event BorrowerProposed(bytes32 proposalId, address borrower, uint256 limit);
    event BorrowerProposalApproved(bytes32 proposalId, address approver, uint256 approvals);
    event BorrowerProposalScheduled(bytes32 proposalId, address borrower, uint256 executeAfter);
    event BorrowerProposalExecuted(bytes32 proposalId, address borrower);

    modifier onlyAdmin() {
        require(msg.sender == owner() || admins[msg.sender], "Not admin");
        _;
    }

    modifier onlyGovernor() {
        require(governors[msg.sender], "Not governor");
        _;
    }

    constructor(address _usdc, address _appexToken, address _lpToken) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        appexToken = IERC20(_appexToken);
        lpToken = ILPToken(_lpToken);
    }

    // ==================== LP Functions ====================

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        updateNAV();

        uint256 lpTokensToMint;
        uint256 totalSupply = lpToken.totalSupply();
        uint256 nav = getNAV();

        if (totalSupply == 0 || nav == 0) {
            lpTokensToMint = amount;
        } else {
            lpTokensToMint = (amount * totalSupply) / nav;
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposits += amount;
        lpToken.mint(msg.sender, lpTokensToMint);

        emit Deposit(msg.sender, amount, lpTokensToMint);
    }

    function requestRedemption(uint256 lpTokenAmount) external nonReentrant {
        require(lpTokenAmount > 0, "Amount must be > 0");
        require(lpToken.balanceOf(msg.sender) >= lpTokenAmount, "Insufficient LP tokens");

        lpToken.burn(msg.sender, lpTokenAmount);
        redemptionQueue.push(RedemptionRequest({
            user: msg.sender,
            lpTokens: lpTokenAmount,
            requestTime: block.timestamp
        }));

        emit RedemptionRequested(msg.sender, lpTokenAmount);
    }

    function processRedemptions() external nonReentrant {
        updateNAV();
        uint256 availableUSDC = getAvailableUSDC();
        uint256 nav = getNAV();
        uint256 totalSupply = lpToken.totalSupply();

        uint256 i = 0;
        while (i < redemptionQueue.length && availableUSDC > 0) {
            RedemptionRequest memory request = redemptionQueue[i];
            
            uint256 usdcAmount;
            if (totalSupply > 0) {
                usdcAmount = (request.lpTokens * nav) / (totalSupply + request.lpTokens);
            } else {
                usdcAmount = request.lpTokens;
            }

            if (usdcAmount <= availableUSDC) {
                usdc.safeTransfer(request.user, usdcAmount);
                totalDeposits = totalDeposits > usdcAmount ? totalDeposits - usdcAmount : 0;
                availableUSDC -= usdcAmount;
                
                emit RedemptionProcessed(request.user, request.lpTokens, usdcAmount);
                
                redemptionQueue[i] = redemptionQueue[redemptionQueue.length - 1];
                redemptionQueue.pop();
            } else {
                i++;
            }
        }
    }

    // ==================== Loan Functions ====================

    function createLoan(
        address publisher,
        uint256 principal,
        uint256 termDays,
        bool payInAppEx,
        uint256 appexPercentage
    ) external nonReentrant returns (uint256) {
        Borrower storage borrower = borrowers[msg.sender];
        require(borrower.approved, "Not approved");
        require(borrower.currentDebt + principal <= borrower.borrowLimit, "Exceeds limit");
        require(principal > 0, "Principal must be > 0");
        require(appexPercentage <= 100, "Invalid percentage");

        updateNAV();

        uint256 lpFee = (principal * borrower.lpYieldRate) / BASIS_POINTS;
        uint256 protocolFee = (principal * borrower.protocolFeeRate) / BASIS_POINTS;

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
            usdcPrincipal: usdcFundedAmount
        });

        activeLoans.push(loanId);
        borrower.currentDebt += principal;
        borrower.totalBorrowed += principal;
        totalLoansOutstanding += principal;
        totalAppexFundedLoans += appexFundedAmount;

        if (appexFundedAmount > 0) {
            if (usdcFundedAmount > 0) {
                usdc.safeTransfer(publisher, usdcFundedAmount);
            }
            appexToken.transfer(publisher, appexFundedAmount * 10 ** 12);
        } else {
            usdc.safeTransfer(publisher, principal);
        }

        emit LoanCreated(loanId, msg.sender, publisher, principal);
        return loanId;
    }

    function repayLoan(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(!loan.repaid, "Already repaid");
        require(loan.borrower == msg.sender, "Not loan borrower");

        updateNAV();

        uint256 usdcAmount = loan.principal + loan.lpFee;
        uint256 appexFundedPortion = loan.principal - loan.usdcPrincipal;

        loan.repaid = true;
        borrowers[msg.sender].currentDebt -= loan.principal;
        borrowers[msg.sender].totalRepaid += loan.principal;
        
        totalLoansOutstanding -= loan.principal;
        totalAppexFundedLoans -= appexFundedPortion;
        totalCollectedFees += loan.lpFee;
        
        if (appexFundedPortion > 0) {
            totalProtocolFees += appexFundedPortion;
        }

        if (loan.protocolFeePaid) {
            _removeFromActiveLoans(loanId);
        }

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        emit LoanRepaid(loanId, loan.principal, loan.lpFee);
    }

    function payProtocolFee(uint256 loanId, bool payInAppex) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(!loan.protocolFeePaid, "Already paid");
        require(loan.borrower == msg.sender, "Not loan borrower");

        loan.protocolFeePaid = true;
        borrowers[msg.sender].totalFeesPaid += loan.protocolFee;

        if (payInAppex) {
            uint256 discountedAmount = (loan.protocolFee * 75) / 100;
            uint256 appexAmount = discountedAmount * 10 ** 12;
            appexToken.transferFrom(msg.sender, address(this), appexAmount);
            totalProtocolFees += discountedAmount;
        } else {
            usdc.safeTransferFrom(msg.sender, address(this), loan.protocolFee);
            totalProtocolFees += loan.protocolFee;
        }

        if (loan.repaid) {
            _removeFromActiveLoans(loanId);
        }

        emit ProtocolFeePaid(loanId, loan.protocolFee, payInAppex);
    }

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

    function stake(uint256 amount, uint256 lockDays) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(lockDays == 0 || lockDays == 90 || lockDays == 180, "Invalid lock");

        StakingPosition storage position = stakingPositions[msg.sender];
        
        if (position.appexStaked > 0) {
            uint256 oldWeight = position.appexStaked * _getMultiplier(position.lockDuration);
            totalStakingWeight -= oldWeight;
        }

        appexToken.transferFrom(msg.sender, address(this), amount);
        
        position.appexStaked += amount;
        position.lockDuration = lockDays;
        position.lockEnd = lockDays > 0 ? block.timestamp + (lockDays * 1 days) : 0;
        
        totalStaked += amount;
        totalStakingWeight += amount * _getMultiplier(lockDays);

        emit Staked(msg.sender, amount, lockDays);
    }

    function unstake(uint256 amount) external nonReentrant {
        StakingPosition storage position = stakingPositions[msg.sender];
        require(position.appexStaked >= amount, "Insufficient stake");
        require(block.timestamp >= position.lockEnd, "Still locked");

        uint256 oldWeight = position.appexStaked * _getMultiplier(position.lockDuration);
        totalStakingWeight -= oldWeight;
        
        position.appexStaked -= amount;
        totalStaked -= amount;
        
        uint256 newWeight = position.appexStaked * _getMultiplier(position.lockDuration);
        totalStakingWeight += newWeight;

        appexToken.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function _getMultiplier(uint256 lockDays) internal pure returns (uint256) {
        if (lockDays >= 180) return 200;
        if (lockDays >= 90) return 150;
        return 100;
    }

    // ==================== View Functions ====================

    function getNAV() public view returns (uint256) {
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 lpUsdcBalance = usdcBalance > totalProtocolFees ? usdcBalance - totalProtocolFees : 0;
        uint256 usdcFundedLoans = totalLoansOutstanding > totalAppexFundedLoans
            ? totalLoansOutstanding - totalAppexFundedLoans : 0;
        return lpUsdcBalance + usdcFundedLoans + totalAccruedFees;
    }

    function getAvailableUSDC() public view returns (uint256) {
        uint256 nav = getNAV();
        uint256 liquidNAV = nav > totalLoansOutstanding ? nav - totalLoansOutstanding : 0;
        uint256 available = (liquidNAV * (BASIS_POINTS - liquidityBuffer)) / BASIS_POINTS;
        
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 lpUsdcBalance = usdcBalance > totalProtocolFees ? usdcBalance - totalProtocolFees : 0;
        
        return available < lpUsdcBalance ? available : lpUsdcBalance;
    }

    function getSharePrice() public view returns (uint256) {
        uint256 totalSupply = lpToken.totalSupply();
        if (totalSupply == 0) return 1e6;
        return (getNAV() * 1e6) / totalSupply;
    }

    function updateNAV() public {
        uint256 accruedFees = 0;
        for (uint256 i = 0; i < activeLoans.length; i++) {
            Loan storage loan = loans[activeLoans[i]];
            if (!loan.repaid) {
                uint256 daysElapsed = (block.timestamp - loan.startTime) / 1 days;
                uint256 accrued = loan.dailyAccrual * daysElapsed;
                if (accrued > loan.lpFee) accrued = loan.lpFee;
                accruedFees += accrued;
            }
        }
        totalAccruedFees = accruedFees;
        lastNAVUpdate = block.timestamp;
    }

    function getActiveLoansCount() external view returns (uint256) {
        return activeLoans.length;
    }

    function getActiveLoanId(uint256 index) external view returns (uint256) {
        require(index < activeLoans.length, "Index out of bounds");
        return activeLoans[index];
    }

    function getBorrowerCount() external view returns (uint256) {
        return borrowerList.length;
    }

    function getGovernorCount() external view returns (uint256) {
        return governorList.length;
    }

    function getAdminCount() external view returns (uint256) {
        return adminList.length + 1;
    }

    function isGovernor(address account) external view returns (bool) {
        return governors[account];
    }

    function isAdmin(address account) external view returns (bool) {
        return account == owner() || admins[account];
    }

    function getListOfGovernors() external view returns (
        address[] memory addresses,
        uint256 count
    ) {
        count = governorList.length;
        addresses = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            addresses[i] = governorList[i];
        }
    }

    function getListOfAdmins() external view returns (
        address[] memory addresses,
        uint256 count
    ) {
        count = adminList.length + 1;
        addresses = new address[](count);
        addresses[0] = owner();
        for (uint256 i = 0; i < adminList.length; i++) {
            addresses[i + 1] = adminList[i];
        }
    }

    function getFeeBreakdown() external view returns (
        uint256 pendingLPFees,
        uint256 collectedLPFees,
        uint256 collectedProtocolFees,
        uint256 totalLPFees,
        uint256 vaultUSDCBalance
    ) {
        pendingLPFees = totalAccruedFees;
        collectedLPFees = totalCollectedFees;
        collectedProtocolFees = totalProtocolFees;
        totalLPFees = pendingLPFees + collectedLPFees;
        vaultUSDCBalance = usdc.balanceOf(address(this));
    }

    function getAccountingBreakdown() external view returns (
        uint256 usdcBalance,
        uint256 lpUsdcShare,
        uint256 protocolUsdcShare,
        uint256 loansOutstanding,
        uint256 appexFundedLoans,
        uint256 usdcFundedLoans,
        uint256 pendingFees,
        uint256 nav,
        uint256 availableLiquidity
    ) {
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

    function totalPendingRedemptions() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < redemptionQueue.length; i++) {
            total += redemptionQueue[i].lpTokens;
        }
        return total;
    }

    // ==================== Admin Functions ====================

    function addAdmin(address admin) external onlyOwner {
        require(admin != address(0), "Invalid address");
        require(!admins[admin], "Already admin");
        admins[admin] = true;
        adminList.push(admin);
        emit AdminAdded(admin, msg.sender);
    }

    function removeAdmin(address admin) external onlyOwner {
        require(admins[admin], "Not admin");
        admins[admin] = false;
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminList[i] == admin) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }
        emit AdminRemoved(admin, msg.sender);
    }

    function withdrawProtocolFees(address recipient, uint256 amount) external onlyAdmin {
        require(amount <= totalProtocolFees, "Exceeds protocol fees");
        require(recipient != address(0), "Invalid recipient");
        totalProtocolFees -= amount;
        usdc.safeTransfer(recipient, amount);
        emit ProtocolFeesWithdrawn(recipient, amount);
    }

    function approveBorrower(
        address borrower,
        uint256 limit,
        uint256 lpYieldRate,
        uint256 protocolFeeRate
    ) external {
        require(
            msg.sender == address(timelock) || msg.sender == owner() || admins[msg.sender],
            "Not authorized"
        );
        require(borrower != address(0), "Invalid borrower");

        if (!borrowers[borrower].approved) {
            borrowerList.push(borrower);
        }

        borrowers[borrower] = Borrower({
            approved: true,
            borrowLimit: limit,
            currentDebt: borrowers[borrower].currentDebt,
            lpYieldRate: lpYieldRate,
            protocolFeeRate: protocolFeeRate,
            totalBorrowed: borrowers[borrower].totalBorrowed,
            totalRepaid: borrowers[borrower].totalRepaid,
            totalFeesPaid: borrowers[borrower].totalFeesPaid
        });

        emit BorrowerApproved(borrower, limit);
    }

    // ==================== Governor Functions ====================

    function addGovernor(address governor) external onlyGovernor {
        require(governor != address(0), "Invalid address");
        require(!governors[governor], "Already governor");
        governors[governor] = true;
        governorList.push(governor);
        emit GovernorAdded(governor, msg.sender);
    }

    function removeGovernor(address governor) external onlyGovernor {
        require(governors[governor], "Not governor");
        require(governor != msg.sender, "Cannot remove yourself");
        governors[governor] = false;
        for (uint256 i = 0; i < governorList.length; i++) {
            if (governorList[i] == governor) {
                governorList[i] = governorList[governorList.length - 1];
                governorList.pop();
                break;
            }
        }
        emit GovernorRemoved(governor, msg.sender);
    }

    function initializeGovernor(address initialGovernor) external onlyOwner {
        require(governorList.length == 0, "Already initialized");
        require(initialGovernor != address(0), "Invalid address");
        governors[initialGovernor] = true;
        governorList.push(initialGovernor);
        emit GovernorAdded(initialGovernor, msg.sender);
    }

    function setTimelock(address _timelock) external onlyOwner {
        require(_timelock != address(0), "Invalid timelock");
        require(address(timelock) == address(0), "Timelock already set");
        timelock = TimelockController(payable(_timelock));
        emit TimelockSet(_timelock);
    }

    // ==================== Proposal Functions ====================

    function proposeBorrower(
        address borrower,
        uint256 limit,
        uint256 lpYieldRate,
        uint256 protocolFeeRate
    ) external onlyGovernor returns (bytes32) {
        require(borrower != address(0), "Invalid borrower");
        require(!borrowers[borrower].approved, "Already approved");

        bytes32 proposalId = keccak256(
            abi.encodePacked(borrower, limit, lpYieldRate, protocolFeeRate, block.timestamp)
        );

        BorrowerProposal storage proposal = borrowerProposals[proposalId];
        proposal.borrower = borrower;
        proposal.limit = limit;
        proposal.lpYieldRate = lpYieldRate;
        proposal.protocolFeeRate = protocolFeeRate;
        proposal.approvals = 1;
        proposal.hasApproved[msg.sender] = true;
        proposal.proposedAt = block.timestamp;

        governorApprovalCount[msg.sender]++;

        emit BorrowerProposed(proposalId, borrower, limit);
        emit BorrowerProposalApproved(proposalId, msg.sender, 1);

        return proposalId;
    }

    function approveBorrowerProposal(bytes32 proposalId) external onlyGovernor {
        BorrowerProposal storage proposal = borrowerProposals[proposalId];
        require(!proposal.hasApproved[msg.sender], "Already approved");
        require(!proposal.executed, "Already executed");
        require(proposal.scheduledAt == 0, "Already scheduled");

        proposal.hasApproved[msg.sender] = true;
        proposal.approvals++;
        governorApprovalCount[msg.sender]++;

        emit BorrowerProposalApproved(proposalId, msg.sender, proposal.approvals);

        if (proposal.approvals >= GOVERNOR_THRESHOLD) {
            uint256 timelockDelay = 2 days;
            
            timelock.schedule(
                address(this), 0,
                abi.encodeWithSelector(
                    this.approveBorrower.selector,
                    proposal.borrower, proposal.limit,
                    proposal.lpYieldRate, proposal.protocolFeeRate
                ),
                bytes32(0), bytes32(proposalId), timelockDelay
            );
            
            proposal.scheduledAt = block.timestamp;
            emit BorrowerProposalScheduled(proposalId, proposal.borrower, block.timestamp + timelockDelay);
        }
    }

    function executeBorrowerProposal(bytes32 proposalId) external {
        BorrowerProposal storage proposal = borrowerProposals[proposalId];
        require(proposal.scheduledAt > 0, "Not scheduled");
        require(!proposal.executed, "Already executed");
        require(block.timestamp >= proposal.scheduledAt + 2 days, "Timelock not expired");

        timelock.execute(
            address(this), 0,
            abi.encodeWithSelector(
                this.approveBorrower.selector,
                proposal.borrower, proposal.limit,
                proposal.lpYieldRate, proposal.protocolFeeRate
            ),
            bytes32(0), bytes32(proposalId)
        );

        proposal.executed = true;
        emit BorrowerProposalExecuted(proposalId, proposal.borrower);
    }

    function getProposalStatus(bytes32 proposalId) external view returns (
        bool ready, uint256 executeAfter, bool executed, uint256 approvals
    ) {
        BorrowerProposal storage proposal = borrowerProposals[proposalId];
        approvals = proposal.approvals;
        executed = proposal.executed;
        if (proposal.scheduledAt > 0) {
            executeAfter = proposal.scheduledAt + 2 days;
            ready = block.timestamp >= executeAfter && !executed;
        }
    }
}
