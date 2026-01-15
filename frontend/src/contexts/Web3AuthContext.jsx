import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { config } from '../config';

const Web3AuthContext = createContext();

export const useWeb3Auth = () => {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error('useWeb3Auth must be used within Web3AuthProvider');
  }
  return context;
};

export const Web3AuthProvider = ({ children }) => {
  const [web3auth, setWeb3auth] = useState(null);
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        console.log('🔐 Initializing Web3Auth...');
        console.log('Using Client ID:', config.web3AuthClientId.substring(0, 20) + '...');

        // Dynamically import Web3Auth to handle any loading issues
        const { Web3Auth } = await import('@web3auth/modal');
        const { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } = await import('@web3auth/base');
        const { EthereumPrivateKeyProvider } = await import('@web3auth/ethereum-provider');

        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: config.chainId,
          rpcTarget: config.rpcUrl,
          displayName: config.chainName,
          blockExplorerUrl: config.blockExplorer,
          ticker: config.nativeCurrency.symbol,
          tickerName: config.nativeCurrency.name,
        };

        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig }
        });

        // Map network names to Web3Auth constants
        const networkMap = {
          'sapphire_devnet': WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          'sapphire_mainnet': WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
          'testnet': WEB3AUTH_NETWORK.TESTNET,
          'mainnet': WEB3AUTH_NETWORK.MAINNET,
          'cyan': WEB3AUTH_NETWORK.CYAN,
          'aqua': WEB3AUTH_NETWORK.AQUA,
        };

        const web3AuthNetwork = networkMap[config.web3AuthNetwork.toLowerCase()] || WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;

        console.log('Network:', config.web3AuthNetwork, '→', web3AuthNetwork);

        const web3AuthInstance = new Web3Auth({
          //clientId: config.web3AuthClientId,
          clientId: 'BK0fDrmTAH7DpgjF94AAMYl1Nuaqiu3jec5Sv9rXKzkmowQKDOFiV8DaOuyBjrWr-PrXHCx9I7T7ECRSnSIuiBc', 
          //web3AuthNetwork: web3AuthNetwork,
          web3AuthNetwork: 'sapphire_mainnet',
          privateKeyProvider,
          chainConfig,
        });

        await web3AuthInstance.initModal();
        setWeb3auth(web3AuthInstance);

        if (web3AuthInstance.connected) {
          const web3authProvider = web3AuthInstance.provider;
          setProvider(web3authProvider);
          const ethersProvider = new ethers.BrowserProvider(web3authProvider);
          const signer = await ethersProvider.getSigner();
          setAccount(await signer.getAddress());
        }

        console.log('✅ Web3Auth initialized successfully');
      } catch (error) {
        console.error('❌ Web3Auth initialization error:', error);
        setError(error.message);
        // Don't throw - allow app to continue without Web3Auth
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async () => {
    if (!web3auth) {
      console.warn("Web3Auth not initialized");
      alert('Web3Auth is still loading. Please wait a moment and try again.');
      return;
    }

    try {
      console.log('🔑 Attempting login...');
      const web3authProvider = await web3auth.connect();
      setProvider(web3authProvider);
      
      const ethersProvider = new ethers.BrowserProvider(web3authProvider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      setAccount(address);
      
      console.log('✅ Login successful:', address);
      return address;
    } catch (error) {
      console.error('❌ Login error:', error);
      alert('Login failed: ' + error.message);
    }
  };

  const logout = async () => {
    if (!web3auth) {
      console.warn("Web3Auth not initialized");
      return;
    }

    try {
      await web3auth.logout();
      setProvider(null);
      setAccount(null);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const getProvider = () => {
    if (!provider) return null;
    return new ethers.BrowserProvider(provider);
  };

  const getSigner = async () => {
    const ethersProvider = getProvider();
    if (!ethersProvider) return null;
    return await ethersProvider.getSigner();
  };

  // If there's a critical error, show it in the UI
  if (error && !web3auth) {
    return (
      <div style={{
        padding: '2rem',
        maxWidth: '600px',
        margin: '2rem auto',
        backgroundColor: '#1e293b',
        color: '#f1f5f9',
        borderRadius: '1rem',
        border: '1px solid #f59e0b'
      }}>
        <h2 style={{ color: '#f59e0b', marginBottom: '1rem' }}>⚠️ Web3Auth Warning</h2>
        <p style={{ marginBottom: '1rem' }}>
          Web3Auth failed to initialize: {error}
        </p>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
          The app will continue to work, but wallet connection features will be limited.
          You can still view the interface and explore the protocol.
        </p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <Web3AuthContext.Provider
      value={{
        web3auth,
        provider,
        account,
        loading,
        error,
        login,
        logout,
        getProvider,
        getSigner,
        isConnected: !!account
      }}
    >
      {children}
    </Web3AuthContext.Provider>
  );
};
