import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3Auth } from '../contexts/Web3AuthContext';

// Contract ABIs (simplified for demo)
const VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function requestRedemption(uint256 lpTokenAmount) external",
  "function processRedemptions() external",
  "function createLoan(address publisher, uint256 principal, uint256 termDays, bool payInAppEx, uint256 appexPercentage) external returns (uint256)",
  "function repayLoan(uint256 loanId, bool payFeeInAppEx) external",
  "function stake(uint256 amount, uint256 lockDays) external",
  "function unstake(uint256 amount) external",
  "function getVaultStats() external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
  "function getBorrowerInfo(address) external view returns (bool, uint256, uint256, uint256, uint256, uint256)",
  "function getStakingInfo(address) external view returns (uint256, uint256, uint256, uint256, uint256)",
  "function lpToken() external view returns (address)",
  "function appexToken() external view returns (address)",
  "function usdc() external view returns (address)",
  "function approveBorrower(address borrower, uint256 limit, uint256 lpYieldRate, uint256 protocolFeeRate) external",
  "function revokeBorrower(address borrower) external",
  "function updateBorrowerLimit(address borrower, uint256 newLimit) external",
  "function owner() external view returns (address)",
  "function transferOwnership(address newOwner) external"
];

const ERC20_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function faucet() external"
];

export const useContracts = () => {
  const { getSigner, account, isConnected } = useWeb3Auth();
  const [contracts, setContracts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContracts = async () => {
      try {
        // Load contract addresses from .env first, fallback to localStorage
        const vaultAddress = import.meta.env.VITE_VAULT_ADDRESS || localStorage.getItem('VAULT_ADDRESS');
        const usdcAddress = import.meta.env.VITE_USDC_ADDRESS || localStorage.getItem('USDC_ADDRESS');
        const appexAddress = import.meta.env.VITE_APPEX_ADDRESS || localStorage.getItem('APPEX_ADDRESS');

        if (!vaultAddress || !usdcAddress || !appexAddress) {
          console.log('❌ Contract addresses not found.');
          console.log('Please set them in frontend/.env file:');
          console.log('VITE_VAULT_ADDRESS=0x...');
          console.log('VITE_USDC_ADDRESS=0x...');
          console.log('VITE_APPEX_ADDRESS=0x...');
          setLoading(false);
          return;
        }

        console.log('📝 Loading contracts...');
        console.log('Source:', import.meta.env.VITE_VAULT_ADDRESS ? '.env file' : 'localStorage');
        console.log('Vault:', vaultAddress);
        console.log('USDC:', usdcAddress);
        console.log('AppEx:', appexAddress);

        // Create provider (works with or without wallet connection)
        let provider, signer;
        
        if (isConnected) {
          // Use connected wallet
          signer = await getSigner();
          provider = signer.provider;
          console.log('👛 Using connected wallet:', account);
        } else {
          // Use read-only provider pointing to Anvil
          const rpcUrl = import.meta.env.VITE_RPC_URL || 'http://localhost:8545';
          provider = new ethers.JsonRpcProvider(rpcUrl);
          console.log('📡 Using read-only provider:', rpcUrl);
        }
        
        // Create contract instances
        const vault = new ethers.Contract(
          vaultAddress, 
          VAULT_ABI, 
          signer || provider
        );
        const usdc = new ethers.Contract(
          usdcAddress, 
          ERC20_ABI, 
          signer || provider
        );
        const appex = new ethers.Contract(
          appexAddress, 
          ERC20_ABI, 
          signer || provider
        );
        
        // Get LP token address from vault
        console.log('🔍 Fetching LP token address from vault...');
        const lpTokenAddress = await vault.lpToken();
        console.log('LP Token:', lpTokenAddress);
        
        const lpToken = new ethers.Contract(
          lpTokenAddress, 
          ERC20_ABI, 
          signer || provider
        );

        setContracts({
          vault,
          usdc,
          appex,
          lpToken,
          addresses: {
            vault: vaultAddress,
            usdc: usdcAddress,
            appex: appexAddress,
            lpToken: lpTokenAddress
          },
          canWrite: isConnected // Can only write if connected
        });
        
        console.log('✅ Contracts loaded successfully');
      } catch (error) {
        console.error('❌ Error loading contracts:', error);
        console.error('Checklist:');
        console.error('1. Is Anvil running? → anvil');
        console.error('2. Are addresses set in frontend/.env?');
        console.error('3. Are contracts deployed?');
      } finally {
        setLoading(false);
      }
    };

    loadContracts();
  }, [isConnected, account]);

  return { contracts, loading };
};

