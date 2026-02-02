import { ethers } from 'ethers';

// User roles in the AppEx ecosystem
export type UserRole = 'lp' | 'borrower' | 'publisher' | 'admin' | 'guest';

// Borrower status for governance
export type BorrowerStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

// Payment status
export type PaymentStatus = 'pending' | 'approved' | 'processed' | 'rejected';

// Loan status
export type LoanStatus = 'active' | 'repaid' | 'defaulted';

// Payout format options for publishers
export type PayoutFormat = 'appex' | 'usdc' | 'fiat';

// User account interface
export interface User {
  address: string;
  name?: string;
  email?: string;
  roles: UserRole[];
  profileImage?: string;
  authenticationType: 'web3auth' | 'metamask' | 'walletconnect';
}

// Vault statistics
export interface VaultStats {
  totalDeposits: bigint;
  totalLoansOutstanding: bigint;
  accruedFees: bigint;
  defiLendingDeposits: bigint;
  navPerShare: bigint;
  utilizationRate: number;
  totalBorrowers: number;
  totalLPs: number;
}

// LP position
export interface LPPosition {
  address: string;
  lpTokenBalance: bigint;
  usdcValue: bigint;
  stakedAppex: bigint;
  stakingCap: bigint;
  pendingRewards: bigint;
  lockDuration: number;
  lockExpiry: number;
  durationMultiplier: number;
}

// Borrower application
export interface BorrowerApplication {
  id: string;
  companyName: string;
  address: string;
  applicationDate: number;
  status: BorrowerStatus;
  proposedLimit: bigint;
  paymentVelocity: number;
  creditScore: number;
  description: string;
  documents: string[];
  votes: {
    for: bigint;
    against: bigint;
    abstain: bigint;
  };
  votingDeadline: number;
}

// Approved borrower
export interface Borrower {
  address: string;
  companyName: string;
  borrowingLimit: bigint;
  currentOutstanding: bigint;
  totalBorrowed: bigint;
  totalRepaid: bigint;
  feesOwed: bigint;
  approvalDate: number;
  lastActivityDate: number;
  status: BorrowerStatus;
  paymentTerms: number;
}

// Loan record
export interface Loan {
  id: string;
  borrowerAddress: string;
  publisherAddress: string;
  amount: bigint;
  fee: bigint;
  protocolFee: bigint;
  createdAt: number;
  dueDate: number;
  repaidAt?: number;
  status: LoanStatus;
  paymentBreakdown: {
    appexAmount: bigint;
    usdcAmount: bigint;
    fiatAmount: bigint;
  };
}

// Publisher payment request
export interface PaymentRequest {
  id: string;
  publisherAddress: string;
  borrowerAddress: string;
  totalAmount: bigint;
  appexPercentage: number;
  usdcPercentage: number;
  fiatPercentage: number;
  status: PaymentStatus;
  requestedAt: number;
  processedAt?: number;
}

// Governance proposal
export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  createdAt: number;
  votingDeadline: number;
  executionDelay: number;
  executed: boolean;
  votes: {
    for: bigint;
    against: bigint;
    abstain: bigint;
  };
  type: 'parameter_change' | 'borrower_approval' | 'fee_adjustment' | 'other';
  parameters?: Record<string, unknown>;
}

// Staking tier information
export interface StakingTier {
  name: string;
  minLockDays: number;
  multiplier: number;
  color: string;
}

// Transaction record
export interface Transaction {
  hash: string;
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'stake' | 'unstake' | 'payout' | 'claim';
  amount: bigint;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  from: string;
  to?: string;
}

// Chart data types
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

// Notification types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// Constants
export const STAKING_TIERS: StakingTier[] = [
  { name: 'Flexible', minLockDays: 0, multiplier: 1, color: '#64748b' },
  { name: 'Bronze', minLockDays: 90, multiplier: 2, color: '#cd7f32' },
  { name: 'Silver', minLockDays: 180, multiplier: 3, color: '#c0c0c0' },
];

export const FEE_STRUCTURE = {
  minLpYield: 5,
  maxLpYield: 15,
  minDays: 30,
  maxDays: 180,
  protocolFeeSplit: 0.5,
  appexFeeDiscount: 0.25,
};

// Helper type for contract interactions
export interface ContractConfig {
  address: string;
  abi: ethers.InterfaceAbi;
}
