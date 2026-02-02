import { ethers } from 'ethers';
import { FEE_STRUCTURE } from '@/types';

// Format numbers with commas and optional decimals
export const formatNumber = (value: number | bigint, decimals: number = 2): string => {
  const num = typeof value === 'bigint' ? Number(value) : value;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

// Format USDC amounts (6 decimals)
export const formatUSDC = (amount: bigint, formatted: boolean = true): string => {
  const value = ethers.formatUnits(amount, 6);
  if (!formatted) return value;
  return formatNumber(parseFloat(value), 2);
};

// Format LP token amounts (6 decimals - matches USDC)
export const formatLP = (amount: bigint, formatted: boolean = true): string => {
  const value = ethers.formatUnits(amount, 6);
  if (!formatted) return value;
  return formatNumber(parseFloat(value), 4);
};

// Format token amounts (18 decimals - for APPEX and standard ERC20)
export const formatToken = (amount: bigint, formatted: boolean = true, decimals: number = 18): string => {
  const value = ethers.formatUnits(amount, decimals);
  if (!formatted) return value;
  return formatNumber(parseFloat(value), 4);
};

// Parse USDC input to bigint
export const parseUSDC = (amount: string): bigint => {
  return ethers.parseUnits(amount || '0', 6);
};

// Parse token input to bigint
export const parseToken = (amount: string, decimals: number = 18): bigint => {
  return ethers.parseUnits(amount || '0', decimals);
};

// Format percentage
export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

// Format address to short form
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Format timestamp to readable date
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format timestamp to readable date and time
export const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format relative time
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  
  return formatDate(timestamp);
};

// Calculate LP yield based on payment terms
export const calculateLPYield = (paymentDays: number): number => {
  const { minLpYield, maxLpYield, minDays, maxDays } = FEE_STRUCTURE;
  
  if (paymentDays <= minDays) return minLpYield;
  if (paymentDays >= maxDays) return maxLpYield;
  
  // Linear interpolation
  const ratio = (paymentDays - minDays) / (maxDays - minDays);
  return minLpYield + ratio * (maxLpYield - minLpYield);
};

// Calculate annualized yield from LP yield rate, utilization, and loan terms
// APY = (LP_Yield_Rate × Utilization × 365) / Avg_Loan_Term
export const calculateAnnualizedYield = (lpYieldRateBps: number, utilizationRate: number, avgLoanDays: number = 30): number => {
  // lpYieldRateBps is in basis points (e.g., 500 = 5%)
  const yieldPerLoan = lpYieldRateBps / 10000; // Convert to decimal
  const turnsPerYear = 365 / avgLoanDays;
  const utilization = utilizationRate / 100; // Convert percentage to decimal
  
  // APY = yield per loan × turns per year × utilization
  return yieldPerLoan * turnsPerYear * utilization * 100; // Return as percentage
};

// Estimate APY based on typical parameters when specific rates aren't known
export const estimateAPY = (utilizationRate: number): number => {
  // Assume average LP yield of 5% per 30-day loan
  const avgLpYieldBps = 500; // 5%
  const avgLoanDays = 30;
  return calculateAnnualizedYield(avgLpYieldBps, utilizationRate, avgLoanDays);
};

// Calculate staking cap from LP tokens and multiplier
export const calculateStakingCap = (lpTokens: bigint, multiplier: number): bigint => {
  return lpTokens * BigInt(multiplier);
};

// Calculate duration multiplier
export const getDurationMultiplier = (lockDays: number): number => {
  if (lockDays >= 180) return 3;
  if (lockDays >= 90) return 2;
  return 1;
};

// Validate Ethereum address
export const isValidAddress = (address: string): boolean => {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
};

// Delay utility for animations
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Generate a random ID
export const generateId = (): string => {
  return crypto.randomUUID();
};

// Truncate text with ellipsis
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

// Class name utility (cn)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Copy to clipboard
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

// Get explorer URL
export const getExplorerUrl = (hash: string, type: 'tx' | 'address' = 'tx'): string | null => {
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  
  const explorers: Record<string, string> = {
    '1': 'https://etherscan.io',
    '11155111': 'https://sepolia.etherscan.io',
  };
  
  const explorer = chainId ? explorers[chainId] : null;
  if (!explorer) return null;
  
  return `${explorer}/${type}/${hash}`;
};

// Calculate health factor for borrower
export const calculateHealthFactor = (
  outstanding: bigint, 
  limit: bigint
): { value: number; status: 'healthy' | 'warning' | 'danger' } => {
  if (limit === 0n) return { value: 0, status: 'healthy' };
  
  const utilization = Number(outstanding * 100n / limit);
  
  if (utilization < 70) return { value: utilization, status: 'healthy' };
  if (utilization < 90) return { value: utilization, status: 'warning' };
  return { value: utilization, status: 'danger' };
};

// Format currency with symbol
export const formatCurrency = (
  amount: bigint,
  symbol: 'USDC' | 'APPEX' | 'ETH',
  showSymbol: boolean = true
): string => {
  const decimals = symbol === 'USDC' ? 6 : 18;
  const formatted = ethers.formatUnits(amount, decimals);
  const numFormatted = formatNumber(parseFloat(formatted), symbol === 'USDC' ? 2 : 4);
  
  return showSymbol ? `${numFormatted} ${symbol}` : numFormatted;
};