export const useVaultStats = (contracts) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!contracts?.vault) {
        setLoading(false);
        return;
      }

      try {
        const [nav, sharePrice, totalLPs, availableLiquidity, utilizationRate, activeLoansCount] = 
          await contracts.vault.getVaultStats();

        setStats({
          nav: ethers.formatUnits(nav, 6),
          sharePrice: ethers.formatUnits(sharePrice, 18),
          totalLPs: ethers.formatUnits(totalLPs, 18),
          availableLiquidity: ethers.formatUnits(availableLiquidity, 6),
          utilizationRate: Number(utilizationRate) / 100,
          activeLoansCount: Number(activeLoansCount)
        });
      } catch (error) {
        console.error('Error fetching vault stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [contracts]);

  return { stats, loading };
};

export const useUserBalances = (contracts, account) => {
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const fetchBalances = async () => {
      if (!contracts || !account) {
        setLoading(false);
        return;
      }

      try {
        const [usdcBalance, appexBalance, lpBalance] = await Promise.all([
          contracts.usdc.balanceOf(account),
          contracts.appex.balanceOf(account),
          contracts.lpToken.balanceOf(account)
        ]);

        setBalances({
          usdc: ethers.formatUnits(usdcBalance, 6),
          appex: ethers.formatUnits(appexBalance, 18),
          lpToken: ethers.formatUnits(lpBalance, 18)
        });
      } catch (error) {
        console.error('Error fetching balances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);

    // Listen for balance update events
    const handleBalanceUpdate = () => {
      console.log('Balance update event received, refreshing...');
      fetchBalances();
    };
    window.addEventListener('balanceUpdate', handleBalanceUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('balanceUpdate', handleBalanceUpdate);
    };
  }, [contracts, account, refreshTrigger]);

  return { balances, loading, refresh };
};

export const useBorrowerInfo = (contracts, account) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!contracts?.vault || !account) {
        setLoading(false);
        return;
      }

      try {
        const [approved, limit, currentDebt, available, lpYieldRate, protocolFeeRate] = 
          await contracts.vault.getBorrowerInfo(account);

        setInfo({
          approved,
          limit: ethers.formatUnits(limit, 6),
          currentDebt: ethers.formatUnits(currentDebt, 6),
          available: ethers.formatUnits(available, 6),
          lpYieldRate: Number(lpYieldRate) / 100,
          protocolFeeRate: Number(protocolFeeRate) / 100
        });
      } catch (error) {
        console.error('Error fetching borrower info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
    const interval = setInterval(fetchInfo, 10000);

    return () => clearInterval(interval);
  }, [contracts, account]);

  return { info, loading };
};

export const useStakingInfo = (contracts, account) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!contracts?.vault || !account) {
        setLoading(false);
        return;
      }

      try {
        const [staked, maxStake, lockEnd, multiplier, pendingRewards] = 
          await contracts.vault.getStakingInfo(account);

        setInfo({
          staked: ethers.formatUnits(staked, 18),
          maxStake: ethers.formatUnits(maxStake, 18),
          lockEnd: Number(lockEnd),
          multiplier: Number(multiplier),
          pendingRewards: ethers.formatUnits(pendingRewards, 18)
        });
      } catch (error) {
        console.error('Error fetching staking info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
    const interval = setInterval(fetchInfo, 10000);

    return () => clearInterval(interval);
  }, [contracts, account]);

  return { info, loading };
};
