import React, { useState } from 'react';
import { Copy, Check, Droplet, Wallet, LogOut, ExternalLink } from 'lucide-react';
import { useWeb3Auth } from '../contexts/Web3AuthContext';
import { useContracts } from '../hooks/useContracts';
import { ethers } from 'ethers';

const WalletWidget = () => {
  const { account, logout, isConnected } = useWeb3Auth();
  const { contracts } = useContracts(); // Destructure contracts from return object
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fauceting, setFauceting] = useState(false);
  const [balances, setBalances] = useState({ usdc: '0', appex: '0', eth: '0' });

  // Load balances when dropdown opens
  React.useEffect(() => {
    if (isOpen && contracts && account) {
      loadBalances();
    }
  }, [isOpen, contracts, account]);

  // Auto-fund wallet with ETH on first connection
  React.useEffect(() => {
    if (contracts && account && isConnected) {
      autoFundWallet();
    }
  }, [contracts, account, isConnected]);

  const autoFundWallet = async () => {
    if (!contracts || !account) return;
    
    try {
      // Create a direct connection to Anvil (not through Web3Auth)
      const anvilProvider = new ethers.JsonRpcProvider('https://caribbean.gulfbreezebc.space/rpc');
      
      // Check user's balance
      const balance = await anvilProvider.getBalance(account);
      
      // If balance is less than 0.1 ETH, auto-fund from Anvil
      if (balance < ethers.parseEther('0.1')) {
        console.log('💰 Auto-funding wallet with ETH for gas...');
        
        // Get Anvil's account 0 (pre-funded with 10,000 ETH)
        const anvilSigner = await anvilProvider.getSigner(0);
        
        const tx = await anvilSigner.sendTransaction({
          to: account,
          value: ethers.parseEther('5.0'), // Send 5 ETH initially
          gasLimit: 21000
        });
        
        await tx.wait();
        console.log('✅ Auto-funded wallet with 5 ETH');
      }
    } catch (error) {
      console.warn('Auto-funding failed (non-critical):', error.message);
    }
  };

  const loadBalances = async () => {
    if (!contracts || !account) return;
    
    try {
      // Use direct Anvil connection for ETH balance
      const anvilProvider = new ethers.JsonRpcProvider('https://caribbean.gulfbreezebc.space/rpc');
      
      const [usdcBal, appexBal, ethBal] = await Promise.all([
        contracts.usdc.balanceOf(account),
        contracts.appex.balanceOf(account),
        anvilProvider.getBalance(account)
      ]);

      setBalances({
        usdc: ethers.formatUnits(usdcBal, 6),
        appex: ethers.formatUnits(appexBal, 18),
        eth: ethers.formatEther(ethBal)
      });
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requestUSDC = async () => {
    if (!contracts || fauceting) return;
    
    setFauceting(true);
    try {
      console.log('Requesting 50,000 USDC from faucet...');
      
      // Check if we need gas funds first (use direct Anvil connection)
      const anvilProvider = new ethers.JsonRpcProvider('https://caribbean.gulfbreezebc.space/rpc');
      const balance = await anvilProvider.getBalance(account);
      
      if (balance < ethers.parseEther('0.01')) {
        console.log('⛽ Insufficient ETH, funding wallet first...');
        await ensureGasFunds();
      }
      
      const tx = await contracts.usdc.faucet({
        gasLimit: 100000
      });
      await tx.wait();
      console.log('✅ Received 50,000 USDC!');
      await loadBalances();
      
      // Dispatch event to refresh balances in other components
      window.dispatchEvent(new CustomEvent('balanceUpdate'));
      
      alert('✅ Received 50,000 USDC!');
    } catch (error) {
      console.error('Faucet error:', error);
      alert('Failed to get USDC: ' + error.message);
    } finally {
      setFauceting(false);
    }
  };

  const ensureGasFunds = async () => {
    if (!contracts || !account) return;
    
    try {
      // Create direct connection to Anvil
      const anvilProvider = new ethers.JsonRpcProvider('https://caribbean.gulfbreezebc.space/rpc');
      
      // Check if user has enough ETH for gas
      const balance = await anvilProvider.getBalance(account);
      
      // If balance is less than 0.1 ETH, fund from Anvil
      if (balance < ethers.parseEther('0.1')) {
        console.log('📡 Funding wallet with ETH for gas...');
        
        // Get Anvil's default funded account (account 0)
        const anvilSigner = await anvilProvider.getSigner(0);
        
        const tx = await anvilSigner.sendTransaction({
          to: account,
          value: ethers.parseEther('1.0'), // Send 1 ETH for gas
          gasLimit: 21000
        });
        
        await tx.wait();
        console.log('✅ Funded wallet with 1 ETH for gas');
      }
    } catch (error) {
      console.error('Error ensuring gas funds:', error);
      throw new Error('Failed to fund wallet with ETH. Make sure Anvil is running.');
    }
  };

  const requestETH = async () => {
    if (!contracts || fauceting) return;
    
    setFauceting(true);
    try {
      console.log('Requesting ETH from Anvil...');
      
      // Create direct connection to Anvil
      const anvilProvider = new ethers.JsonRpcProvider('https://caribbean.gulfbreezebc.space/rpc');
      
      // Get Anvil's default funded account (index 0)
      const anvilSigner = await anvilProvider.getSigner(0);
      
      const tx = await anvilSigner.sendTransaction({
        to: account,
        value: ethers.parseEther('10.0'),
        gasLimit: 21000
      });
      
      await tx.wait();
      console.log('✅ Received 10 ETH!');
      await loadBalances();
      alert('✅ Received 10 ETH!');
    } catch (error) {
      console.error('ETH faucet error:', error);
      
      // Provide helpful error message
      let errorMsg = 'Failed to get ETH. ';
      if (error.message.includes('could not detect network')) {
        errorMsg += 'Make sure Anvil is running.';
      } else if (error.message.includes('unknown account')) {
        errorMsg += 'Anvil account not accessible. Try using the deployer account instead.';
      } else {
        errorMsg += error.message;
      }
      
      alert(errorMsg);
    } finally {
      setFauceting(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div className="wallet-widget">
      <button 
        className="wallet-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Wallet size={16} />
        <span className="wallet-address-short">
          {account.slice(0, 6)}...{account.slice(-4)}
        </span>
      </button>

      {isOpen && (
        <>
          <div className="wallet-overlay" onClick={() => setIsOpen(false)} />
          <div className="wallet-dropdown">
            {/* Account Info */}
            <div className="wallet-section">
              <div className="wallet-label">Connected Account</div>
              <div className="wallet-address-full">
                {account}
              </div>
              <button 
                className="wallet-copy-button"
                onClick={copyAddress}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy Address</span>
                  </>
                )}
              </button>
            </div>

            {/* Balances */}
            <div className="wallet-section">
              <div className="wallet-label">Balances</div>
              <div className="wallet-balances">
                <div className="balance-item">
                  <span className="balance-token">ETH</span>
                  <span className="balance-amount">{parseFloat(balances.eth).toFixed(4)}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-token">USDC</span>
                  <span className="balance-amount">{parseFloat(balances.usdc).toFixed(2)}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-token">APPEX</span>
                  <span className="balance-amount">{parseFloat(balances.appex).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Faucets */}
            <div className="wallet-section">
              <div className="wallet-label">Testnet Faucets</div>
              <div className="wallet-faucets">
                <button 
                  className="faucet-button"
                  onClick={requestUSDC}
                  disabled={fauceting || !contracts}
                >
                  <Droplet size={14} />
                  <span>{fauceting ? 'Requesting...' : 'Get 50,000 USDC'}</span>
                </button>
                <button 
                  className="faucet-button"
                  onClick={requestETH}
                  disabled={fauceting || !contracts}
                >
                  <Droplet size={14} />
                  <span>{fauceting ? 'Requesting...' : 'Get 10 ETH'}</span>
                </button>
              </div>
            </div>

            {/* Explorer Link (if available) */}
            <div className="wallet-section">
              <a 
                href={`https://caribbean.gulfbreezebc.space/rpc`}
                target="_blank"
                rel="noopener noreferrer"
                className="wallet-explorer-link"
              >
                <ExternalLink size={14} />
                <span>View on Anvil</span>
              </a>
            </div>

            {/* Disconnect */}
            <div className="wallet-section">
              <button 
                className="wallet-disconnect-button"
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
              >
                <LogOut size={14} />
                <span>Disconnect Wallet</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WalletWidget;
