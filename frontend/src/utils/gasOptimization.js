/**
 * Gas Optimization Utilities
 * 
 * Optimized gas settings with realistic limits that prevent reverts
 */

// Safe gas limits that prevent transaction failures
export const GAS_LIMITS = {
  // Token operations
  TOKEN_APPROVE: 80000,        // Safe for approvals
  TOKEN_TRANSFER: 80000,       // Safe for transfers
  TOKEN_FAUCET: 120000,        // Safe for faucet
  
  // Vault operations - increased for safety
  VAULT_DEPOSIT: 250000,       // Safe for deposits
  VAULT_REDEEM: 250000,        // Increased from 150000
  VAULT_STAKE: 250000,         // Safe for staking
  VAULT_UNSTAKE: 200000,       // Safe for unstaking
  
  // Loan operations - complex transactions
  LOAN_CREATE: 500000,         // Complex - transfers + state updates
  LOAN_REPAY: 400000,          // Complex repayment logic
  
  // Admin operations
  APPROVE_BORROWER: 150000,    // Safe for admin operations
  
  // Default fallback
  DEFAULT: 200000,             // Safe default
};

/**
 * Get ultra-optimized transaction options
 * @param {string} operation - Operation type
 * @param {object} customOptions - Custom options
 * @returns {object} Transaction options with minimal gas
 */
export function getGasOptions(operation = 'DEFAULT', customOptions = {}) {
  const gasLimit = GAS_LIMITS[operation] || GAS_LIMITS.DEFAULT;
  
  return {
    gasLimit,
    // Increased for Anvil compatibility (was too low)
    maxFeePerGas: 2000000000,          // 2 gwei (works with Anvil)
    maxPriorityFeePerGas: 1000000000,  // 1 gwei
    ...customOptions,
  };
}

/**
 * Estimate gas with aggressive optimization
 * @param {Function} txFunction - Transaction function
 * @param {string} fallbackOperation - Fallback operation
 * @returns {Promise<object>} Optimized gas options
 */
export async function estimateGasWithFallback(txFunction, fallbackOperation = 'DEFAULT') {
  try {
    // Try to estimate gas
    const estimatedGas = await txFunction.estimateGas();
    // Add 20% buffer for safety
    const gasLimit = Math.floor(Number(estimatedGas) * 1.2);
    
    // Use estimated gas if reasonable, otherwise use preset
    const maxGasLimit = GAS_LIMITS[fallbackOperation] || GAS_LIMITS.DEFAULT;
    const finalGasLimit = Math.max(gasLimit, maxGasLimit * 0.8); // At least 80% of preset
    
    return {
      gasLimit: finalGasLimit,
      maxFeePerGas: 2000000000,          // 2 gwei
      maxPriorityFeePerGas: 1000000000,  // 1 gwei
    };
  } catch (error) {
    console.warn('Gas estimation failed, using preset limit:', error.message);
    // Fall back to preset limit
    return getGasOptions(fallbackOperation);
  }
}

/**
 * Execute transaction with ultra-low gas
 * @param {Function} txFunction - Transaction function
 * @param {string} operation - Operation type
 * @param {object} customOptions - Custom options
 * @returns {Promise<object>} Transaction receipt
 */
export async function executeWithOptimalGas(txFunction, operation = 'DEFAULT', customOptions = {}) {
  try {
    // Try estimation first
    const gasOptions = await estimateGasWithFallback(txFunction, operation);
    
    // Merge with custom options
    const finalOptions = { ...gasOptions, ...customOptions };
    
    console.log(`⛽ ${operation}: ${finalOptions.gasLimit} gas @ ${finalOptions.maxFeePerGas / 1e9} gwei`);
    
    // Execute transaction
    const tx = await txFunction(finalOptions);
    const receipt = await tx.wait();
    
    const gasUsed = Number(receipt.gasUsed);
    const gasSaved = finalOptions.gasLimit - gasUsed;
    const savingsPercent = ((gasSaved / finalOptions.gasLimit) * 100).toFixed(1);
    
    console.log(`✅ ${operation}: Used ${gasUsed} gas (${savingsPercent}% under limit)`);
    
    return receipt;
  } catch (error) {
    console.error(`❌ ${operation} failed:`, error);
    throw error;
  }
}

/**
 * Batch transactions with optimized gas
 * @param {Array<{fn: Function, operation: string}>} transactions
 * @returns {Promise<Array>} Array of receipts
 */
export async function executeBatch(transactions) {
  console.log(`🔄 Executing ${transactions.length} transactions...`);
  const receipts = [];
  let totalGasUsed = 0;
  
  for (const { fn, operation } of transactions) {
    try {
      const receipt = await executeWithOptimalGas(fn, operation);
      receipts.push(receipt);
      totalGasUsed += Number(receipt.gasUsed);
    } catch (error) {
      console.error(`Failed to execute ${operation}:`, error);
      throw error;
    }
  }
  
  console.log(`✅ Batch complete. Total gas: ${totalGasUsed}`);
  return receipts;
}

/**
 * Token approval with ultra-low gas
 */
export async function approveToken(tokenContract, spender, amount) {
  return executeWithOptimalGas(
    (opts) => tokenContract.approve(spender, amount, opts),
    'TOKEN_APPROVE'
  );
}

/**
 * Vault deposit with ultra-low gas
 */
export async function depositToVault(vaultContract, amount) {
  return executeWithOptimalGas(
    (opts) => vaultContract.deposit(amount, opts),
    'VAULT_DEPOSIT'
  );
}

/**
 * Staking with ultra-low gas
 */
export async function stakeTokens(vaultContract, amount, lockDays) {
  return executeWithOptimalGas(
    (opts) => vaultContract.stake(amount, lockDays, opts),
    'VAULT_STAKE'
  );
}

/**
 * Loan creation with optimized gas
 */
export async function createLoan(vaultContract, publisher, principal, termDays, payInAppEx, appexPercentage) {
  return executeWithOptimalGas(
    (opts) => vaultContract.createLoan(publisher, principal, termDays, payInAppEx, appexPercentage, opts),
    'LOAN_CREATE'
  );
}

/**
 * Loan repayment with optimized gas
 */
export async function repayLoan(vaultContract, loanId, payFeeInAppEx) {
  return executeWithOptimalGas(
    (opts) => vaultContract.repayLoan(loanId, payFeeInAppEx, opts),
    'LOAN_REPAY'
  );
}

/**
 * Check if contract is gas-optimized version
 * @param {object} contract - Contract instance
 * @returns {Promise<boolean>} True if optimized
 */
export async function isOptimizedContract(contract) {
  try {
    // Try to call a function with minimal gas
    const gasOptions = getGasOptions('DEFAULT');
    await contract.estimateGas.getNAV?.();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get gas price recommendation
 * @returns {object} Gas price settings
 */
export function getGasPriceRecommendation() {
  return {
    slow: { maxFeePerGas: 1000000000, maxPriorityFeePerGas: 500000000 },      // 1 gwei / 0.5 gwei
    standard: { maxFeePerGas: 2000000000, maxPriorityFeePerGas: 1000000000 }, // 2 gwei / 1 gwei (default)
    fast: { maxFeePerGas: 3000000000, maxPriorityFeePerGas: 2000000000 }      // 3 gwei / 2 gwei
  };
}

// Export all utilities
export default {
  GAS_LIMITS,
  getGasOptions,
  estimateGasWithFallback,
  executeWithOptimalGas,
  executeBatch,
  approveToken,
  depositToVault,
  stakeTokens,
  createLoan,
  repayLoan,
  isOptimizedContract,
  getGasPriceRecommendation,
};
