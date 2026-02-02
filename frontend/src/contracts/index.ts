// Contract ABIs for AppEx Payments Protocol
// These are the essential function signatures needed for the frontend

export const PaymentsVaultABI = [
  // View functions - MATCHING ACTUAL CONTRACT
  "function getNAV() view returns (uint256)",
  "function getAvailableUSDC() view returns (uint256)",
  "function getSharePrice() view returns (uint256)",
  "function totalDeposits() view returns (uint256)",
  "function totalLoansOutstanding() view returns (uint256)",
  "function totalAccruedFees() view returns (uint256)",
  "function totalCollectedFees() view returns (uint256)",
  "function totalProtocolFees() view returns (uint256)",
  "function getFeeBreakdown() view returns (uint256 pendingLPFees, uint256 collectedLPFees, uint256 collectedProtocolFees, uint256 totalLPFees, uint256 vaultUSDCBalance)",
  "function getAccountingBreakdown() view returns (uint256 usdcBalance, uint256 lpUsdcShare, uint256 protocolUsdcShare, uint256 loansOutstanding, uint256 appexFundedLoans, uint256 usdcFundedLoans, uint256 pendingFees, uint256 nav, uint256 availableLiquidity)",
  "function totalAppexFundedLoans() view returns (uint256)",
  "function lastNAVUpdate() view returns (uint256)",
  "function dailyRedemptionCap() view returns (uint256)",
  "function liquidityBuffer() view returns (uint256)",
  "function stakingMultiplier() view returns (uint256)",
  "function owner() view returns (address)",
  
  // Admin functions (multi-admin support)
  "function admins(address) view returns (bool)",
  "function adminList(uint256 index) view returns (address)",
  "function getAdminCount() view returns (uint256)",
  "function getListOfAdmins() view returns (address[] memory addresses, uint256 count)",
  "function isAdmin(address account) view returns (bool)",
  "function addAdmin(address admin) external",
  "function removeAdmin(address admin) external",
  
  // Token references
  "function usdc() view returns (address)",
  "function appexToken() view returns (address)",
  "function lpToken() view returns (address)",
  
  // Borrower functions
  "function borrowers(address) view returns (bool approved, uint256 borrowLimit, uint256 currentDebt, uint256 lpYieldRate, uint256 protocolFeeRate, uint256 totalBorrowed, uint256 totalRepaid, uint256 totalFeesPaid)",
  "function borrowerList(uint256 index) view returns (address)",
  
  // Loan functions
  "function loans(uint256 loanId) view returns (address borrower, address publisher, uint256 principal, uint256 lpFee, uint256 protocolFee, uint256 startTime, uint256 termDays, bool repaid, bool protocolFeePaid, uint256 dailyAccrual, uint256 usdcPrincipal)",
  "function nextLoanId() view returns (uint256)",
  "function activeLoans(uint256 index) view returns (uint256)",
  "function getLoansByBorrower(address borrowerAddr) view returns (uint256[] memory loanIds, tuple(uint256 loanId, address borrower, address publisher, uint256 principal, uint256 usdcPrincipal, uint256 lpFee, uint256 protocolFee, uint256 totalDue, uint256 startTime, uint256 termDays, uint256 endTime, bool repaid, bool protocolFeePaid, uint256 daysElapsed, bool isOverdue, uint256 accruedFees)[] memory loanDetails, uint256 count)",
  
  // Staking functions
  "function stakingPositions(address staker) view returns (uint256 appexStaked, uint256 lockDuration, uint256 lockEnd, uint256 pendingRewards)",
  "function totalStaked() view returns (uint256)",
  "function totalStakingWeight() view returns (uint256)",
  
  // Redemption queue
  "function redemptionQueue(uint256 index) view returns (address lp, uint256 amount, uint256 timestamp)",
  "function totalPendingRedemptions() view returns (uint256)",
  
  // Governor functions
  "function governors(address) view returns (bool)",
  "function governorList(uint256 index) view returns (address)",
  "function getGovernorCount() view returns (uint256)",
  "function getListOfGovernors() view returns (address[] memory addresses, uint256 count)",
  "function isGovernor(address account) view returns (bool)",
  
  // Timelock
  "function timelock() view returns (address)",
  
  // LP functions
  "function deposit(uint256 amount) external",
  "function requestRedemption(uint256 lpTokenAmount) external",
  "function processRedemptions() external",
  
  // Borrower operations
  "function createLoan(address publisher, uint256 principal, uint256 termDays, bool payInAppEx, uint256 appexPercentage) external returns (uint256)",
  "function repayLoan(uint256 loanId) external",
  "function payProtocolFee(uint256 loanId, bool payInAppex) external",
  
  // Governance functions
  "function approveBorrower(address borrower, uint256 limit, uint256 lpYieldRate, uint256 protocolFeeRate) external",
  "function proposeBorrower(address borrower, uint256 limit, uint256 lpYieldRate, uint256 protocolFeeRate) external returns (bytes32)",
  "function approveBorrowerProposal(bytes32 proposalId) external",
  "function executeBorrowerProposal(bytes32 proposalId) external",
  "function getProposalStatus(bytes32 proposalId) view returns (bool ready, uint256 executeAfter, bool executed, uint256 approvals)",
  "function borrowerProposals(bytes32 proposalId) view returns (address borrower, uint256 limit, uint256 lpYieldRate, uint256 protocolFeeRate, uint256 approvals, uint256 proposedAt, uint256 scheduledAt, bool executed)",
  "function addGovernor(address governor) external",
  "function removeGovernor(address governor) external",
  "function initializeGovernor(address initialGovernor) external",
  "function setTimelock(address _timelock) external",
  
  // Staking functions
  "function stake(uint256 amount, uint256 lockDays) external",
  "function unstake(uint256 amount) external",
  
  // NAV update
  "function updateNAV() external",
  
  // Events
  "event Deposited(address indexed lp, uint256 amount, uint256 lpTokens)",
  "event RedemptionRequested(address indexed lp, uint256 amount)",
  "event Redeemed(address indexed lp, uint256 lpTokens, uint256 usdc)",
  "event BorrowerApproved(address indexed borrower, uint256 limit)",
  "event LoanCreated(uint256 indexed loanId, address indexed borrower, address indexed publisher, uint256 amount)",
  "event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 fees)",
  "event ProtocolFeePaid(uint256 indexed loanId, uint256 feeAmount, bool paidInAppex)",
  "event ProtocolFeesWithdrawn(address indexed recipient, uint256 amount)",
  "event Staked(address indexed lp, uint256 amount, uint256 duration)",
  "event Unstaked(address indexed lp, uint256 amount)",
  "event RewardsDistributed(uint256 amount)",
  "event GovernorAdded(address indexed governor, address indexed addedBy)",
  "event GovernorRemoved(address indexed governor, address indexed removedBy)",
  "event AdminAdded(address indexed admin, address indexed addedBy)",
  "event AdminRemoved(address indexed admin, address indexed removedBy)"
] as const;

