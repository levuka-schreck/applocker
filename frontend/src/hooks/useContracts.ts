'use client';

import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAppStore } from '@/lib/store';
import { 
  PaymentsVaultABI, 
  AppExTokenABI, 
  MockUSDCABI, 
  LPTokenABI,
  VaultLensABI,
  getContractAddresses 
} from '@/contracts';
import { parseUSDC, parseToken } from '@/lib/utils';

// Hook to get contract instances
export const useContracts = () => {
  const { signer, provider } = useAppStore();
  const addresses = getContractAddresses();

  const getVaultContract = useCallback(() => {
    if (!signer) return null;
    return new ethers.Contract(addresses.paymentsVault, PaymentsVaultABI, signer);
  }, [signer, addresses.paymentsVault]);

  const getAppexContract = useCallback(() => {
    if (!signer) return null;
    return new ethers.Contract(addresses.appexToken, AppExTokenABI, signer);
  }, [signer, addresses.appexToken]);

  const getUsdcContract = useCallback(() => {
    if (!signer) return null;
    return new ethers.Contract(addresses.usdc, MockUSDCABI, signer);
  }, [signer, addresses.usdc]);

  const getLpTokenContract = useCallback(() => {
    if (!signer) return null;
    return new ethers.Contract(addresses.lpToken, LPTokenABI, signer);
  }, [signer, addresses.lpToken]);

  // Read-only contracts using provider
  const getVaultContractReadOnly = useCallback(() => {
    const rpcProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    return new ethers.Contract(addresses.paymentsVault, PaymentsVaultABI, rpcProvider);
  }, [provider, addresses.paymentsVault]);

  // VaultLens for complex view functions (deployed separately to reduce main contract size)
  const getVaultLensContract = useCallback(() => {
    const rpcProvider = provider || new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    return new ethers.Contract(addresses.vaultLens, VaultLensABI, rpcProvider);
  }, [provider, addresses.vaultLens]);

  return {
    getVaultContract,
    getAppexContract,
    getUsdcContract,
    getLpTokenContract,
    getVaultContractReadOnly,
    getVaultLensContract,
    addresses,
  };
};

// Hook to fetch vault statistics
export const useVaultStats = () => {
  const { addNotification } = useAppStore();
  const { getVaultContractReadOnly, addresses } = useContracts();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContractDeployed, setIsContractDeployed] = useState<boolean | null>(null);
  const [vaultStats, setLocalVaultStats] = useState<{
    totalAssets: bigint;
    totalSupply: bigint;
    totalLoansOutstanding: bigint;
    accruedFees: bigint;        // Pending fees on active loans
    collectedFees: bigint;      // Realized LP fees from repaid loans
    totalLPFees: bigint;        // Total LP fees (pending + collected)
    protocolFees: bigint;       // Protocol fees collected
    navPerShare: number;
    utilizationRate: number;
    totalDeposits: bigint;
    availableUSDC: bigint;
  } | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // First check if the contract is deployed
      const rpcProvider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const code = await rpcProvider.getCode(addresses.paymentsVault);
      
      if (code === '0x') {
        setIsContractDeployed(false);
        setError(`Vault contract not deployed at ${addresses.paymentsVault}. Please deploy contracts first.`);
        console.error('Vault contract not deployed at:', addresses.paymentsVault);
        return;
      }
      
      setIsContractDeployed(true);
      const vault = getVaultContractReadOnly();
      
      // Get LPToken address and create contract for totalSupply
      const lpTokenAddress = await vault.lpToken();
      const lpTokenContract = new ethers.Contract(lpTokenAddress, LPTokenABI, rpcProvider);
      
      console.log('Fetching vault stats from:', addresses.paymentsVault);
      console.log('LP Token at:', lpTokenAddress);
      
      // Use the ACTUAL function names from PaymentsVault.sol
      const [
        nav,                    // getNAV() - total value
        totalDeposits,          // totalDeposits()
        totalLoansOutstanding,  // totalLoansOutstanding()
        totalAccruedFees,       // totalAccruedFees() - pending fees on active loans
        totalCollectedFees,     // totalCollectedFees() - realized LP fees from repaid loans
        totalProtocolFees,      // totalProtocolFees() - realized protocol fees
        availableUSDC,          // getAvailableUSDC()
        lpTotalSupply,          // from LPToken contract
      ] = await Promise.all([
        vault.getNAV(),
        vault.totalDeposits(),
        vault.totalLoansOutstanding(),
        vault.totalAccruedFees(),
        vault.totalCollectedFees().catch(() => 0n), // Handle old contract without this
        vault.totalProtocolFees().catch(() => 0n),  // Handle old contract without this
        vault.getAvailableUSDC(),
        lpTokenContract.totalSupply(),
      ]);

      // Total LP fees = pending (on active loans) + collected (from repaid loans)
      const totalLPFees = totalAccruedFees + totalCollectedFees;

      console.log('Vault stats fetched:', {
        nav: nav.toString(),
        totalDeposits: totalDeposits.toString(),
        totalLoansOutstanding: totalLoansOutstanding.toString(),
        totalAccruedFees: totalAccruedFees.toString(),
        totalCollectedFees: totalCollectedFees.toString(),
        totalProtocolFees: totalProtocolFees.toString(),
        totalLPFees: totalLPFees.toString(),
        lpTotalSupply: lpTotalSupply.toString(),
      });

      // NAV per share calculation (18 decimals for LP tokens)
      const navPerShareRaw = lpTotalSupply > 0n 
        ? Number(nav * BigInt(1e6) / lpTotalSupply) / 1e6
        : 1;
      
      // Utilization rate: loans / (loans + available)
      const totalValue = nav > 0n ? nav : 1n;
      const utilizationRate = Number(totalLoansOutstanding * 10000n / totalValue) / 100;

      setLocalVaultStats({
        totalAssets: nav,  // Map getNAV() to totalAssets for compatibility
        totalSupply: lpTotalSupply,
        totalLoansOutstanding,
        accruedFees: totalAccruedFees,      // Pending fees on active loans
        collectedFees: totalCollectedFees,  // Realized LP fees from repaid loans
        totalLPFees,                        // Total LP fees (pending + collected)
        protocolFees: totalProtocolFees,    // Protocol fees collected
        navPerShare: navPerShareRaw,
        utilizationRate,
        totalDeposits,
        availableUSDC,
      });
    } catch (error) {
      console.error('Failed to fetch vault stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch vault stats');
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContractReadOnly, addresses.paymentsVault]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { vaultStats, isLoading, refetch, error, isContractDeployed };
};

