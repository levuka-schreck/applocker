import React, { useState } from 'react';
import { useWeb3Auth } from '../contexts/Web3AuthContext';
import { useContracts, useVaultStats } from '../hooks/useContracts';
import { ethers } from 'ethers';
import { Shield, Users, Settings } from 'lucide-react';

const AdminPanel = () => {
  const { account, isConnected } = useWeb3Auth();
  const { contracts, loading: contractsLoading } = useContracts();
  const { stats } = useVaultStats(contracts);

  const [borrowerAddress, setBorrowerAddress] = useState('');
  const [borrowLimit, setBorrowLimit] = useState('');
  const [lpYieldRate, setLpYieldRate] = useState('500'); // 5%
  const [protocolFeeRate, setProtocolFeeRate] = useState('200'); // 2%
  const [processing, setProcessing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [vaultOwner, setVaultOwner] = useState('');

  // Check if current account is vault owner
  React.useEffect(() => {
    const checkOwner = async () => {
      if (!contracts || !account) return;
      
      try {
        // Add owner() to vault ABI call
        const ownerAddress = await contracts.vault.owner();
        setVaultOwner(ownerAddress);
        setIsOwner(ownerAddress.toLowerCase() === account.toLowerCase());
      } catch (error) {
        console.error('Error checking owner:', error);
      }
    };
    
    checkOwner();
  }, [contracts, account]);

  if (!isConnected) {
    return (
      <div className="container">
        <div className="alert alert-info">
          Please connect your wallet to access the Admin Panel
        </div>
      </div>
    );
  }

  if (contractsLoading) {
    return (
      <div className="container">
        <div className="loading">Loading panel...</div>
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

  const handleApproveBorrower = async () => {
    if (!borrowerAddress || !borrowLimit) {
      alert('Please fill in all fields');
      return;
    }

    if (!ethers.isAddress(borrowerAddress)) {
      alert('Invalid borrower address');
      return;
    }

    try {
      setProcessing(true);
      const limit = ethers.parseUnits(borrowLimit, 6);
      
      const tx = await contracts.vault.approveBorrower(
        borrowerAddress,
        limit,
        parseInt(lpYieldRate),
        parseInt(protocolFeeRate)
      );
      
      await tx.wait();

      alert('Borrower approved successfully!');
      setBorrowerAddress('');
      setBorrowLimit('');
    } catch (error) {
      console.error('Approval error:', error);
      alert('Approval failed: ' + error.message);
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
        <h1>
          <Shield className="inline-icon" />
          Admin Panel
        </h1>
        <p>Manage vault parameters and approve borrowers</p>
      </div>

      {/* Ownership Warning */}
      {!isOwner && vaultOwner && (
        <div className="alert alert-warning" style={{marginBottom: '2rem'}}>
          <strong>⚠️ Not Vault Owner</strong>
          <p>You are not the vault owner. Admin functions will fail.</p>
          <p style={{fontSize: '0.875rem', marginTop: '0.5rem'}}>
            Current owner: <code>{vaultOwner}</code><br/>
            Your address: <code>{account}</code>
          </p>
          <p style={{fontSize: '0.875rem', marginTop: '0.5rem'}}>
            To become owner, run: <code>./transfer-ownership.sh</code>
          </p>
        </div>
      )}

      {isOwner && (
        <div className="alert alert-success" style={{marginBottom: '2rem'}}>
          ✅ You are the vault owner
        </div>
      )}

      {/* Vault Overview */}
      <div className="section">
        <h2>Vault Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-label">Total NAV</div>
              <div className="stat-value">${stats ? formatNumber(stats.nav) : '0.00'}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-label">Total LPs</div>
              <div className="stat-value">{stats ? formatNumber(stats.totalLPs) : '0.00'}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-label">Active Loans</div>
              <div className="stat-value">{stats ? stats.activeLoansCount : '0'}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-label">Utilization Rate</div>
              <div className="stat-value">{stats ? formatNumber(stats.utilizationRate) : '0.00'}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Approve Borrower */}
      <div className="section">
        <h2>
          <Users className="inline-icon" />
          Approve New Borrower
        </h2>
        <div className="card">
          <p className="card-description">
            Add a new partner company that can borrow from the vault to offer instant payments.
          </p>

          <div className="form-group">
            <label>Borrower Address</label>
            <input
              type="text"
              value={borrowerAddress}
              onChange={(e) => setBorrowerAddress(e.target.value)}
              placeholder="0x..."
              className="input"
            />
          </div>

          <div className="form-group">
            <label>Borrow Limit (USDC)</label>
            <input
              type="number"
              value={borrowLimit}
              onChange={(e) => setBorrowLimit(e.target.value)}
              placeholder="Enter limit"
              className="input"
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>LP Yield Rate (basis points)</label>
              <input
                type="number"
                value={lpYieldRate}
                onChange={(e) => setLpYieldRate(e.target.value)}
                placeholder="500"
                className="input"
              />
              <small className="form-hint">500 = 5% per loan</small>
            </div>

            <div className="form-group flex-1">
              <label>Protocol Fee Rate (basis points)</label>
              <input
                type="number"
                value={protocolFeeRate}
                onChange={(e) => setProtocolFeeRate(e.target.value)}
                placeholder="200"
                className="input"
              />
              <small className="form-hint">200 = 2% per loan</small>
            </div>
          </div>

          <button
            onClick={handleApproveBorrower}
            disabled={processing || !borrowerAddress || !borrowLimit}
            className="btn-primary btn-full"
          >
            {processing ? 'Approving...' : 'Approve Borrower'}
          </button>
        </div>
      </div>

      {/* Vault Parameters */}
      <div className="section">
        <h2>
          <Settings className="inline-icon" />
          Vault Parameters
        </h2>
        <div className="card">
          <div className="param-grid">
            <div className="param-item">
              <span className="param-label">Daily Redemption Cap</span>
              <span className="param-value">5%</span>
            </div>
            <div className="param-item">
              <span className="param-label">Liquidity Buffer</span>
              <span className="param-value">15%</span>
            </div>
            <div className="param-item">
              <span className="param-label">Staking Multiplier</span>
              <span className="param-value">1:1</span>
            </div>
            <div className="param-item">
              <span className="param-label">Lock Durations</span>
              <span className="param-value">0, 90, 180 days</span>
            </div>
          </div>
          <p className="card-note">
            Parameter adjustments require governance approval from $APPEX stakers
          </p>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="section">
        <h2>Administrative Actions</h2>
        <div className="section-grid">
          <div className="card">
            <h3>Process Redemptions</h3>
            <p>Process pending LP redemption requests from the queue</p>
            <button className="btn-secondary btn-full" disabled>
              Process Queue
            </button>
          </div>

          <div className="card">
            <h3>Update NAV</h3>
            <p>Manually trigger NAV update to accrue fees from active loans</p>
            <button className="btn-secondary btn-full" disabled>
              Update NAV
            </button>
          </div>

          <div className="card">
            <h3>Distribute Rewards</h3>
            <p>Distribute accumulated $APPEX rewards to stakers</p>
            <button className="btn-secondary btn-full" disabled>
              Distribute
            </button>
          </div>
        </div>
      </div>

      {/* Risk Management */}
      <div className="section">
        <div className="card highlight">
          <h3>Risk Management Guidelines</h3>
          <ul className="guidelines-list">
            <li>
              <strong>Credit Assessment:</strong> Perform thorough background checks on all borrowers
            </li>
            <li>
              <strong>Diversification:</strong> Avoid concentration - no single borrower should exceed 20% of NAV
            </li>
            <li>
              <strong>Fee Calibration:</strong> Higher risk borrowers should pay higher fees
            </li>
            <li>
              <strong>Monitoring:</strong> Regularly review active loans and borrower performance
            </li>
            <li>
              <strong>Collections:</strong> Implement clear procedures for late payments
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
