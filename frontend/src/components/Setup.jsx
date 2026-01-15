import React, { useState, useEffect } from 'react';
import { useWeb3Auth } from '../contexts/Web3AuthContext';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

const Setup = () => {
  const { account, isConnected } = useWeb3Auth();
  const [addresses, setAddresses] = useState({
    usdc: localStorage.getItem('USDC_ADDRESS') || '',
    appex: localStorage.getItem('APPEX_ADDRESS') || '',
    vault: localStorage.getItem('VAULT_ADDRESS') || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem('USDC_ADDRESS', addresses.usdc);
    localStorage.setItem('APPEX_ADDRESS', addresses.appex);
    localStorage.setItem('VAULT_ADDRESS', addresses.vault);
    
    setTimeout(() => {
      setSaving(false);
      alert('Addresses saved! Please refresh the page to load the contracts.');
    }, 500);
  };

  const handleLoadFromFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n');
    const newAddresses = {};

    lines.forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        const cleanKey = key.trim();
        const cleanValue = value.trim();
        if (cleanKey === 'USDC') newAddresses.usdc = cleanValue;
        if (cleanKey === 'APPEX') newAddresses.appex = cleanValue;
        if (cleanKey === 'VAULT') newAddresses.vault = cleanValue;
      }
    });

    setAddresses(prev => ({ ...prev, ...newAddresses }));
  };

  const allAddressesSet = addresses.usdc && addresses.appex && addresses.vault;

  return (
    <div className="container">
      <div className="page-header">
        <h1>Setup & Configuration</h1>
        <p>Configure contract addresses to connect the frontend</p>
      </div>

      {/* Deployment Instructions */}
      <div className="section">
        <h2>Step 1: Deploy Contracts</h2>
        <div className="card">
          <p className="card-description">
            First, deploy the smart contracts using Forge. Open a terminal in the project root:
          </p>
          
          <div className="code-block">
            <pre><code>{`# Start Anvil (local blockchain)
anvil

# In a new terminal, deploy contracts
cd appex-protocol
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Contract addresses will be saved to deployments.txt`}</code></pre>
          </div>

          <div className="alert alert-info">
            <strong>Note:</strong> Make sure Anvil is running on port 8545 before deploying.
            The deployment script will automatically mint test USDC and approve a test borrower.
          </div>
        </div>
      </div>

      {/* Load Addresses */}
      <div className="section">
        <h2>Step 2: Load Contract Addresses</h2>
        <div className="card">
          <p className="card-description">
            After deployment, load the contract addresses either manually or from the deployments.txt file:
          </p>

          <div className="form-group">
            <label>Load from deployments.txt</label>
            <input
              type="file"
              accept=".txt"
              onChange={handleLoadFromFile}
              className="input"
            />
          </div>

          <div className="divider">OR</div>

          <div className="form-group">
            <label>MockUSDC Address</label>
            <input
              type="text"
              value={addresses.usdc}
              onChange={(e) => setAddresses({ ...addresses, usdc: e.target.value })}
              placeholder="0x..."
              className="input"
            />
          </div>

          <div className="form-group">
            <label>AppEx Token Address</label>
            <input
              type="text"
              value={addresses.appex}
              onChange={(e) => setAddresses({ ...addresses, appex: e.target.value })}
              placeholder="0x..."
              className="input"
            />
          </div>

          <div className="form-group">
            <label>Payments Vault Address</label>
            <input
              type="text"
              value={addresses.vault}
              onChange={(e) => setAddresses({ ...addresses, vault: e.target.value })}
              placeholder="0x..."
              className="input"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !allAddressesSet}
            className="btn-primary btn-full"
          >
            {saving ? (
              <>
                <Loader className="spin" /> Saving...
              </>
            ) : (
              'Save Addresses'
            )}
          </button>

          {allAddressesSet && (
            <div className="alert alert-success">
              <CheckCircle size={20} />
              All addresses configured! Click save and refresh the page to start using the app.
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="section">
        <h2>Step 3: Get Test Tokens</h2>
        <div className="card">
          <p className="card-description">
            The MockUSDC contract includes a faucet for testing. You can also mint directly from the admin account.
          </p>

          <div className="code-block">
            <pre><code>{`# In Forge console or via frontend:
# Use the faucet to get 1000 USDC
MockUSDC.faucet()

# Or mint from admin account
MockUSDC.mint(yourAddress, 10000000000) // 10,000 USDC`}</code></pre>
          </div>
        </div>
      </div>

      {/* System Architecture */}
      <div className="section">
        <h2>System Architecture</h2>
        <div className="card">
          <h3>Smart Contracts</h3>
          <ul className="architecture-list">
            <li>
              <strong>MockUSDC:</strong> Test stablecoin with faucet functionality
            </li>
            <li>
              <strong>AppExToken:</strong> $APPEX token with vesting schedules
            </li>
            <li>
              <strong>PaymentsVault:</strong> Core lending/borrowing logic
            </li>
            <li>
              <strong>LPToken:</strong> ERC20 representing vault shares
            </li>
          </ul>

          <h3>User Roles</h3>
          <ul className="architecture-list">
            <li>
              <strong>Liquidity Providers:</strong> Deposit USDC, earn yield, stake $APPEX
            </li>
            <li>
              <strong>Borrowers:</strong> Approved partners who borrow to fund instant payments
            </li>
            <li>
              <strong>Publishers:</strong> Receive instant payments in $APPEX, USDC, or fiat
            </li>
            <li>
              <strong>Admin:</strong> Approves borrowers, manages vault parameters
            </li>
          </ul>
        </div>
      </div>

      {/* Testing Guide */}
      <div className="section">
        <h2>Testing the Protocol</h2>
        <div className="section-grid">
          <div className="card">
            <h3>1. As LP</h3>
            <ol className="test-steps">
              <li>Get USDC from faucet</li>
              <li>Deposit USDC to vault</li>
              <li>Receive LP tokens</li>
              <li>Stake $APPEX (optional)</li>
            </ol>
          </div>

          <div className="card">
            <h3>2. As Admin</h3>
            <ol className="test-steps">
              <li>Approve new borrowers</li>
              <li>Set borrowing limits</li>
              <li>Configure fee rates</li>
              <li>Monitor vault stats</li>
            </ol>
          </div>

          <div className="card">
            <h3>3. As Borrower</h3>
            <ol className="test-steps">
              <li>Get approved by admin</li>
              <li>Create loans for publishers</li>
              <li>Choose $APPEX split</li>
              <li>Repay when due</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      <div className="section">
        <h2>System Status</h2>
        <div className="status-grid">
          <div className={`status-item ${isConnected ? 'status-success' : 'status-pending'}`}>
            {isConnected ? <CheckCircle /> : <AlertCircle />}
            <span>Wallet: {isConnected ? 'Connected' : 'Not Connected'}</span>
          </div>

          <div className={`status-item ${allAddressesSet ? 'status-success' : 'status-pending'}`}>
            {allAddressesSet ? <CheckCircle /> : <AlertCircle />}
            <span>Contracts: {allAddressesSet ? 'Configured' : 'Not Configured'}</span>
          </div>

          <div className="status-item status-pending">
            <Loader className="spin" />
            <span>Anvil: Check Terminal</span>
          </div>
        </div>
      </div>

      {/* Helpful Links */}
      <div className="section">
        <div className="card highlight">
          <h3>Helpful Resources</h3>
          <ul className="resource-list">
            <li>
              <strong>Foundry Docs:</strong>{' '}
              <a href="https://book.getfoundry.sh/" target="_blank" rel="noopener noreferrer">
                book.getfoundry.sh
              </a>
            </li>
            <li>
              <strong>Web3Auth Docs:</strong>{' '}
              <a href="https://web3auth.io/docs/" target="_blank" rel="noopener noreferrer">
                web3auth.io/docs
              </a>
            </li>
            <li>
              <strong>Ethers.js v6:</strong>{' '}
              <a href="https://docs.ethers.org/v6/" target="_blank" rel="noopener noreferrer">
                docs.ethers.org/v6
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Setup;