// Hook to fetch LP position
export const useLPPosition = () => {
  const { user, addNotification } = useAppStore();
  const { getVaultContractReadOnly, addresses } = useContracts();
  const [isLoading, setIsLoading] = useState(true);
  const [lpPosition, setLocalLPPosition] = useState<{
    shares: bigint;
    assetsValue: bigint;
    stakedAppex: bigint;
    stakingCap: bigint;
    pendingRewards: bigint;
  } | null>(null);

  const refetch = useCallback(async () => {
    if (!user?.address) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const rpcProvider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const vault = getVaultContractReadOnly();
      
      // Get LPToken address from vault and create contract
      const lpTokenAddress = await vault.lpToken();
      const lpTokenContract = new ethers.Contract(lpTokenAddress, LPTokenABI, rpcProvider);
      
      // Fetch LP token balance from LPToken contract (not vault)
      const lpTokenBalance = await lpTokenContract.balanceOf(user.address);
      
      // Get staking position from vault - returns struct (appexStaked, lockDuration, lockEnd, pendingRewards)
      const stakingPosition = await vault.stakingPositions(user.address);
      const stakedAppex = stakingPosition[0] || 0n;  // appexStaked
      const pendingRewards = stakingPosition[3] || 0n;  // pendingRewards
      
      // Get staking multiplier
      const multiplier = await vault.stakingMultiplier();
      
      // Calculate staking cap: (LP balance * multiplier * 10^12) / 100
      // LP tokens have 6 decimals, APPEX has 18 decimals
      // Scale by 10^12 to convert LP token scale to APPEX scale
      const stakingCap = (BigInt(lpTokenBalance.toString()) * BigInt(multiplier.toString()) * BigInt(10**12)) / 100n;
      
      // Calculate USD value of LP tokens
      // Value = (LP Balance * NAV) / Total LP Supply
      const [nav, lpTotalSupply] = await Promise.all([
        vault.getNAV(),
        lpTokenContract.totalSupply(),
      ]);
      
      // Note: NAV is in 6 decimals (USDC), LP tokens are also 6 decimals
      // usdcValue = (lpBalance * nav) / lpTotalSupply gives us 6 decimal result
      // Fallback to 0 if no supply (can't have LP tokens without supply anyway)
      const usdcValue = BigInt(lpTotalSupply.toString()) > 0n 
        ? (BigInt(lpTokenBalance.toString()) * BigInt(nav.toString())) / BigInt(lpTotalSupply.toString())
        : 0n;

      setLocalLPPosition({
        shares: lpTokenBalance,
        assetsValue: usdcValue,
        stakedAppex,
        stakingCap,
        pendingRewards,
      });
    } catch (error) {
      console.error('Failed to fetch LP position:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.address, getVaultContractReadOnly]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { lpPosition, isLoading, refetch };
};

// Hook for deposit operations
export const useDeposit = () => {
  const { user, addNotification, addTransaction, updateTransaction } = useAppStore();
  const { getVaultContract, getUsdcContract, addresses } = useContracts();
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const deposit = useCallback(async (amount: string): Promise<boolean> => {
    const vault = getVaultContract();
    const usdc = getUsdcContract();
    
    if (!vault || !usdc || !user?.address) {
      addNotification({
        type: 'error',
        title: 'Not connected',
        message: 'Please connect your wallet first',
      });
      return false;
    }

    try {
      setIsLoading(true);
      const amountBigInt = parseUSDC(amount);
      const signerAddress = user.address;
      
      // Check allowance and approve if needed
      const allowance = await usdc.allowance(signerAddress, addresses.paymentsVault);
      
      if (allowance < amountBigInt) {
        setIsApproving(true);
        const approveTx = await usdc.approve(addresses.paymentsVault, amountBigInt);
        addTransaction({
          hash: approveTx.hash,
          type: 'deposit',
          amount: amountBigInt,
          status: 'pending',
          from: signerAddress!,
        });
        await approveTx.wait();
        updateTransaction(approveTx.hash, { status: 'confirmed' });
        setIsApproving(false);
      }

      // Deposit - contract only takes amount, not receiver
      const tx = await vault.deposit(amountBigInt);
      addTransaction({
        hash: tx.hash,
        type: 'deposit',
        amount: amountBigInt,
        status: 'pending',
        from: signerAddress!,
      });
      
      addNotification({
        type: 'info',
        title: 'Deposit pending',
        message: `Depositing ${amount} USDC...`,
      });

      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({
        type: 'success',
        title: 'Deposit successful',
        message: `Successfully deposited ${amount} USDC`,
      });

      return true;
    } catch (error: unknown) {
      console.error('Deposit failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification({
        type: 'error',
        title: 'Deposit failed',
        message: errorMessage,
      });
      return false;
    } finally {
      setIsLoading(false);
      setIsApproving(false);
    }
  }, [getVaultContract, getUsdcContract, addresses, addNotification, addTransaction, updateTransaction]);

  return { deposit, isLoading, isApproving };
};

// Hook for withdraw operations (uses redemption queue in this contract)
export const useWithdraw = () => {
  const { user, addNotification, addTransaction, updateTransaction } = useAppStore();
  const { getVaultContract, getLpTokenContract, addresses } = useContracts();
  const [isLoading, setIsLoading] = useState(false);

  // Request redemption - queues LP tokens for redemption
  const requestRedemption = useCallback(async (lpTokenAmount: string): Promise<boolean> => {
    const vault = getVaultContract();
    const lpToken = getLpTokenContract();
    
    if (!vault || !lpToken || !user?.address) {
      addNotification({
        type: 'error',
        title: 'Not connected',
        message: 'Please connect your wallet first',
      });
      return false;
    }

    try {
      setIsLoading(true);
      const amountBigInt = parseToken(lpTokenAmount);
      const signerAddress = user.address;

      // Approve LP tokens to vault if needed
      const allowance = await lpToken.allowance(signerAddress, addresses.paymentsVault);
      
      if (allowance < amountBigInt) {
        addNotification({
          type: 'info',
          title: 'Approving LP tokens',
          message: 'Please approve the transaction...',
        });
        const approveTx = await lpToken.approve(addresses.paymentsVault, amountBigInt);
        await approveTx.wait();
      }

      const tx = await vault.requestRedemption(amountBigInt);
      addTransaction({
        hash: tx.hash,
        type: 'withdraw',
        amount: amountBigInt,
        status: 'pending',
        from: signerAddress!,
      });
      
      addNotification({
        type: 'info',
        title: 'Redemption requested',
        message: 'Your redemption has been queued...',
      });

      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({
        type: 'success',
        title: 'Redemption queued',
        message: `Successfully queued ${lpTokenAmount} LP tokens for redemption`,
      });

      return true;
    } catch (error: unknown) {
      console.error('Redemption request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification({
        type: 'error',
        title: 'Redemption failed',
        message: errorMessage,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, getLpTokenContract, addresses, addNotification, addTransaction, updateTransaction, user?.address]);

  // Process redemptions - processes the redemption queue
  const processRedemptions = useCallback(async (): Promise<boolean> => {
    const vault = getVaultContract();
    
    if (!vault || !user?.address) {
      addNotification({
        type: 'error',
        title: 'Not connected',
        message: 'Please connect your wallet first',
      });
      return false;
    }

    try {
      setIsLoading(true);

      const tx = await vault.processRedemptions();
      
      addNotification({
        type: 'info',
        title: 'Processing redemptions',
        message: 'Processing the redemption queue...',
      });

      await tx.wait();
      
      addNotification({
        type: 'success',
        title: 'Redemptions processed',
        message: 'Successfully processed redemption queue',
      });

      return true;
    } catch (error: unknown) {
      console.error('Process redemptions failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification({
        type: 'error',
        title: 'Processing failed',
        message: errorMessage,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, addNotification, user?.address]);

  // Backwards compatibility aliases
  const withdraw = requestRedemption;
  const redeem = requestRedemption;

  return { withdraw, redeem, requestRedemption, processRedemptions, isLoading };
};

// Hook for staking operations
export const useStaking = () => {
  const { user, addNotification, addTransaction, updateTransaction } = useAppStore();
  const { getVaultContract, getAppexContract, addresses } = useContracts();
  const [isStaking, setIsStaking] = useState(false);

  const stake = useCallback(async (amount: string, lockDays: number) => {
    const vault = getVaultContract();
    const appex = getAppexContract();
    
    if (!vault || !appex || !user?.address) {
      addNotification({
        type: 'error',
        title: 'Not connected',
        message: 'Please connect your wallet first',
      });
      return;
    }

    try {
      setIsStaking(true);
      const amountBigInt = parseToken(amount);
      const signerAddress = user.address;
      
      // Check allowance and approve if needed
      const allowance = await appex.allowance(signerAddress, addresses.paymentsVault);
      
      if (allowance < amountBigInt) {
        const approveTx = await appex.approve(addresses.paymentsVault, amountBigInt);
        await approveTx.wait();
      }

      const tx = await vault.stake(amountBigInt, lockDays);
      addTransaction({
        hash: tx.hash,
        type: 'stake',
        amount: amountBigInt,
        status: 'pending',
        from: signerAddress!,
      });
      
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({
        type: 'success',
        title: 'Staking successful',
        message: `Successfully staked ${amount} APPEX`,
      });

      return tx;
    } catch (error: unknown) {
      console.error('Staking failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification({
        type: 'error',
        title: 'Staking failed',
        message: errorMessage,
      });
      throw error;
    } finally {
      setIsStaking(false);
    }
  }, [getVaultContract, getAppexContract, addresses, addNotification, addTransaction, updateTransaction]);

  const unstake = useCallback(async (amount: string) => {
    const vault = getVaultContract();
    
    if (!vault || !user?.address) {
      addNotification({
        type: 'error',
        title: 'Not connected',
        message: 'Please connect your wallet first',
      });
      return;
    }

    try {
      setIsStaking(true);
      const amountBigInt = parseToken(amount);
      const signerAddress = user.address;

      const tx = await vault.unstake(amountBigInt);
      addTransaction({
        hash: tx.hash,
        type: 'unstake',
        amount: amountBigInt,
        status: 'pending',
        from: signerAddress!,
      });
      
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({
        type: 'success',
        title: 'Unstaking successful',
        message: `Successfully unstaked ${amount} APPEX`,
      });

      return tx;
    } catch (error: unknown) {
      console.error('Unstaking failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification({
        type: 'error',
        title: 'Unstaking failed',
        message: errorMessage,
      });
      throw error;
    } finally {
      setIsStaking(false);
    }
  }, [getVaultContract, addNotification, addTransaction, updateTransaction]);

  const claimRewards = useCallback(async () => {
    const vault = getVaultContract();
    
    if (!vault || !user?.address) {
      addNotification({
        type: 'error',
        title: 'Not connected',
        message: 'Please connect your wallet first',
      });
      return;
    }

    try {
      setIsStaking(true);
      const signerAddress = user.address;

      const tx = await vault.claimRewards();
      addTransaction({
        hash: tx.hash,
        type: 'claim',
        amount: 0n,
        status: 'pending',
        from: signerAddress!,
      });
      
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({
        type: 'success',
        title: 'Rewards claimed',
        message: 'Successfully claimed your APPEX rewards',
      });

      return tx;
    } catch (error: unknown) {
      console.error('Claim rewards failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification({
        type: 'error',
        title: 'Claim failed',
        message: errorMessage,
      });
      throw error;
    } finally {
      setIsStaking(false);
    }
  }, [getVaultContract, addNotification, addTransaction, updateTransaction]);

  return { stake, unstake, claimRewards, isStaking };
};

// Hook for token balances
export const useTokenBalances = () => {
  const { user } = useAppStore();
  const { getVaultContractReadOnly } = useContracts();
  const [balances, setBalances] = useState({
    usdc: 0n,
    appex: 0n,
    lpToken: 0n,
    eth: 0n,
  });
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!user?.address) return;

    try {
      setIsLoading(true);
      
      // Use read-only provider for balance checks
      const rpcProvider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const addresses = getContractAddresses();
      
      const usdcContract = new ethers.Contract(addresses.usdc, MockUSDCABI, rpcProvider);
      const appexContract = new ethers.Contract(addresses.appexToken, AppExTokenABI, rpcProvider);
      
      // Get LP Token address from vault and create contract
      const vault = getVaultContractReadOnly();
      const lpTokenAddress = await vault.lpToken();
      const lpTokenContract = new ethers.Contract(lpTokenAddress, LPTokenABI, rpcProvider);

      const [usdc, appex, lpToken, ethBalance] = await Promise.all([
        usdcContract.balanceOf(user.address),
        appexContract.balanceOf(user.address),
        lpTokenContract.balanceOf(user.address), // Use LPToken contract, not vault
        rpcProvider.getBalance(user.address),
      ]);

      setBalances({ usdc, appex, lpToken, eth: ethBalance });
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.address, getVaultContractReadOnly]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { balances, refetch, isLoading };
};

// Hook for faucet operations (local testing only)
export const useFaucet = () => {
  const { user, addNotification, signer } = useAppStore();
  const { getUsdcContract } = useContracts();
  const [isLoading, setIsLoading] = useState(false);
  const [isMintingUsdc, setIsMintingUsdc] = useState(false);
  const [isRequestingEth, setIsRequestingEth] = useState(false);

  // Request test ETH from Anvil
  const requestEth = useCallback(async (amount: string = '10') => {
    if (!user?.address) {
      addNotification({
        type: 'error',
        title: 'Not connected',
        message: 'Please connect your wallet first',
      });
      return false;
    }

    try {
      setIsRequestingEth(true);
      
      // Use Anvil's special RPC method to set balance
      const rpcProvider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      const amountWei = ethers.parseEther(amount);
      
      // Get current balance and add to it
      const currentBalance = await rpcProvider.getBalance(user.address);
      const newBalance = currentBalance + amountWei;
      
      // Anvil's setBalance method
      await rpcProvider.send('anvil_setBalance', [
        user.address,
        '0x' + newBalance.toString(16)
      ]);

      addNotification({
        type: 'success',
        title: 'ETH Received',
        message: `Successfully received ${amount} ETH`,
      });

      return true;
    } catch (error) {
      console.error('ETH faucet failed:', error);
      addNotification({
        type: 'error',
        title: 'Faucet failed',
        message: 'Failed to request test ETH. Make sure you are connected to Anvil.',
      });
      return false;
    } finally {
      setIsRequestingEth(false);
    }
  }, [user?.address, addNotification]);

  // Mint test USDC using Anvil impersonation
  const mintUsdc = useCallback(async (amount: string = '10000') => {
    if (!user?.address) {
      addNotification({
        type: 'error',
        title: 'Not connected',
        message: 'Please connect your wallet first',
      });
      return false;
    }

    try {
      setIsMintingUsdc(true);
      const addresses = getContractAddresses();
      const rpcProvider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
      
      // USDC has 6 decimals
      const amountBigInt = BigInt(parseFloat(amount) * 1e6);
      
      // Get the USDC contract owner
      const usdcContract = new ethers.Contract(addresses.usdc, [...MockUSDCABI, "function owner() view returns (address)"], rpcProvider);
      const owner = await usdcContract.owner();
      
      console.log('USDC owner:', owner);
      console.log('Minting to:', user.address);
      
      // Impersonate the owner using Anvil
      await rpcProvider.send('anvil_impersonateAccount', [owner]);
      
      // Give the owner some ETH for gas
      await rpcProvider.send('anvil_setBalance', [
        owner,
        '0x' + ethers.parseEther('1').toString(16)
      ]);
      
      // Create a signer for the impersonated account
      const impersonatedSigner = await rpcProvider.getSigner(owner);
      const usdcWithSigner = new ethers.Contract(addresses.usdc, MockUSDCABI, impersonatedSigner);
      
      // Mint tokens
      const tx = await usdcWithSigner.mint(user.address, amountBigInt);
      await tx.wait();
      
      // Stop impersonating
      await rpcProvider.send('anvil_stopImpersonatingAccount', [owner]);

      addNotification({
        type: 'success',
        title: 'USDC Minted',
        message: `Successfully minted ${amount} USDC`,
      });

      return true;
    } catch (error) {
      console.error('USDC mint failed:', error);
      console.error('Full error:', JSON.stringify(error, null, 2));
      addNotification({
        type: 'error',
        title: 'Mint failed',
        message: 'Failed to mint test USDC. Make sure you are connected to Anvil.',
      });
      return false;
    } finally {
      setIsMintingUsdc(false);
    }
  }, [user?.address, addNotification]);

  return {
    requestEth,
    mintUsdc,
    isLoading: isRequestingEth || isMintingUsdc,
    isRequestingEth,
    isMintingUsdc,
  };
};

// Hook for governance operations
export const useGovernance = () => {
  const { user, addNotification, addTransaction, updateTransaction } = useAppStore();
  const { getVaultContract, getVaultContractReadOnly, addresses } = useContracts();
  const [isLoading, setIsLoading] = useState(false);
  const [governors, setGovernors] = useState<string[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [isGovernor, setIsGovernor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [governorCount, setGovernorCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);

  // Fetch governance data
  const refetch = useCallback(async () => {
    if (!user?.address) return;
    
    try {
      const vault = getVaultContractReadOnly();
      
      // Check if user is governor
      const isGov = await vault.isGovernor(user.address);
      setIsGovernor(isGov);
      
      // Check if user is owner
      const ownerAddress = await vault.owner();
      setIsOwner(ownerAddress.toLowerCase() === user.address.toLowerCase());
      
      // Check if user is admin
      try {
        const isAdm = await vault.isAdmin(user.address);
        setIsAdmin(isAdm);
      } catch {
        // Contract might not have admin functions yet - owner is default admin
        setIsAdmin(ownerAddress.toLowerCase() === user.address.toLowerCase());
      }
      
      // Get governor count
      const count = await vault.getGovernorCount();
      setGovernorCount(Number(count));
      
      // Get list of governors
      try {
        const result = await vault.getListOfGovernors();
        setGovernors(result.addresses || []);
      } catch {
        setGovernors([]);
      }
      
      // Get admin count
      try {
        const admCount = await vault.getAdminCount();
        setAdminCount(Number(admCount));
      } catch {
        // Contract might not have admin functions yet
        setAdminCount(1); // Just the owner
      }
      
      // Get list of admins
      try {
        const adminResult = await vault.getListOfAdmins();
        setAdmins(adminResult.addresses || []);
      } catch {
        // Contract might not have admin functions yet - show owner as admin
        setAdmins([ownerAddress]);
      }
    } catch (error) {
      console.error('Failed to fetch governance data:', error);
    }
  }, [user?.address, getVaultContractReadOnly]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Initialize first governor (owner only)
  const initializeGovernor = useCallback(async (governorAddress: string) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const tx = await vault.initializeGovernor(governorAddress);
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: 0n, status: 'pending', from: user.address });
      
      addNotification({ type: 'info', title: 'Initializing Governor', message: 'Transaction submitted...' });
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({ type: 'success', title: 'Governor Initialized', message: `${governorAddress.slice(0, 10)}... is now a governor` });
      
      refetch();
      return true;
    } catch (error: any) {
      console.error('Initialize governor failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to initialize governor' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction, refetch]);

  // Add governor (governor only)
  const addGovernor = useCallback(async (governorAddress: string) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const tx = await vault.addGovernor(governorAddress);
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: 0n, status: 'pending', from: user.address });
      
      addNotification({ type: 'info', title: 'Adding Governor', message: 'Transaction submitted...' });
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({ type: 'success', title: 'Governor Added', message: `${governorAddress.slice(0, 10)}... is now a governor` });
      
      refetch();
      return true;
    } catch (error: any) {
      console.error('Add governor failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to add governor' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction, refetch]);

  // Remove governor (governor only)
  const removeGovernor = useCallback(async (governorAddress: string) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const tx = await vault.removeGovernor(governorAddress);
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: 0n, status: 'pending', from: user.address });
      
      addNotification({ type: 'info', title: 'Removing Governor', message: 'Transaction submitted...' });
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({ type: 'success', title: 'Governor Removed', message: `${governorAddress.slice(0, 10)}... is no longer a governor` });
      
      refetch();
      return true;
    } catch (error: any) {
      console.error('Remove governor failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to remove governor' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction, refetch]);

  // Add admin (owner only)
  const addAdmin = useCallback(async (adminAddress: string) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const tx = await vault.addAdmin(adminAddress);
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: 0n, status: 'pending', from: user.address });
      
      addNotification({ type: 'info', title: 'Adding Admin', message: 'Transaction submitted...' });
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({ type: 'success', title: 'Admin Added', message: `${adminAddress.slice(0, 10)}... is now an admin` });
      
      refetch();
      return true;
    } catch (error: any) {
      console.error('Add admin failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to add admin' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction, refetch]);

  // Remove admin (owner only)
  const removeAdmin = useCallback(async (adminAddress: string) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const tx = await vault.removeAdmin(adminAddress);
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: 0n, status: 'pending', from: user.address });
      
      addNotification({ type: 'info', title: 'Removing Admin', message: 'Transaction submitted...' });
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({ type: 'success', title: 'Admin Removed', message: `${adminAddress.slice(0, 10)}... is no longer an admin` });
      
      refetch();
      return true;
    } catch (error: any) {
      console.error('Remove admin failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to remove admin' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction, refetch]);

  return {
    governors,
    admins,
    isGovernor,
    isAdmin,
    isOwner,
    governorCount,
    adminCount,
    initializeGovernor,
    addGovernor,
    removeGovernor,
    addAdmin,
    removeAdmin,
    isLoading,
    refetch,
  };
};