export const AppExTokenABI = [
  // ERC20 standard
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
] as const;

export const MockUSDCABI = [
  // ERC20 standard
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  
  // Mock mint function for testing
  "function mint(address to, uint256 amount)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
] as const;

export const LPTokenABI = [
  // ERC20 standard
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
] as const;

// Contract addresses configuration
// These defaults match anvil deployment order from Deploy_s.sol
export const getContractAddresses = () => ({
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  appexToken: process.env.NEXT_PUBLIC_APPEX_TOKEN_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  lpToken: process.env.NEXT_PUBLIC_LP_TOKEN_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  paymentsVault: process.env.NEXT_PUBLIC_PAYMENTS_VAULT_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
  vaultLens: process.env.NEXT_PUBLIC_VAULT_LENS_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
});

// VaultLens ABI - separate contract for complex view functions
export const VaultLensABI = [
  // Vault stats
  "function getVaultStats(address vault) view returns (tuple(uint256 totalAssets, uint256 totalSupply, uint256 totalLoansOutstanding, uint256 accruedFees, uint256 collectedFees, uint256 totalLPFees, uint256 protocolFees, uint256 navPerShare, uint256 utilizationRate, uint256 totalDeposits, uint256 availableUSDC) stats)",
  
  // Loan queries
  "function getListOfLoans(address vault, uint256 startIndex, uint256 count) view returns (uint256[] memory loanIds, tuple(uint256 loanId, address borrower, address publisher, uint256 principal, uint256 usdcPrincipal, uint256 lpFee, uint256 protocolFee, uint256 totalDue, uint256 startTime, uint256 termDays, uint256 endTime, bool repaid, bool protocolFeePaid, uint256 daysElapsed, bool isOverdue, uint256 accruedFees)[] memory loanDetails, uint256 totalLoans)",
  "function getActiveLoans(address vault) view returns (uint256[] memory loanIds, tuple(uint256 loanId, address borrower, address publisher, uint256 principal, uint256 usdcPrincipal, uint256 lpFee, uint256 protocolFee, uint256 totalDue, uint256 startTime, uint256 termDays, uint256 endTime, bool repaid, bool protocolFeePaid, uint256 daysElapsed, bool isOverdue, uint256 accruedFees)[] memory loanDetails, uint256 count)",
  "function getLoansByBorrower(address vault, address borrowerAddr) view returns (uint256[] memory loanIds, tuple(uint256 loanId, address borrower, address publisher, uint256 principal, uint256 usdcPrincipal, uint256 lpFee, uint256 protocolFee, uint256 totalDue, uint256 startTime, uint256 termDays, uint256 endTime, bool repaid, bool protocolFeePaid, uint256 daysElapsed, bool isOverdue, uint256 accruedFees)[] memory loanDetails, uint256 count)",
  
  // Borrower queries
  "function getListOfBorrowers(address vault) view returns (address[] memory addresses, tuple(address borrowerAddress, bool approved, uint256 borrowLimit, uint256 currentDebt, uint256 availableCredit, uint256 utilizationRate, uint256 lpYieldRate, uint256 protocolFeeRate, uint256 activeLoansCount, uint256 totalBorrowed, uint256 totalRepaid, uint256 totalFeesPaid)[] memory details, uint256 count)",
  "function getBorrowerInfo(address vault, address borrowerAddr) view returns (tuple(address borrowerAddress, bool approved, uint256 borrowLimit, uint256 currentDebt, uint256 availableCredit, uint256 utilizationRate, uint256 lpYieldRate, uint256 protocolFeeRate, uint256 activeLoansCount, uint256 totalBorrowed, uint256 totalRepaid, uint256 totalFeesPaid))",
  
  // Staking queries
  "function getStakingInfo(address vault, address staker) view returns (tuple(uint256 stakedAmount, uint256 lockDuration, uint256 lockEnd, uint256 pendingRewards, uint256 weightedStake, bool canUnstake))",
  
  // Governance queries
  "function getGovernorsDetails(address vault) view returns (tuple(address governorAddress, uint256 proposalsCreated, uint256 proposalsApproved)[] memory details, uint256 count)",
  "function getAdminsDetails(address vault) view returns (tuple(address adminAddress, bool isOwner)[] memory details, uint256 count)",
  
  // Accounting queries
  "function getAccountingBreakdown(address vault) view returns (uint256 usdcBalance, uint256 lpUsdcShare, uint256 protocolUsdcShare, uint256 loansOutstanding, uint256 appexFundedLoans, uint256 usdcFundedLoans, uint256 pendingFees, uint256 nav, uint256 availableLiquidity)",
  "function getFeeBreakdown(address vault) view returns (uint256 pendingLPFees, uint256 collectedLPFees, uint256 collectedProtocolFees, uint256 totalLPFees, uint256 vaultUSDCBalance)",
] as const;

// Chain configuration
export const getChainConfig = () => ({
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '31337'),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545',
  chainName: process.env.NEXT_PUBLIC_CHAIN_ID === '1' ? 'Ethereum Mainnet' : 
             process.env.NEXT_PUBLIC_CHAIN_ID === '11155111' ? 'Sepolia Testnet' : 
             'Anvil Local',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: process.env.NEXT_PUBLIC_CHAIN_ID === '1' ? 'https://etherscan.io' :
                 process.env.NEXT_PUBLIC_CHAIN_ID === '11155111' ? 'https://sepolia.etherscan.io' :
                 undefined,
});
