import React, { useState } from 'react';
import { useWeb3Auth } from '../contexts/Web3AuthContext';
import { useContracts, useVaultStats, useUserBalances, useStakingInfo } from '../hooks/useContracts';
import { ethers } from 'ethers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Lock, Unlock } from 'lucide-react';
import { approveToken, depositToVault, stakeTokens, getGasOptions } from '../utils/gasOptimization';

const LPDashboard = () => {
  const { account, isConnected } = useWeb3Auth();
  const { contracts, loading: contractsLoading } = useContracts();
  const { stats, loading: statsLoading } = useVaultStats(contracts);
  const { balances, loading: balancesLoading, refresh: refreshBalances } = useUserBalances(contracts, account);
  const { info: stakingInfo, loading: stakingLoading } = useStakingInfo(contracts, account);

  const [depositAmount, setDepositAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [lockDuration, setLockDuration] = useState('0');
  const [processing, setProcessing] = useState(false);

  if (!isConnected) {
    return (
      <div className="container">
        <div className="alert alert-info">
          Please connect your wallet to access the LP Dashboard
        </div>
      </div>
    );
  }

  if (contractsLoading || statsLoading || balancesLoading) {
    return (
      <div className="container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (!contracts) {
    return (
      <div className="container">
        <div className="alert alert-warning">
          Contracts not loaded. Please complete setup first.
        </div>
      </div>
    );
  }

  // OPTIMIZED: Uses gas optimization utility
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;

    try {
      setProcessing(true);
      const amount = ethers.parseUnits(depositAmount, 6);
      
      console.log('⛽ Starting optimized deposit...');
      
      // Step 1: Approve with ultra-low gas
      await approveToken(contracts.usdc, contracts.addresses.vault, amount);
      
      // Step 2: Deposit with ultra-low gas
      await depositToVault(contracts.vault, amount);

      alert('✅ Deposit successful with optimized gas!');
      setDepositAmount('');
      
      // Refresh balances immediately
      refreshBalances();
    } catch (error) {
      console.error('❌ Deposit error:', error);
      alert('Deposit failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // OPTIMIZED: Uses gas optimization utility
  const handleRequestRedemption = async () => {
    if (!redeemAmount || parseFloat(redeemAmount) <= 0) return;

    try {
      setProcessing(true);
      const amount = ethers.parseUnits(redeemAmount, 18);
      
      console.log('⛽ Starting optimized redemption...');
      
      // Step 1: Approve LP tokens with ultra-low gas
      await approveToken(contracts.lpToken, contracts.addresses.vault, amount);
      
      // Step 2: Request redemption with optimized gas
      const gasOptions = getGasOptions('VAULT_REDEEM');
      const tx = await contracts.vault.requestRedemption(amount, gasOptions);
      await tx.wait();
      
      console.log('✅ Redemption requested with optimized gas');

      alert('Redemption requested! Will be processed when liquidity is available.');
      setRedeemAmount('');
    } catch (error) {
      console.error('❌ Redemption error:', error);
      alert('Redemption failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // OPTIMIZED: Uses gas optimization utility
  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;

    try {
      setProcessing(true);
      const amount = ethers.parseUnits(stakeAmount, 18);
      const lockDays = parseInt(lockDuration);
      
      console.log('⛽ Starting optimized staking...');
      
      // Step 1: Approve APPEX with ultra-low gas
      await approveToken(contracts.appex, contracts.addresses.vault, amount);
      
      // Step 2: Stake with ultra-low gas
      await stakeTokens(contracts.vault, amount, lockDays);

      alert('✅ Staking successful with optimized gas!');
      setStakeAmount('');
    } catch (error) {
      console.error('❌ Staking error:', error);
      alert('Staking failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  // OPTIMIZED: Uses gas optimization utility
  const handleUnstake = async () => {
    if (!stakingInfo || parseFloat(stakingInfo.staked) <= 0) return;

    try {
      setProcessing(true);
      const amount = ethers.parseUnits(stakingInfo.staked, 18);
      
      console.log('⛽ Starting optimized unstaking...');
      
      // Unstake with optimized gas
      const gasOptions = getGasOptions('VAULT_UNSTAKE');
      const tx = await contracts.vault.unstake(amount, gasOptions);
      await tx.wait();

      console.log('✅ Unstaking successful with optimized gas');
      alert('Unstaking successful!');
    } catch (error) {
      console.error('❌ Unstaking error:', error);
      alert('Unstaking failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1>LP Dashboard</h1>
        <p>Provide liquidity and earn yield from the payments vault</p>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><DollarSign /></div>
          <div className="stat-content">
            <div className="stat-label">Total NAV</div>
            <div className="stat-value">${stats ? formatNumber(stats.nav) : '0.00'}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><TrendingUp /></div>
          <div className="stat-content">
            <div className="stat-label">Share Price</div>
            <div className="stat-value">${stats ? formatNumber(stats.sharePrice) : '0.00'}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Lock /></div>
          <div className="stat-content">
            <div className="stat-label">Utilization Rate</div>
            <div className="stat-value">{stats ? formatNumber(stats.utilizationRate) : '0.00'}%</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Unlock /></div>
          <div className="stat-content">
            <div className="stat-label">Available Liquidity</div>
            <div className="stat-value">${stats ? formatNumber(stats.availableLiquidity) : '0.00'}</div>
          </div>
        </div>
      </div>

      {/* Your Position */}
      <div className="section">
        <h2>Your Position</h2>
        <div className="card">
          <div className="balance-grid">
            <div className="balance-item">
              <span className="balance-label">USDC Balance</span>
              <span className="balance-value">{balances ? formatNumber(balances.usdc) : '0.00'} USDC</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">LP Tokens</span>
              <span className="balance-value">{balances ? formatNumber(balances.lpToken) : '0.00'} LP</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">APPEX Balance</span>
              <span className="balance-value">{balances ? formatNumber(balances.appex) : '0.00'} APPEX</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">Staked APPEX</span>
              <span className="balance-value">{stakingInfo ? formatNumber(stakingInfo.staked) : '0.00'} APPEX</span>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit & Redeem */}
      <div className="section-grid">
        <div className="card">
          <h3>Deposit USDC</h3>
          <p className="card-description">Provide liquidity to earn yield</p>
          <div className="form-group">
            <label>Amount (USDC)</label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Enter amount"
              className="input"
            />
          </div>
          <button
            onClick={handleDeposit}
            disabled={processing || !depositAmount}
            className="btn-primary btn-full"
          >
            {processing ? 'Processing...' : 'Deposit'}
          </button>
        </div>

        <div className="card">
          <h3>Request Redemption</h3>
          <p className="card-description">Redeem LP tokens for USDC</p>
          <div className="form-group">
            <label>Amount (LP Tokens)</label>
            <input
              type="number"
              value={redeemAmount}
              onChange={(e) => setRedeemAmount(e.target.value)}
              placeholder="Enter amount"
              className="input"
            />
          </div>
          <button
            onClick={handleRequestRedemption}
            disabled={processing || !redeemAmount}
            className="btn-secondary btn-full"
          >
            {processing ? 'Processing...' : 'Request Redemption'}\n          </button>
        </div>
      </div>

      {/* Staking */}
      <div className="section">
        <h2>Stake APPEX</h2>
        <div className="card">
          <p className="card-description">
            Stake APPEX to earn additional rewards from protocol fees. 
            Your staking capacity is {stakingInfo ? formatNumber(stakingInfo.maxStake) : '0.00'} APPEX.
          </p>

          {/* Staking Cap Warning */}
          {stakingInfo && parseFloat(stakingInfo.maxStake) === 0 && (
            <div className="alert alert-warning" style={{marginBottom: '1rem'}}>
              <strong>⚠️ No Staking Capacity</strong>
              <p>You need LP tokens to stake APPEX.</p>
              <p style={{fontSize: '0.875rem', marginTop: '0.5rem'}}>
                Deposit USDC above to get LP tokens. Staking capacity = LP token balance.
              </p>
            </div>
          )}

          {stakingInfo && parseFloat(stakingInfo.maxStake) > 0 && parseFloat(stakingInfo.maxStake) <= parseFloat(stakingInfo.staked) && (
            <div className="alert alert-info" style={{marginBottom: '1rem'}}>
              <strong>ℹ️ At Staking Cap</strong>
              <p>You're staking the maximum allowed ({formatNumber(stakingInfo.maxStake)} APPEX).</p>
              <p style={{fontSize: '0.875rem', marginTop: '0.5rem'}}>
                Deposit more USDC to increase your staking capacity.
              </p>
            </div>
          )}

          {stakingInfo && parseFloat(stakingInfo.staked) > 0 && (
            <div className="staking-info">
              <div className="info-item">
                <span>Currently Staked:</span>
                <span>{formatNumber(stakingInfo.staked)} APPEX</span>
              </div>
              <div className="info-item">
                <span>Lock Multiplier:</span>
                <span>{stakingInfo.multiplier}x</span>
              </div>
              {stakingInfo.lockEnd > Date.now() / 1000 && (
                <div className="info-item">
                  <span>Lock Ends:</span>
                  <span>{new Date(stakingInfo.lockEnd * 1000).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Amount (APPEX)</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="Enter amount"
                className="input"
              />
            </div>
            <div className="form-group">
              <label>Lock Duration</label>
              <select
                value={lockDuration}
                onChange={(e) => setLockDuration(e.target.value)}
                className="input"
              >
                <option value="0">No Lock (1x)</option>
                <option value="90">90 Days (2x)</option>
                <option value="180">180 Days (3x)</option>
              </select>
            </div>
          </div>

          <div className="button-group">
            <button
              onClick={handleStake}
              disabled={processing || !stakeAmount}
              className="btn-primary"
            >
              {processing ? 'Processing...' : 'Stake APPEX'}
            </button>
            {stakingInfo && parseFloat(stakingInfo.staked) > 0 && 
             stakingInfo.lockEnd <= Date.now() / 1000 && (
              <button
                onClick={handleUnstake}
                disabled={processing}
                className="btn-secondary"
              >
                {processing ? 'Processing...' : 'Unstake All'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LPDashboard;