// Hook for borrower management
export const useBorrowerManagement = () => {
  const { user, addNotification, addTransaction, updateTransaction } = useAppStore();
  const { getVaultContract, getVaultContractReadOnly, getVaultLensContract, getUsdcContract, getAppexContract, addresses } = useContracts();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingProposals, setPendingProposals] = useState<Array<{
    id: string;
    borrower: string;
    limit: bigint;
    lpYieldRate: bigint;
    protocolFeeRate: bigint;
    approvals: number;
    proposedAt: number;
    scheduledAt: number;
    executeAfter: number;
    executed: boolean;
    ready: boolean;
  }>>([]);
  const [timelockAddress, setTimelockAddress] = useState<string | null>(null);

  // Check if timelock is set
  const checkTimelock = useCallback(async () => {
    try {
      const vault = getVaultContractReadOnly();
      const timelock = await vault.timelock();
      setTimelockAddress(timelock === '0x0000000000000000000000000000000000000000' ? null : timelock);
      return timelock !== '0x0000000000000000000000000000000000000000';
    } catch (error) {
      console.error('Failed to check timelock:', error);
      return false;
    }
  }, [getVaultContractReadOnly]);

  useEffect(() => {
    checkTimelock();
  }, [checkTimelock]);

  // Fetch borrower by address
  const getBorrower = useCallback(async (borrowerAddress: string) => {
    try {
      const vault = getVaultContractReadOnly();
      const data = await vault.borrowers(borrowerAddress);
      console.log('Borrower data from contract:', data);
      
      // Handle both old contract (5 fields) and new contract (8 fields)
      return {
        address: borrowerAddress,
        approved: data[0],
        borrowLimit: data[1],
        currentDebt: data[2],
        lpYieldRate: data[3],
        protocolFeeRate: data[4],
        // New fields - default to 0 if not present (old contract)
        totalBorrowed: data[5] ?? 0n,
        totalRepaid: data[6] ?? 0n,
        totalFeesPaid: data[7] ?? 0n,
      };
    } catch (error) {
      console.error('Failed to fetch borrower:', error);
      return null;
    }
  }, [getVaultContractReadOnly]);

  // Fetch current user's borrower status
  const [currentUserBorrower, setCurrentUserBorrower] = useState<{
    approved: boolean;
    borrowLimit: bigint;
    currentDebt: bigint;
    lpYieldRate: bigint;
    protocolFeeRate: bigint;
    totalBorrowed: bigint;
    totalRepaid: bigint;
    totalFeesPaid: bigint;
  } | null>(null);
  const [borrowerLoading, setBorrowerLoading] = useState(false);

  const refetchCurrentBorrower = useCallback(async () => {
    if (!user?.address) {
      setCurrentUserBorrower(null);
      return;
    }
    setBorrowerLoading(true);
    try {
      const result = await getBorrower(user.address);
      if (result) {
        setCurrentUserBorrower({
          approved: result.approved,
          borrowLimit: result.borrowLimit,
          currentDebt: result.currentDebt,
          lpYieldRate: result.lpYieldRate,
          protocolFeeRate: result.protocolFeeRate,
          totalBorrowed: result.totalBorrowed,
          totalRepaid: result.totalRepaid,
          totalFeesPaid: result.totalFeesPaid,
        });
      }
    } catch (error) {
      console.error('Failed to fetch current borrower:', error);
    } finally {
      setBorrowerLoading(false);
    }
  }, [user?.address, getBorrower]);

  useEffect(() => {
    refetchCurrentBorrower();
  }, [refetchCurrentBorrower]);

  // Propose a borrower (governor only) - this is the proper governance flow
  const proposeBorrower = useCallback(async (
    borrowerAddress: string,
    limit: string,
    lpYieldRate: number,
    protocolFeeRate: number
  ) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return null;
    }

    // Check if timelock is set (required for governance flow)
    const hasTimelock = await checkTimelock();
    if (!hasTimelock) {
      addNotification({ 
        type: 'warning', 
        title: 'Timelock Not Set', 
        message: 'Timelock must be configured before proposals can be executed. Contact the contract owner.' 
      });
    }

    try {
      setIsLoading(true);
      const limitBigInt = BigInt(parseFloat(limit) * 1e6); // USDC 6 decimals
      
      const tx = await vault.proposeBorrower(
        borrowerAddress,
        limitBigInt,
        lpYieldRate, // basis points
        protocolFeeRate // basis points
      );
      
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: limitBigInt, status: 'pending', from: user.address });
      addNotification({ type: 'info', title: 'Proposing Borrower', message: 'Transaction submitted...' });
      
      const receipt = await tx.wait();
      updateTransaction(tx.hash, { status: 'confirmed' });
      
      // Try to extract proposal ID from events
      let proposalId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = vault.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'BorrowerProposed') {
            proposalId = parsed.args[0];
            break;
          }
        } catch {}
      }
      
      addNotification({ 
        type: 'success', 
        title: 'Borrower Proposed', 
        message: `Proposal created for ${borrowerAddress.slice(0, 10)}... Needs ${2} governor approvals.` 
      });
      
      return proposalId;
    } catch (error: any) {
      console.error('Propose borrower failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to propose borrower' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction, checkTimelock]);

  // Approve borrower proposal (governor only)
  const approveProposal = useCallback(async (proposalId: string) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const tx = await vault.approveBorrowerProposal(proposalId);
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: 0n, status: 'pending', from: user.address });
      
      addNotification({ type: 'info', title: 'Approving Proposal', message: 'Transaction submitted...' });
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({ 
        type: 'success', 
        title: 'Proposal Approved', 
        message: 'Your approval has been recorded. If threshold is met, proposal will be scheduled in timelock.' 
      });
      
      return true;
    } catch (error: any) {
      console.error('Approve proposal failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to approve proposal' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction]);

  // Execute borrower proposal after timelock (anyone can call)
  const executeProposal = useCallback(async (proposalId: string) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const tx = await vault.executeBorrowerProposal(proposalId);
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: 0n, status: 'pending', from: user.address });
      
      addNotification({ type: 'info', title: 'Executing Proposal', message: 'Transaction submitted...' });
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({ 
        type: 'success', 
        title: 'Proposal Executed', 
        message: 'The borrower has been approved and can now access the protocol.' 
      });
      
      return true;
    } catch (error: any) {
      console.error('Execute proposal failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to execute proposal' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction]);

  // Get proposal status
  const getProposalStatus = useCallback(async (proposalId: string) => {
    try {
      const vault = getVaultContractReadOnly();
      const status = await vault.getProposalStatus(proposalId);
      return {
        ready: status[0],
        executeAfter: Number(status[1]),
        executed: status[2],
        approvals: Number(status[3])
      };
    } catch (error) {
      console.error('Failed to get proposal status:', error);
      return null;
    }
  }, [getVaultContractReadOnly]);

  // Set timelock (owner only)
  const setTimelock = useCallback(async (timelockAddr: string) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const tx = await vault.setTimelock(timelockAddr);
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: 0n, status: 'pending', from: user.address });
      
      addNotification({ type: 'info', title: 'Setting Timelock', message: 'Transaction submitted...' });
      await tx.wait();
      
      updateTransaction(tx.hash, { status: 'confirmed' });
      addNotification({ type: 'success', title: 'Timelock Set', message: 'Timelock controller has been configured.' });
      
      await checkTimelock();
      return true;
    } catch (error: any) {
      console.error('Set timelock failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to set timelock' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction, checkTimelock]);

  // Direct approve borrower (owner only - bypasses governance for dev/emergency)
  const approveBorrowerDirect = useCallback(async (
    borrowerAddress: string,
    limit: string,
    lpYieldRate: number,
    protocolFeeRate: number
  ) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      const limitBigInt = BigInt(parseFloat(limit) * 1e6); // USDC 6 decimals
      
      const tx = await vault.approveBorrower(
        borrowerAddress,
        limitBigInt,
        lpYieldRate, // basis points
        protocolFeeRate // basis points
      );
      
      addTransaction({ hash: tx.hash, type: 'governance' as any, amount: limitBigInt, status: 'pending', from: user.address });
      addNotification({ type: 'info', title: 'Approving Partner', message: 'Transaction submitted...' });
      
      await tx.wait();
      updateTransaction(tx.hash, { status: 'confirmed' });
      
      addNotification({ 
        type: 'success', 
        title: 'Partner Approved', 
        message: `${borrowerAddress.slice(0, 10)}... is now an approved partner company` 
      });
      
      return true;
    } catch (error: any) {
      console.error('Approve partner failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to approve partner' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction]);

  // Create a loan (borrower pays publisher)
  const createLoan = useCallback(async (
    publisherAddress: string,
    principal: string, // USDC amount as string
    termDays: number,
    payInAppex: boolean,
    appexPercentage: number
  ) => {
    const vault = getVaultContract();
    if (!vault || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return null;
    }

    try {
      setIsLoading(true);
      const principalBigInt = BigInt(Math.floor(parseFloat(principal) * 1e6)); // USDC 6 decimals
      
      const tx = await vault.createLoan(
        publisherAddress,
        principalBigInt,
        termDays,
        payInAppex,
        appexPercentage
      );
      
      addTransaction({ hash: tx.hash, type: 'borrow' as any, amount: principalBigInt, status: 'pending', from: user.address });
      addNotification({ type: 'info', title: 'Creating Loan', message: 'Transaction submitted...' });
      
      const receipt = await tx.wait();
      updateTransaction(tx.hash, { status: 'confirmed' });
      
      // Try to get loan ID from events
      let loanId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = vault.interface.parseLog(log);
          if (parsed?.name === 'LoanCreated') {
            loanId = parsed.args[0]; // First arg is loanId
            break;
          }
        } catch (e) {
          // Not our event, skip
        }
      }
      
      addNotification({ 
        type: 'success', 
        title: 'Payment Sent', 
        message: `$${principal} sent to publisher${loanId ? ` (Loan #${loanId})` : ''}` 
      });
      
      refetchCurrentBorrower();
      return loanId;
    } catch (error: any) {
      console.error('Create loan failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to create loan' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, user?.address, addNotification, addTransaction, updateTransaction, refetchCurrentBorrower]);

  // Loan data types
  interface LoanData {
    id: string;
    borrower: string;
    publisher: string;
    principal: bigint;
    lpFee: bigint;
    protocolFee: bigint;
    totalDue: bigint;
    startTime: number;
    termDays: number;
    endTime: number;
    repaid: boolean;
    protocolFeePaid: boolean;
    daysElapsed: number;
    isOverdue: boolean;
    accruedFees: bigint;
  }

  const [loans, setLoans] = useState<LoanData[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);

  // Fetch loans for the current user (borrower)
  const fetchLoans = useCallback(async () => {
    if (!user?.address) {
      setLoans([]);
      return;
    }
    
    setLoansLoading(true);
    try {
      const vaultLens = getVaultLensContract();
      console.log('Fetching loans for borrower:', user.address);
      // VaultLens.getLoansByBorrower(vault, borrower)
      const result = await vaultLens.getLoansByBorrower(addresses.paymentsVault, user.address);
      console.log('getLoansByBorrower result:', result);
      
      const loanIds = result[0] || result.loanIds || [];
      const loanDetails = result[1] || result.loanDetails || [];
      const count = result[2] || result.count || 0;
      
      console.log('Loan count:', count.toString(), 'IDs:', loanIds.map((id: any) => id.toString()));
      
      const fetchedLoans: LoanData[] = [];
      for (let i = 0; i < loanIds.length; i++) {
        const detail = loanDetails[i];
        console.log('Loan detail', i, ':', detail);
        fetchedLoans.push({
          id: loanIds[i].toString(),
          borrower: detail.borrower,
          publisher: detail.publisher,
          principal: BigInt(detail.principal.toString()),
          lpFee: BigInt(detail.lpFee.toString()),
          protocolFee: BigInt(detail.protocolFee.toString()),
          totalDue: BigInt(detail.totalDue.toString()),
          startTime: Number(detail.startTime),
          termDays: Number(detail.termDays),
          endTime: Number(detail.endTime),
          repaid: detail.repaid,
          // Handle old contract without protocolFeePaid field - default to false
          protocolFeePaid: detail.protocolFeePaid ?? false,
          daysElapsed: Number(detail.daysElapsed),
          isOverdue: detail.isOverdue,
          accruedFees: BigInt(detail.accruedFees.toString()),
        });
      }
      
      console.log('Fetched loans:', fetchedLoans);
      setLoans(fetchedLoans);
    } catch (error) {
      console.error('Failed to fetch loans:', error);
      setLoans([]);
    } finally {
      setLoansLoading(false);
    }
  }, [user?.address, getVaultLensContract, addresses.paymentsVault]);

  // Fetch loans when user changes
  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Repay loan - pays principal + LP fee (protocol fee paid separately)
  const repayLoan = useCallback(async (loanId: string): Promise<boolean> => {
    const vault = getVaultContract();
    const usdc = getUsdcContract();
    if (!vault || !usdc || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      
      // Get the loan details to know the amount
      const loan = loans.find(l => l.id === loanId);
      const repayAmount = loan ? loan.principal + loan.lpFee : 0n;
      
      if (repayAmount === 0n) {
        addNotification({ type: 'error', title: 'Error', message: 'Could not find loan details' });
        return false;
      }

      // Check USDC allowance and approve if needed
      const allowance = await usdc.allowance(user.address, addresses.paymentsVault);
      if (allowance < repayAmount) {
        addNotification({ type: 'info', title: 'Approval Required', message: 'Please approve USDC spending...' });
        const approveTx = await usdc.approve(addresses.paymentsVault, repayAmount);
        await approveTx.wait();
        addNotification({ type: 'success', title: 'Approved', message: 'USDC spending approved' });
      }
      
      // Now repay the loan
      const tx = await vault.repayLoan(BigInt(loanId));
      addTransaction({
        hash: tx.hash,
        type: 'repay',
        amount: repayAmount,
        status: 'pending',
        from: user.address,
      });

      addNotification({ type: 'info', title: 'Repaying Principal', message: 'Transaction submitted...' });
      
      const receipt = await tx.wait();
      updateTransaction(tx.hash, { status: receipt.status === 1 ? 'confirmed' : 'failed' });

      if (receipt.status === 1) {
        addNotification({ type: 'success', title: 'Principal Repaid', message: `Loan #${loanId} principal + LP fee repaid` });
        await refetchCurrentBorrower();
        await fetchLoans();
        return true;
      } else {
        addNotification({ type: 'error', title: 'Failed', message: 'Transaction failed' });
        return false;
      }
    } catch (error: any) {
      console.error('Repay loan failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to repay loan' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, getUsdcContract, addresses, user?.address, addNotification, addTransaction, updateTransaction, refetchCurrentBorrower, fetchLoans, loans]);

  // Pay protocol fee (can use APPEX for 25% discount)
  const payProtocolFee = useCallback(async (loanId: string, payInAppex: boolean): Promise<boolean> => {
    const vault = getVaultContract();
    const usdc = getUsdcContract();
    const appex = getAppexContract();
    if (!vault || !usdc || !appex || !user?.address) {
      addNotification({ type: 'error', title: 'Not connected', message: 'Please connect your wallet' });
      return false;
    }

    try {
      setIsLoading(true);
      
      const loan = loans.find(l => l.id === loanId);
      const protocolFee = loan ? loan.protocolFee : 0n;
      
      if (protocolFee === 0n) {
        addNotification({ type: 'error', title: 'Error', message: 'Could not find loan details' });
        return false;
      }

      if (payInAppex) {
        // Pay in APPEX with 25% discount
        // APPEX has 18 decimals, USDC has 6, so multiply by 10^12
        const discountedFee = (protocolFee * 75n) / 100n;
        const appexAmount = discountedFee * (10n ** 12n);
        
        // Check APPEX allowance and approve if needed
        const allowance = await appex.allowance(user.address, addresses.paymentsVault);
        if (allowance < appexAmount) {
          addNotification({ type: 'info', title: 'Approval Required', message: 'Please approve APPEX spending...' });
          const approveTx = await appex.approve(addresses.paymentsVault, appexAmount);
          await approveTx.wait();
          addNotification({ type: 'success', title: 'Approved', message: 'APPEX spending approved' });
        }
      } else {
        // Pay in USDC
        const allowance = await usdc.allowance(user.address, addresses.paymentsVault);
        if (allowance < protocolFee) {
          addNotification({ type: 'info', title: 'Approval Required', message: 'Please approve USDC spending...' });
          const approveTx = await usdc.approve(addresses.paymentsVault, protocolFee);
          await approveTx.wait();
          addNotification({ type: 'success', title: 'Approved', message: 'USDC spending approved' });
        }
      }
      
      const tx = await vault.payProtocolFee(BigInt(loanId), payInAppex);
      addTransaction({
        hash: tx.hash,
        type: 'payout',
        amount: protocolFee,
        status: 'pending',
        from: user.address,
      });

      addNotification({ type: 'info', title: 'Paying Protocol Fee', message: 'Transaction submitted...' });
      
      const receipt = await tx.wait();
      updateTransaction(tx.hash, { status: receipt.status === 1 ? 'confirmed' : 'failed' });

      if (receipt.status === 1) {
        const discountMsg = payInAppex ? ' (25% APPEX discount applied)' : '';
        addNotification({ type: 'success', title: 'Fee Paid', message: `Protocol fee paid${discountMsg}` });
        await refetchCurrentBorrower();
        await fetchLoans();
        return true;
      } else {
        addNotification({ type: 'error', title: 'Failed', message: 'Transaction failed' });
        return false;
      }
    } catch (error: any) {
      console.error('Pay protocol fee failed:', error);
      addNotification({ type: 'error', title: 'Failed', message: error.reason || error.message || 'Failed to pay fee' });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getVaultContract, getUsdcContract, getAppexContract, addresses, user?.address, addNotification, addTransaction, updateTransaction, refetchCurrentBorrower, fetchLoans, loans]);

  return {
    getBorrower,
    currentUserBorrower,
    refetchCurrentBorrower,
    borrowerStatusLoading: borrowerLoading,
    proposeBorrower,
    approveProposal,
    executeProposal,
    getProposalStatus,
    approveBorrowerDirect,
    createLoan,
    setTimelock,
    timelockAddress,
    checkTimelock,
    isLoading,
    // Loan management
    loans,
    loansLoading,
    fetchLoans,
    repayLoan,
    payProtocolFee,
  };
};
