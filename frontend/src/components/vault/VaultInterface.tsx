'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Percent,
  Info,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Coins,
  RefreshCw,
  ChevronDown,
  Lock,
  Unlock,
  Activity
} from 'lucide-react';
import { Card, Button, Input, Badge, Tabs, StatDisplay, ProgressBar, Tooltip, Modal } from '@/components/ui';
import { useAppStore } from '@/lib/store';
import { useVaultStats, useDeposit, useWithdraw, useLPPosition, useTokenBalances } from '@/hooks/useContracts';
import { formatUSDC, formatToken, formatLP, estimateAPY } from '@/lib/utils';

type Tab = 'deposit' | 'withdraw' | 'positions';

export const VaultInterface = () => {
  const [activeTab, setActiveTab] = useState<Tab>('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawType, setWithdrawType] = useState<'assets' | 'shares'>('assets');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'deposit' | 'withdraw' | null>(null);

  const { vaultStats, isLoading: statsLoading, refetch: refetchStats } = useVaultStats();
  const { lpPosition, isLoading: positionLoading, refetch: refetchPosition } = useLPPosition();
  const { balances, refetch: refetchBalances } = useTokenBalances();
  const { deposit, isLoading: depositLoading, isApproving } = useDeposit();
  const { withdraw, redeem, isLoading: withdrawLoading } = useWithdraw();

  const addNotification = useAppStore((state) => state.addNotification);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      addNotification({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Please enter a valid deposit amount'
      });
      return;
    }
    setPendingAction('deposit');
    setShowConfirmModal(true);
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      addNotification({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Please enter a valid withdraw amount'
      });
      return;
    }
    setPendingAction('withdraw');
    setShowConfirmModal(true);
  };

  const confirmAction = async () => {
    setShowConfirmModal(false);
    
    if (pendingAction === 'deposit') {
      const success = await deposit(depositAmount);
      if (success) {
        setDepositAmount('');
        refetchStats();
        refetchPosition();
        refetchBalances();
      }
    } else if (pendingAction === 'withdraw') {
      const success = withdrawType === 'assets' 
        ? await withdraw(withdrawAmount)
        : await redeem(withdrawAmount);
      if (success) {
        setWithdrawAmount('');
        refetchStats();
        refetchPosition();
        refetchBalances();
      }
    }
    setPendingAction(null);
  };

  const setMaxDeposit = () => {
    if (balances?.usdc) {
      setDepositAmount(formatUSDC(balances.usdc, false));
    }
  };

  const setMaxWithdraw = () => {
    if (withdrawType === 'assets' && lpPosition?.assetsValue) {
      setWithdrawAmount(formatUSDC(lpPosition.assetsValue, false));
    } else if (withdrawType === 'shares' && lpPosition?.shares) {
      setWithdrawAmount(formatLP(lpPosition.shares, false));
    }
  };

  const previewShares = depositAmount ? 
    (parseFloat(depositAmount) / (vaultStats?.navPerShare || 1)).toFixed(6) : '0';
  
  const previewAssets = withdrawType === 'shares' && withdrawAmount ?
    (parseFloat(withdrawAmount) * (vaultStats?.navPerShare || 1)).toFixed(2) : withdrawAmount;

  const tabs = [
    { id: 'deposit' as Tab, label: 'Deposit', icon: <ArrowDownToLine className="w-4 h-4" /> },
    { id: 'withdraw' as Tab, label: 'Withdraw', icon: <ArrowUpFromLine className="w-4 h-4" /> },
    { id: 'positions' as Tab, label: 'My Position', icon: <Coins className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vault to-appex-500 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            Payments Vault
          </h1>
          <p className="text-surface-400 mt-1">Provide liquidity and earn yield from borrower fees</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => { refetchStats(); refetchPosition(); refetchBalances(); }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Vault Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-vault/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-vault" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Total Value Locked</p>
              <p className="text-xl font-bold">${formatUSDC(vaultStats?.totalAssets || 0n)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-appex-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-appex-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">NAV Per Share</p>
              <p className="text-xl font-bold">${(vaultStats?.navPerShare || 1).toFixed(4)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-staking/20 flex items-center justify-center">
              <Percent className="w-5 h-5 text-staking" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Utilization Rate</p>
              <p className="text-xl font-bold">{(vaultStats?.utilizationRate || 0).toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-governance/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-governance" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Est. APY</p>
              <p className="text-xl font-bold text-appex-400">
                {estimateAPY(vaultStats?.utilizationRate || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Interface */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Action Panel */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={(tab) => setActiveTab(tab as Tab)}
            />

            <div className="mt-6">
              <AnimatePresence mode="wait">
                {activeTab === 'deposit' && (
                  <motion.div
                    key="deposit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* USDC Balance */}
                    <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                          $
                        </div>
                        <div>
                          <p className="text-sm text-surface-400">Available USDC</p>
                          <p className="font-semibold">{formatUSDC(balances?.usdc || 0n)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={setMaxDeposit}>
                        Max
                      </Button>
                    </div>

                    {/* Deposit Input */}
                    <div className="space-y-2">
                      <label className="text-sm text-surface-400">Deposit Amount (USDC)</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        leftElement={<DollarSign className="w-4 h-4" />}
                        className="text-xl"
                      />
                    </div>

                    {/* Preview */}
                    {depositAmount && parseFloat(depositAmount) > 0 && (
                      <div className="p-4 bg-appex-500/10 border border-appex-500/20 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-sm text-appex-400">
                          <Info className="w-4 h-4" />
                          <span>Transaction Preview</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-surface-400">You will receive</span>
                          <span className="font-semibold">{previewShares} LP Tokens</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-surface-400">At current NAV</span>
                          <span className="font-semibold">${vaultStats?.navPerShare?.toFixed(4) || '1.0000'}/share</span>
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleDeposit}
                      isLoading={depositLoading || isApproving}
                      disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                      leftIcon={<ArrowDownToLine className="w-5 h-5" />}
                    >
                      {isApproving ? 'Approving USDC...' : depositLoading ? 'Depositing...' : 'Deposit USDC'}
                    </Button>
                  </motion.div>
                )}

                {activeTab === 'withdraw' && (
                  <motion.div
                    key="withdraw"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* LP Position */}
                    <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-vault to-appex-500 flex items-center justify-center">
                          <Coins className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm text-surface-400">Your LP Tokens</p>
                          <p className="font-semibold">{formatLP(lpPosition?.shares || 0n)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-surface-400">Value</p>
                        <p className="font-semibold">${formatUSDC(lpPosition?.assetsValue || 0n)}</p>
                      </div>
                    </div>

                    {/* Withdraw Type */}
                    <div className="space-y-2">
                      <label className="text-sm text-surface-400">Withdraw By</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setWithdrawType('assets')}
                          className={`p-3 rounded-xl border transition-all ${
                            withdrawType === 'assets'
                              ? 'border-appex-500 bg-appex-500/10'
                              : 'border-white/10 hover:border-white/20'
                          }`}
                        >
                          <p className="font-medium">USDC Amount</p>
                          <p className="text-xs text-surface-400">Specify exact USDC</p>
                        </button>
                        <button
                          onClick={() => setWithdrawType('shares')}
                          className={`p-3 rounded-xl border transition-all ${
                            withdrawType === 'shares'
                              ? 'border-appex-500 bg-appex-500/10'
                              : 'border-white/10 hover:border-white/20'
                          }`}
                        >
                          <p className="font-medium">LP Tokens</p>
                          <p className="text-xs text-surface-400">Redeem shares</p>
                        </button>
                      </div>
                    </div>

                    {/* Withdraw Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-surface-400">
                          Withdraw Amount ({withdrawType === 'assets' ? 'USDC' : 'LP Tokens'})
                        </label>
                        <Button variant="ghost" size="sm" onClick={setMaxWithdraw}>
                          Max
                        </Button>
                      </div>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        leftElement={withdrawType === 'assets' ? <DollarSign className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
                        className="text-xl"
                      />
                    </div>

                    {/* Preview */}
                    {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                      <div className="p-4 bg-vault/10 border border-vault/20 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-sm text-vault">
                          <Info className="w-4 h-4" />
                          <span>Transaction Preview</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-surface-400">You will receive</span>
                          <span className="font-semibold">
                            {withdrawType === 'assets' 
                              ? `${withdrawAmount} USDC` 
                              : `$${previewAssets} USDC`}
                          </span>
                        </div>
                        {withdrawType === 'shares' && (
                          <div className="flex items-center justify-between">
                            <span className="text-surface-400">Burning</span>
                            <span className="font-semibold">{withdrawAmount} LP Tokens</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      className="w-full"
                      size="lg"
                      variant="secondary"
                      onClick={handleWithdraw}
                      isLoading={withdrawLoading}
                      disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0}
                      leftIcon={<ArrowUpFromLine className="w-5 h-5" />}
                    >
                      {withdrawLoading ? 'Processing...' : `Withdraw ${withdrawType === 'assets' ? 'USDC' : 'LP Tokens'}`}
                    </Button>
                  </motion.div>
                )}

                {activeTab === 'positions' && (
                  <motion.div
                    key="positions"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Position Summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-surface-800/50 rounded-xl">
                        <p className="text-sm text-surface-400 mb-1">LP Token Balance</p>
                        <p className="text-2xl font-bold">{formatLP(lpPosition?.shares || 0n)}</p>
                        <p className="text-sm text-surface-500">≈ ${formatUSDC(lpPosition?.assetsValue || 0n)}</p>
                      </div>
                      <div className="p-4 bg-surface-800/50 rounded-xl">
                        <p className="text-sm text-surface-400 mb-1">Staked $APPEX</p>
                        <p className="text-2xl font-bold">{formatToken(lpPosition?.stakedAppex || 0n)}</p>
                        <p className="text-sm text-surface-500">Cap: {formatToken(lpPosition?.stakingCap || 0n)}</p>
                      </div>
                    </div>

                    {/* Staking Progress */}
                    <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-surface-400">Staking Capacity Used</span>
                        <span className="font-medium">
                          {lpPosition?.stakingCap && lpPosition.stakingCap > 0n
                            ? ((Number(lpPosition.stakedAppex) / Number(lpPosition.stakingCap)) * 100).toFixed(1)
                            : 0}%
                        </span>
                      </div>
                      <ProgressBar
                        value={lpPosition?.stakingCap && lpPosition.stakingCap > 0n
                          ? (Number(lpPosition.stakedAppex) / Number(lpPosition.stakingCap)) * 100
                          : 0}
                        max={100}
                        color="appex"
                      />
                      <p className="text-xs text-surface-500">
                        Stake more $APPEX to earn protocol fee distributions
                      </p>
                    </div>

                    {/* Pending Rewards */}
                    <div className="p-4 bg-gradient-to-r from-appex-500/10 to-vault/10 border border-appex-500/20 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-surface-400 mb-1">Pending Rewards</p>
                          <p className="text-2xl font-bold text-appex-400">
                            {formatToken(lpPosition?.pendingRewards || 0n)} $APPEX
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          disabled={!lpPosition?.pendingRewards || lpPosition.pendingRewards === 0n}
                        >
                          Claim
                        </Button>
                      </div>
                    </div>

                    {/* Position Details */}
                    <div className="space-y-3">
                      <h3 className="font-semibold">Position Details</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-surface-400">Share of Pool</span>
                          <span className="font-medium">
                            {vaultStats?.totalSupply && vaultStats.totalSupply > 0n
                              ? ((Number(lpPosition?.shares || 0n) / Number(vaultStats.totalSupply)) * 100).toFixed(4)
                              : 0}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-surface-400">Entry NAV</span>
                          <span className="font-medium">$1.0000</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-white/5">
                          <span className="text-surface-400">Current NAV</span>
                          <span className="font-medium">${vaultStats?.navPerShare?.toFixed(4) || '1.0000'}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-surface-400">Unrealized Gain</span>
                          <span className="font-medium text-green-400">
                            +{((vaultStats?.navPerShare || 1) - 1) * 100}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          {/* Vault Parameters */}
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Info className="w-4 h-4 text-surface-400" />
              Vault Parameters
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Input Asset</span>
                <Badge variant="default">USDC</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-400">LP Yield Range</span>
                <span className="font-medium">5-15%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Target Utilization</span>
                <span className="font-medium">~85%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Loan Terms</span>
                <span className="font-medium">30-180 days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Staking Multiplier</span>
                <span className="font-medium">1x</span>
              </div>
            </div>
          </Card>

          {/* Current Utilization */}
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold">Capital Allocation</h3>
            {vaultStats ? (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-surface-400">Active Loans</span>
                    <span className="font-medium">{formatUSDC(vaultStats.totalLoansOutstanding || 0n)}</span>
                  </div>
                  <ProgressBar 
                    value={vaultStats.totalAssets > 0n ? Number((vaultStats.totalLoansOutstanding * 100n) / vaultStats.totalAssets) : 0} 
                    max={100} 
                    color="vault" 
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-surface-400">Available Liquidity</span>
                    <span className="font-medium">{formatUSDC(vaultStats.availableUSDC || 0n)}</span>
                  </div>
                  <ProgressBar 
                    value={vaultStats.totalAssets > 0n ? Number((vaultStats.availableUSDC * 100n) / vaultStats.totalAssets) : 0} 
                    max={100} 
                    color="appex" 
                  />
                  <p className="text-xs text-surface-500 mt-1">USDC balance minus 15% liquidity buffer</p>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-surface-400">Total LP Fees Earned</span>
                    <span className="font-medium">{formatUSDC(vaultStats.totalLPFees || 0n)}</span>
                  </div>
                  <ProgressBar 
                    value={vaultStats.totalAssets > 0n ? Number(((vaultStats.totalLPFees || 0n) * 100n) / vaultStats.totalAssets) : 0} 
                    max={100} 
                    color="staking" 
                  />
                  <div className="text-xs text-surface-500 mt-1 flex justify-between">
                    <span>Collected: {formatUSDC(vaultStats.collectedFees || 0n)}</span>
                    <span>Pending: {formatUSDC(vaultStats.accruedFees || 0n)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-surface-400">Protocol Fees Collected</span>
                    <span className="font-medium">{formatUSDC(vaultStats.protocolFees || 0n)}</span>
                  </div>
                  <p className="text-xs text-surface-500">Not part of LP NAV - belongs to protocol</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-surface-400">
                <p>Loading capital allocation...</p>
              </div>
            )}
          </Card>

          {/* Info Box */}
          <Card className="p-4 bg-vault/5 border-vault/20">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-vault flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-vault mb-1">How Yields Work</p>
                <p className="text-surface-400">
                  LP yield accrues to the vault NAV as borrowers repay loans. Your LP tokens 
                  represent a share of the growing pool, so you don't receive more tokens - 
                  each token simply becomes worth more.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title={pendingAction === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
      >
        <div className="space-y-4">
          <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
            {pendingAction === 'deposit' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Depositing</span>
                  <span className="font-semibold">{depositAmount} USDC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Receiving</span>
                  <span className="font-semibold">{previewShares} LP Tokens</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Withdrawing</span>
                  <span className="font-semibold">
                    {withdrawType === 'assets' ? `${withdrawAmount} USDC` : `${withdrawAmount} LP Tokens`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Receiving</span>
                  <span className="font-semibold">
                    {withdrawType === 'assets' ? `${withdrawAmount} USDC` : `$${previewAssets} USDC`}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-surface-300">
              {pendingAction === 'deposit'
                ? 'By depositing, you agree to the vault terms. Your funds will be used to provide liquidity for instant publisher payments.'
                : 'Withdrawals are subject to liquidity availability. Large withdrawals may be queued if the buffer is insufficient.'}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={confirmAction}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
