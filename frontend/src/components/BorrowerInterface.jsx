import React, { useState } from 'react';
import { useWeb3Auth } from '../contexts/Web3AuthContext';
import { useContracts, useBorrowerInfo } from '../hooks/useContracts';
import { ethers } from 'ethers';
import { TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { createLoan } from '../utils/gasOptimization';

const BorrowerInterface = () => {
  const { account, isConnected } = useWeb3Auth();
  const { contracts, loading: contractsLoading } = useContracts();
  const { info: borrowerInfo, loading: infoLoading } = useBorrowerInfo(contracts, account);

  const [publisherAddress, setPublisherAddress] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [termDays, setTermDays] = useState('90');
  const [appexPercentage, setAppexPercentage] = useState('50');
  const [processing, setProcessing] = useState(false);

  if (!isConnected) {
    return (
      <div className="container">
        <div className="alert alert-info">
          Please connect your wallet to access the Borrower Interface
        </div>
      </div>
    );
  }

  if (contractsLoading || infoLoading) {
    return (
      <div className="container">
        <div className="loading">Loading interface...</div>
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

  if (!borrowerInfo?.approved) {
    return (
      <div className="container">
        <div className="alert alert-warning">
          <AlertCircle size={20} />
          <div>
            <strong>Not Approved as Borrower</strong>
            <p>You need to be approved by the protocol administrator to borrow from the vault.</p>
          </div>
        </div>
      </div>
    );
  }

  // OPTIMIZED: Uses gas optimization utility
  const handleCreateLoan = async () => {
    if (!publisherAddress || !loanAmount || parseFloat(loanAmount) <= 0) {
      alert('Please fill in all fields');
      return;
    }

    if (!ethers.isAddress(publisherAddress)) {
      alert('Invalid publisher address');
      return;
    }

    try {
      setProcessing(true);
      const amount = ethers.parseUnits(loanAmount, 6);
      const percentage = parseInt(appexPercentage);
      
      console.log('⛽ Starting optimized loan creation...');
      
      // Use optimized createLoan with ultra-low gas
      await createLoan(
        contracts.vault,
        publisherAddress,
        amount,
        parseInt(termDays),
        percentage > 0,
        percentage
      );

      alert('✅ Loan created successfully with optimized gas! Publisher will receive payment shortly.');
      setPublisherAddress('');
      setLoanAmount('');
    } catch (error) {
      console.error('❌ Loan creation error:', error);
      alert('Loan creation failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const calculateFees = () => {
    if (!loanAmount || !borrowerInfo) return null;

    const amount = parseFloat(loanAmount);
    const lpFee = amount * (borrowerInfo.lpYieldRate / 100);
    const protocolFee = amount * (borrowerInfo.protocolFeeRate / 100);
    const total = amount + lpFee + protocolFee;

    return { lpFee, protocolFee, total };
  };

  const fees = calculateFees();

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1>Borrower Interface</h1>
        <p>Borrow from the vault to offer instant payments to publishers</p>
      </div>

      {/* Borrower Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><DollarSign /></div>
          <div className="stat-content">
            <div className="stat-label">Borrowing Limit</div>
            <div className="stat-value">${formatNumber(borrowerInfo.limit)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><TrendingUp /></div>
          <div className="stat-content">
            <div className="stat-label">Available to Borrow</div>
            <div className="stat-value">${formatNumber(borrowerInfo.available)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><AlertCircle /></div>
          <div className="stat-content">
            <div className="stat-label">Current Debt</div>
            <div className="stat-value">${formatNumber(borrowerInfo.currentDebt)}</div>
          </div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-content">
            <div className="stat-label">Fee Rates</div>
            <div className="stat-value">{borrowerInfo.lpYieldRate}% + {borrowerInfo.protocolFeeRate}%</div>
            <div className="stat-note">LP Yield + Protocol Fee</div>
          </div>
        </div>
      </div>

      {/* Create Loan */}
      <div className="section">
        <h2>Create Instant Payment</h2>
        <div className="card">
          <p className="card-description">
            Fund an instant publisher payout by borrowing from the vault. Choose the payment split 
            between $APPEX and USDC.
          </p>

          <div className="form-group">
            <label>Publisher Address</label>
            <input
              type="text"
              value={publisherAddress}
              onChange={(e) => setPublisherAddress(e.target.value)}
              placeholder="0x..."
              className="input"
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Loan Amount (USDC)</label>
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="Enter amount"
                className="input"
              />
            </div>

            <div className="form-group">
              <label>Term (Days)</label>
              <select
                value={termDays}
                onChange={(e) => setTermDays(e.target.value)}
                className="input"
              >
                <option value="30">30 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
                <option value="120">120 Days</option>
                <option value="180">180 Days</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>$APPEX Percentage: {appexPercentage}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={appexPercentage}
              onChange={(e) => setAppexPercentage(e.target.value)}
              className="slider"
            />
            <div className="slider-labels">
              <span>0% APPEX<br/>(100% USDC)</span>
              <span>50/50</span>
              <span>100% APPEX<br/>(0% USDC)</span>
            </div>
          </div>

          {fees && (
            <div className="fee-breakdown">
              <h4>Fee Breakdown</h4>
              <div className="fee-row">
                <span>Principal:</span>
                <span>${formatNumber(loanAmount)}</span>
              </div>
              <div className="fee-row">
                <span>LP Yield ({borrowerInfo.lpYieldRate}%):</span>
                <span>${formatNumber(fees.lpFee)}</span>
              </div>
              <div className="fee-row">
                <span>Protocol Fee ({borrowerInfo.protocolFeeRate}%):</span>
                <span>${formatNumber(fees.protocolFee)}</span>
              </div>
              <div className="fee-row total">
                <span>Total to Repay:</span>
                <span>${formatNumber(fees.total)}</span>
              </div>
              <div className="fee-note">
                💡 Pay protocol fees in $APPEX for 25% discount!
              </div>
            </div>
          )}

          <button
            onClick={handleCreateLoan}
            disabled={processing || !loanAmount || !publisherAddress}
            className="btn-primary btn-full"
          >
            {processing ? 'Creating Loan...' : 'Create Instant Payment'}
          </button>
        </div>
      </div>

      {/* Benefits */}
      <div className="section">
        <h2>Why Borrow from AppEx?</h2>
        <div className="section-grid">
          <div className="card">
            <h3>🎯 Attract Publishers</h3>
            <p>Offer instant payments to attract and retain high-quality publishers who value cash flow</p>
          </div>

          <div className="card">
            <h3>⚡ Turnkey Infrastructure</h3>
            <p>Plug into existing vault infrastructure without building your own payment system</p>
          </div>

          <div className="card">
            <h3>💰 Competitive Advantage</h3>
            <p>Stand out from competitors still offering Net-60 or Net-90 payment terms</p>
          </div>

          <div className="card">
            <h3>🔄 $APPEX Integration</h3>
            <p>Accept $APPEX in your platform and use it to pay protocol fees at 25% discount</p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="section">
        <div className="card">
          <h3>Payment Flow</h3>
          <ol className="process-list">
            <li>
              <strong>Borrow from Vault:</strong> Request funds to pay a publisher instantly
            </li>
            <li>
              <strong>Publisher Receives Payment:</strong> They get their choice of $APPEX, USDC, or fiat
            </li>
            <li>
              <strong>Collect Receivables:</strong> When your customers pay (30-180 days), collect the revenue
            </li>
            <li>
              <strong>Repay Vault:</strong> Return principal + fees to close the loan
            </li>
            <li>
              <strong>Repeat:</strong> Capital is freed up for new loans, continuing the cycle
            </li>
          </ol>
        </div>
      </div>

      <div className="alert alert-info">
        <strong>Fee Optimization Tip:</strong> Integrate $APPEX as a payment method in your platform. 
        As publishers spend tokens on your services, you can use those tokens to pay protocol fees 
        at a 25% discount, improving your margins.
      </div>
    </div>
  );
};

export default BorrowerInterface;
