'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  DollarSign,
  Percent,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Coins,
  BarChart3,
  RefreshCw,
  Droplets,
  Fuel,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useVaultStats, useTokenBalances, useLPPosition, useFaucet } from '@/hooks/useContracts';
import { Card, StatDisplay, Button, Skeleton, Badge } from '@/components/ui';
import { formatUSDC, formatToken, formatLP, formatPercentage, formatRelativeTime, cn } from '@/lib/utils';
import { getContractAddresses } from '@/contracts';
import { ethers } from 'ethers';

export const DashboardOverview = () => {
  const { user, selectedRole, transactions } = useAppStore();
  const { vaultStats, isLoading: statsLoading, refetch: refetchStats, error: vaultError, isContractDeployed } = useVaultStats();
  const { lpPosition, isLoading: positionLoading, refetch: refetchPosition } = useLPPosition();
  const { balances, refetch: refetchBalances, isLoading: balancesLoading } = useTokenBalances();
  const { requestEth, mintUsdc, isRequestingEth, isMintingUsdc } = useFaucet();
  const addresses = getContractAddresses();

  const handleRefresh = () => {
    refetchStats();
    refetchPosition();
    refetchBalances();
  };

  const handleRequestEth = async () => {
    const success = await requestEth('10');
    if (success) {
      setTimeout(refetchBalances, 1000);
    }
  };

  const handleMintUsdc = async () => {
    const success = await mintUsdc('10000');
    if (success) {
      setTimeout(refetchBalances, 1000);
    }
  };

  // Deduplicate transactions by hash
  const recentTransactions = useMemo(() => {
    const seen = new Set<string>();
    return transactions.filter(tx => {
      if (seen.has(tx.hash)) return false;
      seen.add(tx.hash);
      return true;
    }).slice(0, 5);
  }, [transactions]);
  const isRefreshing = statsLoading || positionLoading || balancesLoading;

  // Format ETH balance
  const formatEth = (wei: bigint) => {
    return parseFloat(ethers.formatEther(wei)).toFixed(4);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">
            Welcome back{user?.name ? `, ${user.name}` : ''}! 👋
          </h2>
          <p className="text-surface-400 mt-1">
            Here's what's happening with your {selectedRole} activities.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Contract Status Alert */}
      {isContractDeployed === false && (
        <Card className="p-4 border-2 border-error/50 bg-error/10">
          <div className="flex items-start gap-4">
            <XCircle className="w-6 h-6 text-error flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-error">Contracts Not Deployed</h3>
              <p className="text-sm text-surface-300 mt-1">
                The smart contracts are not deployed at the configured addresses. Please deploy them to Anvil first.
              </p>
              <div className="mt-3 p-3 bg-surface-900 rounded-lg text-xs font-mono">
                <p>Expected addresses:</p>
                <p className="text-surface-400">Vault: {addresses.paymentsVault}</p>
                <p className="text-surface-400">USDC: {addresses.usdc}</p>
                <p className="text-surface-400">APPEX: {addresses.appexToken}</p>
              </div>
              <p className="text-sm text-surface-400 mt-3">
                Run: <code className="bg-surface-800 px-2 py-1 rounded">forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast</code>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Error Alert */}
      {vaultError && isContractDeployed !== false && (
        <Card className="p-4 border-2 border-warning/50 bg-warning/10">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-warning">Connection Issue</h3>
              <p className="text-sm text-surface-300 mt-1">{vaultError}</p>
              <p className="text-sm text-surface-400 mt-2">
                Make sure Anvil is running: <code className="bg-surface-800 px-2 py-1 rounded">anvil</code>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Faucet Section - For Local Testing */}
      <Card className="p-6 border-dashed border-2 border-appex-500/30 bg-appex-500/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-appex-500/20 flex items-center justify-center">
              <Droplets className="w-6 h-6 text-appex-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Test Faucets</h3>
              <p className="text-sm text-surface-400">Get test tokens for local development (Anvil only)</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleRequestEth}
              isLoading={isRequestingEth}
              leftIcon={<Fuel className="w-4 h-4" />}
              variant="secondary"
            >
              Get 10 ETH
            </Button>
            <Button
              onClick={handleMintUsdc}
              isLoading={isMintingUsdc}
              leftIcon={<DollarSign className="w-4 h-4" />}
              disabled={isContractDeployed === false}
            >
              Mint 10,000 USDC
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {statsLoading ? (
            <Card className="p-4">
              <Skeleton className="h-20 w-full" />
            </Card>
          ) : (
            <StatDisplay
              label="Total Value Locked"
              value={vaultStats ? `$${formatUSDC(vaultStats.totalAssets)}` : '$0.00'}
              subValue="Protocol TVL"
              icon={<Wallet className="w-5 h-5 text-appex-400" />}
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {statsLoading ? (
            <Card className="p-4">
              <Skeleton className="h-20 w-full" />
            </Card>
          ) : (
            <StatDisplay
              label="NAV Per Share"
              value={vaultStats ? `$${vaultStats.navPerShare.toFixed(4)}` : '$1.0000'}
              subValue="LP Token Value"
              icon={<TrendingUp className="w-5 h-5 text-success" />}
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {statsLoading ? (
            <Card className="p-4">
              <Skeleton className="h-20 w-full" />
            </Card>
          ) : (
            <StatDisplay
              label="Outstanding Loans"
              value={vaultStats ? `$${formatUSDC(vaultStats.totalLoansOutstanding)}` : '$0.00'}
              subValue={`${vaultStats?.utilizationRate.toFixed(1) || 0}% utilization`}
              icon={<Activity className="w-5 h-5 text-vault" />}
            />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {statsLoading ? (
            <Card className="p-4">
              <Skeleton className="h-20 w-full" />
            </Card>
          ) : (
            <StatDisplay
              label="Total Supply"
              value={vaultStats ? formatLP(vaultStats.totalSupply) : '0'}
              subValue="LP Tokens Minted"
              icon={<Coins className="w-5 h-5 text-staking" />}
            />
          )}
        </motion.div>
      </div>

      {/* Your Position & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Your Position */}
        <Card className="lg:col-span-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Your Balances</h3>
            {balancesLoading && <RefreshCw className="w-4 h-4 animate-spin text-surface-400" />}
          </div>
          <div className="space-y-5">
            {/* ETH Balance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Fuel className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-surface-400">ETH Balance</p>
                  <p className="font-semibold">{formatEth(balances.eth)} ETH</p>
                </div>
              </div>
            </div>

            {/* USDC Balance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-appex-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-appex-400" />
                </div>
                <div>
                  <p className="text-sm text-surface-400">USDC Balance</p>
                  <p className="font-semibold">${formatUSDC(balances.usdc)}</p>
                </div>
              </div>
            </div>

            {/* LP Token Balance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-vault/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-vault" />
                </div>
                <div>
                  <p className="text-sm text-surface-400">LP Tokens</p>
                  <p className="font-semibold">{formatLP(balances.lpToken)}</p>
                </div>
              </div>
            </div>

            {/* APPEX Balance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-staking/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-staking" />
                </div>
                <div>
                  <p className="text-sm text-surface-400">APPEX Balance</p>
                  <p className="font-semibold">{formatToken(balances.appex)}</p>
                </div>
              </div>
            </div>

            {/* Staked Position */}
            {lpPosition && lpPosition.stakedAppex > 0n && (
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-governance/20 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-governance" />
                    </div>
                    <div>
                      <p className="text-sm text-surface-400">Staked APPEX</p>
                      <p className="font-semibold">{formatToken(lpPosition.stakedAppex)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-surface-400">Pending Rewards</span>
                  <span className="text-success font-medium">
                    +{formatToken(lpPosition.pendingRewards)} APPEX
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => useAppStore.getState().setActiveTab('history')}
            >
              View All
            </Button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-12 text-surface-400">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No recent transactions</p>
              <p className="text-sm mt-1">Your activity will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentTransactions.map((tx, index) => (
                <motion.div
                  key={tx.hash}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-surface-800/30 hover:bg-surface-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      tx.type === 'deposit' && 'bg-success/20',
                      tx.type === 'withdraw' && 'bg-error/20',
                      tx.type === 'stake' && 'bg-staking/20',
                      tx.type === 'unstake' && 'bg-staking/20',
                      tx.type === 'claim' && 'bg-governance/20',
                    )}>
                      {tx.type === 'deposit' && <ArrowDownRight className="w-5 h-5 text-success" />}
                      {tx.type === 'withdraw' && <ArrowUpRight className="w-5 h-5 text-error" />}
                      {(tx.type === 'stake' || tx.type === 'unstake') && <Coins className="w-5 h-5 text-staking" />}
                      {tx.type === 'claim' && <Activity className="w-5 h-5 text-governance" />}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{tx.type}</p>
                      <p className="text-sm text-surface-400">
                        {formatRelativeTime(tx.timestamp / 1000)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'font-medium',
                      tx.type === 'deposit' && 'text-success',
                      tx.type === 'withdraw' && 'text-error',
                    )}>
                      {tx.type === 'deposit' ? '+' : tx.type === 'withdraw' ? '-' : ''}
                      {tx.amount > 0n ? (
                        (tx.type === 'stake' || tx.type === 'unstake' || tx.type === 'claim') 
                          ? `${formatToken(tx.amount)} APPEX`
                          : `$${formatUSDC(tx.amount)}`
                      ) : '—'}
                    </p>
                    <Badge variant={tx.status === 'confirmed' ? 'success' : tx.status === 'failed' ? 'error' : 'warning'}>
                      {tx.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="secondary"
            className="flex-col h-auto py-6 gap-2"
            onClick={() => useAppStore.getState().setActiveTab('vault')}
          >
            <ArrowDownRight className="w-6 h-6 text-success" />
            <span>Deposit USDC</span>
          </Button>
          <Button
            variant="secondary"
            className="flex-col h-auto py-6 gap-2"
            onClick={() => useAppStore.getState().setActiveTab('staking')}
          >
            <Coins className="w-6 h-6 text-staking" />
            <span>Stake APPEX</span>
          </Button>
          <Button
            variant="secondary"
            className="flex-col h-auto py-6 gap-2"
            onClick={() => useAppStore.getState().setActiveTab('governance')}
          >
            <Activity className="w-6 h-6 text-governance" />
            <span>Vote</span>
          </Button>
          <Button
            variant="secondary"
            className="flex-col h-auto py-6 gap-2"
            onClick={() => useAppStore.getState().setActiveTab('history')}
          >
            <BarChart3 className="w-6 h-6 text-vault" />
            <span>View History</span>
          </Button>
        </div>
      </Card>

      {/* Contract Info */}
      <Card className="p-6 bg-surface-800/30">
        <h3 className="text-lg font-semibold mb-4">Contract Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-surface-400">Connected Address</p>
            <p className="font-mono text-surface-200 break-all">{user?.address || 'Not connected'}</p>
          </div>
          <div>
            <p className="text-surface-400">Network</p>
            <p className="text-surface-200">
              {process.env.NEXT_PUBLIC_CHAIN_ID === '31337' ? 'Anvil (Local)' : 
               process.env.NEXT_PUBLIC_CHAIN_ID === '1' ? 'Ethereum Mainnet' : 
               process.env.NEXT_PUBLIC_CHAIN_ID === '11155111' ? 'Sepolia Testnet' : 
               `Chain ID: ${process.env.NEXT_PUBLIC_CHAIN_ID}`}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
