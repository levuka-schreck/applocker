import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Web3AuthProvider, useWeb3Auth } from './contexts/Web3AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import WalletWidget from './components/WalletWidget';
import LPDashboard from './components/LPDashboard';
import PublisherPortal from './components/PublisherPortal';
import BorrowerInterface from './components/BorrowerInterface';
import AdminPanel from './components/AdminPanel';
import Setup from './components/Setup';
import './App.css';

const Navigation = () => {
  const { account, login, loading } = useWeb3Auth();

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <span className="logo-icon">⚡</span>
          AppEx Protocol
        </Link>
        
        <div className="nav-menu">
          <Link to="/lp" className="nav-link">LP Dashboard</Link>
          <Link to="/publisher" className="nav-link">Publisher</Link>
          <Link to="/borrower" className="nav-link">Borrower</Link>
          <Link to="/admin" className="nav-link">Admin</Link>
          <Link to="/setup" className="nav-link">Setup</Link>
        </div>

        <div className="nav-auth">
          {loading ? (
            <button className="btn-secondary" disabled>Loading...</button>
          ) : account ? (
            <WalletWidget />
          ) : (
            <button onClick={login} className="btn-primary">
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const Home = () => {
  const { isConnected } = useWeb3Auth();

  return (
    <div className="home-container">
      <div className="hero">
        <h1 className="hero-title">
          Instant Payment Infrastructure
          <br />
          <span className="gradient-text">For Publishers and Beyond</span>
        </h1>
        <p className="hero-subtitle">
          AppEx provides near-instant settlement for publishers through liquidity vaults.
          Publishers get paid today. Liquidity providers earn yield. The future of payments is here.
        </p>
        {!isConnected && (
          <div className="hero-cta">
            <Link to="/setup" className="btn-large btn-primary">
              Get Started →
            </Link>
          </div>
        )}
      </div>

      <div className="features">
        <div className="feature-card">
          <div className="feature-icon">💰</div>
          <h3>For LPs</h3>
          <p>Provide liquidity and earn yield from borrower fees. Stake $APPEX for additional rewards.</p>
          <Link to="/lp" className="feature-link">Explore LP Dashboard →</Link>
        </div>

        <div className="feature-card">
          <div className="feature-icon">📱</div>
          <h3>For Publishers</h3>
          <p>Receive instant payments instead of waiting 120-180 days. Choose your payout mix.</p>
          <Link to="/publisher" className="feature-link">Publisher Portal →</Link>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🏢</div>
          <h3>For Partners</h3>
          <p>Borrow from the vault to offer instant payments. Attract more publishers.</p>
          <Link to="/borrower" className="feature-link">Borrower Interface →</Link>
        </div>
      </div>

      <div className="stats-section">
        <h2>Protocol Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">$APPEX</div>
            <div className="stat-label">Native Payment Token</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">0-180 Days</div>
            <div className="stat-label">Flexible Loan Terms</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">Near-Instant</div>
            <div className="stat-label">Publisher Settlements</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">Complete</div>
            <div className="stat-label">Payment Optionality</div>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Web3AuthProvider>
        <Router>
          <div className="app">
            <Navigation />
            <main className="main-content">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/lp" element={<LPDashboard />} />
                  <Route path="/publisher" element={<PublisherPortal />} />
                  <Route path="/borrower" element={<BorrowerInterface />} />
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/setup" element={<Setup />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </ErrorBoundary>
            </main>
            <footer className="footer">
              <p>AppEx Protocol © 2026 - Instant Payment Infrastructure</p>
            </footer>
          </div>
        </Router>
      </Web3AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
