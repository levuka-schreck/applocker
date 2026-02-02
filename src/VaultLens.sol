// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IPaymentsVault
 * @dev Interface for reading PaymentsVault state
 */
interface IPaymentsVault {
    function usdc() external view returns (IERC20);
    function lpToken() external view returns (IERC20);
    function borrowers(address) external view returns (
        bool approved, uint256 borrowLimit, uint256 currentDebt,
        uint256 lpYieldRate, uint256 protocolFeeRate,
        uint256 totalBorrowed, uint256 totalRepaid, uint256 totalFeesPaid
    );
    function borrowerList(uint256) external view returns (address);
    function getBorrowerCount() external view returns (uint256);
    function loans(uint256) external view returns (
        address borrower, address publisher, uint256 principal,
        uint256 lpFee, uint256 protocolFee, uint256 startTime,
        uint256 termDays, bool repaid, bool protocolFeePaid,
        uint256 dailyAccrual, uint256 usdcPrincipal
    );
    function nextLoanId() external view returns (uint256);
    function getActiveLoansCount() external view returns (uint256);
    function getActiveLoanId(uint256 index) external view returns (uint256);
    function getNAV() external view returns (uint256);
    function getAvailableUSDC() external view returns (uint256);
    function totalLoansOutstanding() external view returns (uint256);
    function totalAppexFundedLoans() external view returns (uint256);
    function totalAccruedFees() external view returns (uint256);
    function totalCollectedFees() external view returns (uint256);
    function totalProtocolFees() external view returns (uint256);
    function governors(address) external view returns (bool);
    function governorList(uint256) external view returns (address);
    function getGovernorCount() external view returns (uint256);
    function governorApprovalCount(address) external view returns (uint256);
    function admins(address) external view returns (bool);
    function adminList(uint256) external view returns (address);
    function getAdminCount() external view returns (uint256);
    function owner() external view returns (address);
    function stakingPositions(address) external view returns (
        uint256 appexStaked, uint256 lockDuration, uint256 lockEnd, uint256 pendingRewards
    );
    function totalStaked() external view returns (uint256);
    function totalStakingWeight() external view returns (uint256);
}

/**
 * @title VaultLens
 * @dev Read-only contract for complex view functions
 * Deployed separately to reduce main contract size
 */
