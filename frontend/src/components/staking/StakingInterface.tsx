'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  Coins,
  TrendingUp,
  Gift,
  Clock,
  Info,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Calendar,
  ArrowRight,
  RefreshCw,
  Shield,
  Timer,
  Zap
} from 'lucide-react';
import { Card, Button, Input, Badge, Tabs, ProgressBar, Modal, StatDisplay } from '@/components/ui';
import { useAppStore } from '@/lib/store';
import { useStaking, useLPPosition, useTokenBalances } from '@/hooks/useContracts';
import { formatToken, formatUSDC } from '@/lib/utils';

type Tab = 'stake' | 'unstake' | 'rewards';

interface StakingTier {
  duration: number;
  label: string;
  multiplier: number;
  icon: React.ReactNode;
  description: string;
}

const stakingTiers: StakingTier[] = [
  {
    duration: 0,
    label: 'Flexible',
    multiplier: 1,
    icon: <Unlock className="w-5 h-5" />,
    description: 'No lock period, withdraw anytime'
  },
  {
    duration: 90,
    label: '3 Months',
    multiplier: 2,
    icon: <Clock className="w-5 h-5" />,
    description: '2x reward multiplier'
  },
  {
    duration: 180,
    label: '6 Months',
    multiplier: 3,
    icon: <Lock className="w-5 h-5" />,
    description: '3x reward multiplier'
  }
];

