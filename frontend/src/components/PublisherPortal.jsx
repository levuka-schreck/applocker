import React, { useState } from 'react';
import { useWeb3Auth } from '../contexts/Web3AuthContext';
import { useContracts, useUserBalances } from '../hooks/useContracts';
import { Clock, Zap, DollarSign } from 'lucide-react';

const PublisherPortal = () => {
  const { account, isConnected } = useWeb3Auth();
  const { contracts, loading: contractsLoading } = useContracts();
  const { balances } = useUserBalances(contracts, account);

  const [earnedRevenue] = useState('5000'); // Mock data
  const [paymentHistory] = useState([
    { id: 1, amount: 5000, date: '2026-01-05', status: 'Pending', daysWaiting: 45 },
    { id: 2, amount: 3500, date: '2025-12-15', status: 'Pending', daysWaiting: 22 },
    { id: 3, amount: 4200, date: '2025-11-30', status: 'Paid', daysWaiting: 0 }
  ]);

  if (!isConnected) {
    return (
      <div className="container">
        <div className="alert alert-info">
          Please connect your wallet to access the Publisher Portal
        </div>
      </div>
    );
  }

  if (contractsLoading) {
    return (
      <div className="container">
        <div className="loading">Loading portal...</div>
      </div>
    );
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1>Publisher Portal</h1>
        <p>Get paid instantly instead of waiting 120-180 days</p>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><DollarSign /></div>
          <div className="stat-content">
            <div className="stat-label">Earned Revenue</div>
            <div className="stat-value">${formatNumber(earnedRevenue)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Clock /></div>
          <div className="stat-content">
            <div className="stat-label">Traditional Wait Time</div>
            <div className="stat-value">120-180 Days</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Zap /></div>
          <div className="stat-content">
            <div className="stat-label">AppEx Settlement</div>
            <div className="stat-value">Near-Instant</div>
          </div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-content">
            <div className="stat-label">Your Savings</div>
            <div className="stat-value">$0 Fees</div>
            <div className="stat-note">vs 10-30% factoring costs</div>
          </div>
        </div>
      </div>

      {/* Current Balances */}
      <div className="section">
        <h2>Your Balances</h2>
        <div className="card">
          <div className="balance-grid">
            <div className="balance-item">
              <span className="balance-label">USDC Balance</span>
              <span className="balance-value">{balances ? formatNumber(balances.usdc) : '0.00'} USDC</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">APPEX Balance</span>
              <span className="balance-value">{balances ? formatNumber(balances.appex) : '0.00'} APPEX</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="section">
        <h2>How Instant Payments Work</h2>
        <div className="steps">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Earn Revenue</h3>
            <p>Deliver impressions, services, or sales through partner platforms</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Request Payout</h3>
            <p>Choose your mix: $APPEX, USDC, or fiat in any proportion</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Receive Instantly</h3>
            <p>Funds arrive near-instantly (post internal approval)</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h3>Use or Hold</h3>
            <p>Use $APPEX for discounts on partner platforms or hold for future value</p>
          </div>
        </div>
      </div>

      {/* Payment Options */}
      <div className="section">
        <h2>Payment Options</h2>
        <div className="section-grid">
          <div className="card">
            <div className="payment-option">
              <div className="option-header">
                <h3>$APPEX</h3>
                <span className="badge badge-primary">Recommended</span>
              </div>
              <p>Get paid in $APPEX tokens purchased from the DEX with your USDC</p>
              <ul className="benefit-list">
                <li>Use within partner platforms for discounted services</li>
                <li>Hold for potential future appreciation</li>
                <li>No additional selling pressure on the token</li>
                <li>Frictionless onramp - no exchange needed</li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="payment-option">
              <h3>USDC</h3>
              <p>Receive payment directly in stablecoins</p>
              <ul className="benefit-list">
                <li>Immediate operational liquidity</li>
                <li>No token exposure</li>
                <li>Perfect for payroll and expenses</li>
                <li>1:1 USD peg</li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="payment-option">
              <h3>Fiat (Bank Transfer)</h3>
              <p>Traditional currency via integrated off-ramps</p>
              <ul className="benefit-list">
                <li>Direct bank transfer</li>
                <li>1-3 business days</li>
                <li>Traditional currency</li>
                <li>No crypto exposure</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="section">
        <h2>Payment History</h2>
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Days Waiting</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.date}</td>
                    <td>${formatNumber(payment.amount)}</td>
                    <td>
                      <span className={`badge ${payment.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td>{payment.daysWaiting} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="section">
        <div className="card highlight">
          <h2>Why Choose AppEx Instant Payments?</h2>
          <div className="benefits-grid">
            <div className="benefit">
              <h4>⚡ Speed</h4>
              <p>Near-instant settlement vs 120-180 day wait</p>
            </div>
            <div className="benefit">
              <h4>💰 Zero Fees</h4>
              <p>No factoring costs (vs 10-30% traditional)</p>
            </div>
            <div className="benefit">
              <h4>🎯 Flexibility</h4>
              <p>Choose any mix of $APPEX, USDC, or fiat</p>
            </div>
            <div className="benefit">
              <h4>🔒 Security</h4>
              <p>Smart contract powered, audited infrastructure</p>
            </div>
          </div>
        </div>
      </div>

      <div className="alert alert-info">
        <strong>Demo Mode:</strong> This is a demonstration interface. In production, 
        your partner platform would integrate instant payment requests directly into their dashboard.
      </div>
    </div>
  );
};

export default PublisherPortal;