contract VaultLens {
    
    struct LoanDetails {
        uint256 loanId;
        address borrower;
        address publisher;
        uint256 principal;
        uint256 usdcPrincipal;
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

    struct BorrowerDetails {
        address borrowerAddress;
        bool approved;
        uint256 borrowLimit;
        uint256 currentDebt;
        uint256 availableCredit;
        uint256 utilizationRate;
        uint256 lpYieldRate;
        uint256 protocolFeeRate;
        uint256 activeLoansCount;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 totalFeesPaid;
    }

    struct GovernorDetails {
        address governorAddress;
        uint256 proposalsCreated;
        uint256 proposalsApproved;
    }

    struct AdminDetails {
        address adminAddress;
        bool isOwner;
    }

    struct StakingInfo {
        uint256 stakedAmount;
        uint256 lockDuration;
        uint256 lockEnd;
        uint256 pendingRewards;
        uint256 weightedStake;
        bool canUnstake;
    }

    struct VaultStats {
        uint256 totalAssets;
        uint256 totalSupply;
        uint256 totalLoansOutstanding;
        uint256 accruedFees;
        uint256 collectedFees;
        uint256 totalLPFees;
        uint256 protocolFees;
        uint256 navPerShare;
        uint256 utilizationRate;
        uint256 totalDeposits;
        uint256 availableUSDC;
    }

    /**
     * @dev Get comprehensive vault statistics
     */
    function getVaultStats(address vault) external view returns (VaultStats memory stats) {
        IPaymentsVault v = IPaymentsVault(vault);
        
        stats.totalAssets = v.getNAV();
        stats.totalSupply = v.lpToken().totalSupply();
        stats.totalLoansOutstanding = v.totalLoansOutstanding();
        stats.accruedFees = v.totalAccruedFees();
        stats.collectedFees = v.totalCollectedFees();
        stats.totalLPFees = stats.accruedFees + stats.collectedFees;
        stats.protocolFees = v.totalProtocolFees();
        stats.navPerShare = stats.totalSupply > 0 ? (stats.totalAssets * 1e6) / stats.totalSupply : 1e6;
        stats.utilizationRate = stats.totalAssets > 0 
            ? (stats.totalLoansOutstanding * 10000) / stats.totalAssets 
            : 0;
        stats.totalDeposits = v.usdc().balanceOf(vault);
        stats.availableUSDC = v.getAvailableUSDC();
    }

    /**
     * @dev Get paginated list of loans
     */
    function getListOfLoans(
        address vault,
        uint256 startIndex,
        uint256 count
    ) external view returns (
        uint256[] memory loanIds,
        LoanDetails[] memory loanDetails,
        uint256 totalLoans
    ) {
        IPaymentsVault v = IPaymentsVault(vault);
        totalLoans = v.nextLoanId() - 1;

        if (startIndex >= totalLoans) {
            return (new uint256[](0), new LoanDetails[](0), totalLoans);
        }

        uint256 resultCount = count;
        if (startIndex + count > totalLoans) {
            resultCount = totalLoans - startIndex;
        }

        loanIds = new uint256[](resultCount);
        loanDetails = new LoanDetails[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            uint256 loanId = startIndex + i + 1;
            loanIds[i] = loanId;
            loanDetails[i] = _getLoanDetails(v, loanId);
        }
    }

    /**
     * @dev Get active (unpaid) loans
     */
    function getActiveLoans(address vault) external view returns (
        uint256[] memory loanIds,
        LoanDetails[] memory loanDetails,
        uint256 count
    ) {
        IPaymentsVault v = IPaymentsVault(vault);
        count = v.getActiveLoansCount();
        
        loanIds = new uint256[](count);
        loanDetails = new LoanDetails[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 loanId = v.getActiveLoanId(i);
            loanIds[i] = loanId;
            loanDetails[i] = _getLoanDetails(v, loanId);
        }
    }

    /**
     * @dev Get loans for a specific borrower
     */
    function getLoansByBorrower(
        address vault,
        address borrowerAddr
    ) external view returns (
        uint256[] memory loanIds,
        LoanDetails[] memory loanDetails,
        uint256 count
    ) {
        IPaymentsVault v = IPaymentsVault(vault);
        uint256 totalLoans = v.nextLoanId() - 1;

        // Count loans for borrower
        uint256 borrowerLoanCount = 0;
        for (uint256 i = 1; i <= totalLoans; i++) {
            if (_getLoanBorrower(v, i) == borrowerAddr) {
                borrowerLoanCount++;
            }
        }

        count = borrowerLoanCount;
        loanIds = new uint256[](count);
        loanDetails = new LoanDetails[](count);

        uint256 idx = 0;
        for (uint256 i = 1; i <= totalLoans && idx < count; i++) {
            if (_getLoanBorrower(v, i) == borrowerAddr) {
                loanIds[idx] = i;
                loanDetails[idx] = _getLoanDetails(v, i);
                idx++;
            }
        }
    }

    /**
     * @dev Get list of all borrowers with details
     */
    function getListOfBorrowers(address vault) external view returns (
        address[] memory addresses,
        BorrowerDetails[] memory details,
        uint256 count
    ) {
        IPaymentsVault v = IPaymentsVault(vault);
        count = v.getBorrowerCount();

        addresses = new address[](count);
        details = new BorrowerDetails[](count);

        for (uint256 i = 0; i < count; i++) {
            address borrowerAddr = v.borrowerList(i);
            addresses[i] = borrowerAddr;
            details[i] = _getBorrowerDetails(v, borrowerAddr);
        }
    }

    /**
     * @dev Get borrower info for a specific address
     */
    function getBorrowerInfo(address vault, address borrowerAddr) external view returns (BorrowerDetails memory) {
        return _getBorrowerDetails(IPaymentsVault(vault), borrowerAddr);
    }

    /**
     * @dev Get staking info for a specific address
     */
    function getStakingInfo(address vault, address staker) external view returns (StakingInfo memory info) {
        IPaymentsVault v = IPaymentsVault(vault);
        (uint256 staked, uint256 lockDuration, uint256 lockEnd, uint256 rewards) = v.stakingPositions(staker);
        
        uint256 multiplier = lockDuration >= 180 ? 200 : (lockDuration >= 90 ? 150 : 100);
        
        info = StakingInfo({
            stakedAmount: staked,
            lockDuration: lockDuration,
            lockEnd: lockEnd,
            pendingRewards: rewards,
            weightedStake: staked * multiplier / 100,
            canUnstake: block.timestamp >= lockEnd
        });
    }

    /**
     * @dev Get list of governors with details
     */
    function getGovernorsDetails(address vault) external view returns (
        GovernorDetails[] memory details,
        uint256 count
    ) {
        IPaymentsVault v = IPaymentsVault(vault);
        count = v.getGovernorCount();
        details = new GovernorDetails[](count);

        for (uint256 i = 0; i < count; i++) {
            address gov = v.governorList(i);
            details[i] = GovernorDetails({
                governorAddress: gov,
                proposalsCreated: v.governorApprovalCount(gov),
                proposalsApproved: v.governorApprovalCount(gov)
            });
        }
    }

    /**
     * @dev Get list of admins with details
     */
    function getAdminsDetails(address vault) external view returns (
        AdminDetails[] memory details,
        uint256 count
    ) {
        IPaymentsVault v = IPaymentsVault(vault);
        count = v.getAdminCount();
        details = new AdminDetails[](count);

        // Owner first
        details[0] = AdminDetails({
            adminAddress: v.owner(),
            isOwner: true
        });

        // Then admins from list
        for (uint256 i = 1; i < count; i++) {
            details[i] = AdminDetails({
                adminAddress: v.adminList(i - 1),
                isOwner: false
            });
        }
    }

    /**
     * @dev Get accounting breakdown
     */
    function getAccountingBreakdown(address vault) external view returns (
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
        IPaymentsVault v = IPaymentsVault(vault);
        
        usdcBalance = v.usdc().balanceOf(vault);
        protocolUsdcShare = v.totalProtocolFees();
        lpUsdcShare = usdcBalance > protocolUsdcShare ? usdcBalance - protocolUsdcShare : 0;
        loansOutstanding = v.totalLoansOutstanding();
        appexFundedLoans = v.totalAppexFundedLoans();
        usdcFundedLoans = loansOutstanding > appexFundedLoans ? loansOutstanding - appexFundedLoans : 0;
        pendingFees = v.totalAccruedFees();
        nav = v.getNAV();
        availableLiquidity = v.getAvailableUSDC();
    }

    /**
     * @dev Get fee breakdown
     */
    function getFeeBreakdown(address vault) external view returns (
        uint256 pendingLPFees,
        uint256 collectedLPFees,
        uint256 collectedProtocolFees,
        uint256 totalLPFees,
        uint256 vaultUSDCBalance
    ) {
        IPaymentsVault v = IPaymentsVault(vault);
        
        pendingLPFees = v.totalAccruedFees();
        collectedLPFees = v.totalCollectedFees();
        collectedProtocolFees = v.totalProtocolFees();
        totalLPFees = pendingLPFees + collectedLPFees;
        vaultUSDCBalance = v.usdc().balanceOf(vault);
    }

    // ==================== Internal Helpers ====================

    function _getLoanDetails(IPaymentsVault v, uint256 loanId) internal view returns (LoanDetails memory details) {
        details.loanId = loanId;
        details.borrower = _getLoanBorrower(v, loanId);
        
        // Fetch addresses and core amounts
        {
            (
                ,
                address publisher,
                uint256 principal,
                uint256 lpFee,
                uint256 protocolFee,
                ,,,,,
            ) = v.loans(loanId);
            
            details.publisher = publisher;
            details.principal = principal;
            details.lpFee = lpFee;
            details.protocolFee = protocolFee;
            details.totalDue = principal + lpFee + protocolFee;
        }
        
        // Fetch timing, status, and remaining fields
        {
            (
                ,,,,,
                uint256 startTime,
                uint256 termDays,
                bool repaid,
                bool protocolFeePaid,
                uint256 dailyAccrual,
                uint256 usdcPrincipal
            ) = v.loans(loanId);
            
            details.usdcPrincipal = usdcPrincipal;
            details.startTime = startTime;
            details.termDays = termDays;
            details.repaid = repaid;
            details.protocolFeePaid = protocolFeePaid;
            details.endTime = startTime + (termDays * 1 days);
            details.daysElapsed = (block.timestamp - startTime) / 1 days;
            details.isOverdue = block.timestamp > details.endTime && !repaid;
            
            // Calculate accrued fees within this scope
            uint256 accruedFees = dailyAccrual * details.daysElapsed;
            details.accruedFees = accruedFees > details.lpFee ? details.lpFee : accruedFees;
        }
    }

    function _getBorrowerDetails(IPaymentsVault v, address borrowerAddr) internal view returns (BorrowerDetails memory details) {
        details.borrowerAddress = borrowerAddr;
        
        // First fetch: basic info (scoped to release stack)
        {
            (
                bool approved,
                uint256 borrowLimit,
                uint256 currentDebt,
                uint256 lpYieldRate,
                ,,,
            ) = v.borrowers(borrowerAddr);
            
            details.approved = approved;
            details.borrowLimit = borrowLimit;
            details.currentDebt = currentDebt;
            details.lpYieldRate = lpYieldRate;
            details.availableCredit = borrowLimit > currentDebt ? borrowLimit - currentDebt : 0;
            details.utilizationRate = borrowLimit > 0 ? (currentDebt * 10000) / borrowLimit : 0;
        }
        
        // Second fetch: fee rate and totals (scoped to release stack)
        {
            (
                ,,,,
                uint256 protocolFeeRate,
                uint256 totalBorrowed,
                uint256 totalRepaid,
                uint256 totalFeesPaid
            ) = v.borrowers(borrowerAddr);
            
            details.protocolFeeRate = protocolFeeRate;
            details.totalBorrowed = totalBorrowed;
            details.totalRepaid = totalRepaid;
            details.totalFeesPaid = totalFeesPaid;
        }

        // Count active loans for this borrower (using helpers to avoid stack issues)
        {
            uint256 totalLoans = v.nextLoanId() - 1;
            uint256 activeLoansCount = 0;
            for (uint256 i = 1; i <= totalLoans; i++) {
                if (_getLoanBorrower(v, i) == borrowerAddr && _isLoanActive(v, i)) {
                    activeLoansCount++;
                }
            }
            details.activeLoansCount = activeLoansCount;
        }
    }

    // Minimal helper to get loan borrower address (avoids stack too deep)
    function _getLoanBorrower(IPaymentsVault v, uint256 loanId) internal view returns (address) {
        (address borrower,,,,,,,,,,) = v.loans(loanId);
        return borrower;
    }

    // Minimal helper to check if loan is active (avoids stack too deep)  
    function _isLoanActive(IPaymentsVault v, uint256 loanId) internal view returns (bool) {
        // Only fetch the two bool fields we need
        (,,,,,,,bool repaid, bool protocolFeePaid,,) = v.loans(loanId);
        return !repaid || !protocolFeePaid;
    }
}