export const StakingInterface = () => {
  const [activeTab, setActiveTab] = useState<Tab>('stake');
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [selectedTier, setSelectedTier] = useState<StakingTier>(stakingTiers[0]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'stake' | 'unstake' | 'claim' | null>(null);

  const { lpPosition, refetch: refetchPosition } = useLPPosition();
  const { balances, refetch: refetchBalances } = useTokenBalances();
  const { stake, unstake, claimRewards, isStaking } = useStaking();
  const addNotification = useAppStore((state) => state.addNotification);

  const stakingCap = lpPosition?.stakingCap || 0n;
  const stakedAmount = lpPosition?.stakedAppex || 0n;
  const pendingRewards = lpPosition?.pendingRewards || 0n;
  const availableToStake = stakingCap > stakedAmount ? stakingCap - stakedAmount : 0n;
  const appexBalance = balances?.appex || 0n;

  const handleStake = () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      addNotification({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Please enter a valid stake amount'
      });
      return;
    }
    setPendingAction('stake');
    setShowConfirmModal(true);
  };

  const handleUnstake = () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
      addNotification({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Please enter a valid unstake amount'
      });
      return;
    }
    setPendingAction('unstake');
    setShowConfirmModal(true);
  };

  const handleClaim = () => {
    if (!pendingRewards || pendingRewards === 0n) {
      addNotification({
        type: 'error',
        title: 'No Rewards',
        message: 'You have no pending rewards to claim'
      });
      return;
    }
    setPendingAction('claim');
    setShowConfirmModal(true);
  };

  const confirmAction = async () => {
    setShowConfirmModal(false);

    let success = false;
    if (pendingAction === 'stake') {
      success = await stake(stakeAmount, selectedTier.duration);
      if (success) setStakeAmount('');
    } else if (pendingAction === 'unstake') {
      success = await unstake(unstakeAmount);
      if (success) setUnstakeAmount('');
    } else if (pendingAction === 'claim') {
      success = await claimRewards();
    }

    if (success) {
      refetchPosition();
      refetchBalances();
    }
    setPendingAction(null);
  };

  const setMaxStake = () => {
    const max = appexBalance < availableToStake ? appexBalance : availableToStake;
    setStakeAmount(formatToken(max, false));
  };

  const setMaxUnstake = () => {
    setUnstakeAmount(formatToken(stakedAmount, false));
  };

  const tabs = [
    { id: 'stake' as Tab, label: 'Stake', icon: <Lock className="w-4 h-4" /> },
    { id: 'unstake' as Tab, label: 'Unstake', icon: <Unlock className="w-4 h-4" /> },
    { id: 'rewards' as Tab, label: 'Rewards', icon: <Gift className="w-4 h-4" /> }
  ];

  const utilizationPercent = stakingCap > 0n 
    ? (Number(stakedAmount) / Number(stakingCap)) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-staking to-appex-500 flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            $APPEX Staking
          </h1>
          <p className="text-surface-400 mt-1">Stake $APPEX to earn protocol fee distributions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => { refetchPosition(); refetchBalances(); }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-staking/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-staking" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Staked $APPEX</p>
              <p className="text-xl font-bold">{formatToken(stakedAmount)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-appex-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-appex-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Staking Cap</p>
              <p className="text-xl font-bold">{formatToken(stakingCap)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-governance/20 flex items-center justify-center">
              <Gift className="w-5 h-5 text-governance" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Pending Rewards</p>
              <p className="text-xl font-bold text-appex-400">{formatToken(pendingRewards)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-vault/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-vault" />
            </div>
            <div>
              <p className="text-sm text-surface-400">$APPEX Balance</p>
              <p className="text-xl font-bold">{formatToken(appexBalance)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Staking Capacity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Staking Capacity</h3>
          <Badge variant={utilizationPercent >= 100 ? 'success' : 'default'}>
            {utilizationPercent.toFixed(1)}% Used
          </Badge>
        </div>
        <ProgressBar value={utilizationPercent} max={100} color="staking" className="h-3" />
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-surface-400">
            {formatToken(stakedAmount)} / {formatToken(stakingCap)} $APPEX staked
          </span>
          <span className="text-surface-400">
            {formatToken(availableToStake)} available
          </span>
        </div>
        <p className="text-xs text-surface-500 mt-2">
          Your staking cap is determined by your LP token holdings × the vault multiplier (currently 1x)
        </p>
      </Card>

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
                {activeTab === 'stake' && (
                  <motion.div
                    key="stake"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Lock Duration Selection */}
                    <div className="space-y-3">
                      <label className="text-sm text-surface-400">Select Lock Duration</label>
                      <div className="grid grid-cols-3 gap-3">
                        {stakingTiers.map((tier) => (
                          <button
                            key={tier.duration}
                            onClick={() => setSelectedTier(tier)}
                            className={`p-4 rounded-xl border transition-all text-left ${
                              selectedTier.duration === tier.duration
                                ? 'border-staking bg-staking/10'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className={selectedTier.duration === tier.duration ? 'text-staking' : 'text-surface-400'}>
                                {tier.icon}
                              </span>
                              <Badge variant={selectedTier.duration === tier.duration ? 'warning' : 'default'} className="text-xs">
                                {tier.multiplier}x
                              </Badge>
                            </div>
                            <p className="font-medium">{tier.label}</p>
                            <p className="text-xs text-surface-400 mt-1">{tier.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stake Amount Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-surface-400">Stake Amount ($APPEX)</label>
                        <Button variant="ghost" size="sm" onClick={setMaxStake}>
                          Max
                        </Button>
                      </div>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        leftElement={<Coins className="w-4 h-4" />}
                        className="text-xl"
                      />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-surface-400">Available: {formatToken(appexBalance)}</span>
                        <span className="text-surface-400">Cap remaining: {formatToken(availableToStake)}</span>
                      </div>
                    </div>

                    {/* Preview */}
                    {stakeAmount && parseFloat(stakeAmount) > 0 && (
                      <div className="p-4 bg-staking/10 border border-staking/20 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-sm text-staking">
                          <Info className="w-4 h-4" />
                          <span>Staking Preview</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-surface-400">Staking</span>
                          <span className="font-semibold">{stakeAmount} $APPEX</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-surface-400">Lock Period</span>
                          <span className="font-semibold">{selectedTier.label}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-surface-400">Reward Multiplier</span>
                          <span className="font-semibold text-staking">{selectedTier.multiplier}x</span>
                        </div>
                        {selectedTier.duration > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-surface-400">Unlock Date</span>
                            <span className="font-semibold">
                              {new Date(Date.now() + selectedTier.duration * 24 * 60 * 60 * 1000).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleStake}
                      isLoading={isStaking}
                      disabled={!stakeAmount || parseFloat(stakeAmount) <= 0 || availableToStake === 0n}
                      leftIcon={<Lock className="w-5 h-5" />}
                    >
                      {isStaking ? 'Staking...' : 'Stake $APPEX'}
                    </Button>

                    {availableToStake === 0n && (
                      <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-yellow-500">Staking Cap Reached</p>
                          <p className="text-surface-400">
                            Deposit more USDC to the vault to increase your LP token holdings and staking capacity.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'unstake' && (
                  <motion.div
                    key="unstake"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Current Staked Position */}
                    <div className="p-4 bg-surface-800/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-staking/20 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-staking" />
                          </div>
                          <div>
                            <p className="text-sm text-surface-400">Currently Staked</p>
                            <p className="font-semibold">{formatToken(stakedAmount)} $APPEX</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={setMaxUnstake}>
                          Max
                        </Button>
                      </div>
                    </div>

                    {/* Unstake Amount Input */}
                    <div className="space-y-2">
                      <label className="text-sm text-surface-400">Unstake Amount ($APPEX)</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={unstakeAmount}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        leftElement={<Coins className="w-4 h-4" />}
                        className="text-xl"
                      />
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-500">Important</p>
                        <p className="text-surface-400">
                          Unstaking reduces your reward earning potential. Tokens with active lock periods 
                          cannot be unstaked until the lock expires.
                        </p>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      variant="secondary"
                      onClick={handleUnstake}
                      isLoading={isStaking}
                      disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0 || stakedAmount === 0n}
                      leftIcon={<Unlock className="w-5 h-5" />}
                    >
                      {isStaking ? 'Unstaking...' : 'Unstake $APPEX'}
                    </Button>
                  </motion.div>
                )}

                {activeTab === 'rewards' && (
                  <motion.div
                    key="rewards"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Pending Rewards */}
                    <div className="p-6 bg-gradient-to-r from-staking/10 to-appex-500/10 border border-staking/20 rounded-xl text-center">
                      <Gift className="w-12 h-12 mx-auto text-staking mb-4" />
                      <p className="text-surface-400 mb-2">Pending Rewards</p>
                      <p className="text-4xl font-bold text-staking mb-2">
                        {formatToken(pendingRewards)}
                      </p>
                      <p className="text-lg text-surface-400">$APPEX</p>
                    </div>

                    {/* Claim Button */}
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleClaim}
                      isLoading={isStaking}
                      disabled={!pendingRewards || pendingRewards === 0n}
                      leftIcon={<Sparkles className="w-5 h-5" />}
                    >
                      {isStaking ? 'Claiming...' : 'Claim Rewards'}
                    </Button>

                    {/* Reward Info */}
                    <div className="space-y-4">
                      <h3 className="font-semibold">How Rewards Work</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-surface-800/50 rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-vault/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-vault font-bold">1</span>
                          </div>
                          <div>
                            <p className="font-medium">Protocol Fees</p>
                            <p className="text-sm text-surface-400">
                              50% of protocol fees are distributed to staking LPs
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-surface-800/50 rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-appex-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-appex-400 font-bold">2</span>
                          </div>
                          <div>
                            <p className="font-medium">Monthly Distribution</p>
                            <p className="text-sm text-surface-400">
                              Rewards are calculated and distributed monthly
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-surface-800/50 rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-staking/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-staking font-bold">3</span>
                          </div>
                          <div>
                            <p className="font-medium">Lock Multipliers</p>
                            <p className="text-sm text-surface-400">
                              Longer locks earn proportionally higher rewards
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Staking Tiers Info */}
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Timer className="w-4 h-4 text-surface-400" />
              Lock Duration Multipliers
            </h3>
            <div className="space-y-2">
              {stakingTiers.map((tier) => (
                <div
                  key={tier.duration}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-surface-400">{tier.icon}</span>
                    <span>{tier.label}</span>
                  </div>
                  <Badge variant={tier.multiplier === 3 ? 'warning' : tier.multiplier === 2 ? 'success' : 'default'}>
                    {tier.multiplier}x
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Benefits */}
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-surface-400" />
              Staking Benefits
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-surface-300">Earn 50% of protocol fees</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-surface-300">Governance voting rights</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-surface-300">$APPEX emission rewards</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-surface-300">Boost with longer locks</span>
              </div>
            </div>
          </Card>

          {/* Info Box */}
          <Card className="p-4 bg-staking/5 border-staking/20">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-staking flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-staking mb-1">Liquidity-Linked Staking</p>
                <p className="text-surface-400">
                  Your staking cap is tied to your LP token holdings. More liquidity = more 
                  staking capacity. This ensures rewards flow to those contributing capital.
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
        title={
          pendingAction === 'stake' ? 'Confirm Stake' :
          pendingAction === 'unstake' ? 'Confirm Unstake' :
          'Confirm Claim'
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
            {pendingAction === 'stake' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Staking</span>
                  <span className="font-semibold">{stakeAmount} $APPEX</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Lock Period</span>
                  <span className="font-semibold">{selectedTier.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Multiplier</span>
                  <span className="font-semibold text-staking">{selectedTier.multiplier}x</span>
                </div>
              </>
            )}
            {pendingAction === 'unstake' && (
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Unstaking</span>
                <span className="font-semibold">{unstakeAmount} $APPEX</span>
              </div>
            )}
            {pendingAction === 'claim' && (
              <div className="flex items-center justify-between">
                <span className="text-surface-400">Claiming</span>
                <span className="font-semibold text-staking">{formatToken(pendingRewards)} $APPEX</span>
              </div>
            )}
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
