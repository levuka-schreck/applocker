'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { useAppStore } from '@/lib/store';
import { connectWeb3Auth, disconnectWeb3Auth, getUserInfo, getWeb3Auth, isWeb3AuthAvailable } from '@/lib/web3auth';
import { User, UserRole } from '@/types';

export const useAuth = () => {
  const {
    user,
    isConnecting,
    setUser,
    setProvider,
    setSigner,
    setIsConnecting,
    setIsConnected,
    disconnect: storeDisconnect,
    addNotification,
    setSelectedRole,
  } = useAppStore();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [web3AuthAvailable, setWeb3AuthAvailable] = useState(true);
  
  // Keep track of auth type for disconnect (since user gets cleared first)
  const authTypeRef = useRef<string | null>(null);
  
  // Update ref when user changes
  useEffect(() => {
    if (user?.authenticationType) {
      authTypeRef.current = user.authenticationType;
    }
  }, [user?.authenticationType]);

  // Initialize Web3Auth - only restore Web3Auth sessions, NOT MetaMask
  const initialize = useCallback(async () => {
    try {
      const web3auth = await getWeb3Auth();
      
      // Only auto-restore Web3Auth sessions (they persist across page loads)
      // Do NOT auto-connect MetaMask - user must explicitly connect
      if (web3auth && web3auth.connected && web3auth.provider) {
        const ethersProvider = new ethers.BrowserProvider(web3auth.provider);
        const signer = await ethersProvider.getSigner();
        const address = await signer.getAddress();
        
        const userInfo = await getUserInfo();
        
        const newUser: User = {
          address,
          name: userInfo?.name || undefined,
          email: userInfo?.email || undefined,
          profileImage: userInfo?.profileImage || undefined,
          roles: determineUserRoles(address),
          authenticationType: 'web3auth',
        };

        setUser(newUser);
        setProvider(ethersProvider);
        setSigner(signer);
        setIsConnected(true);
        setSelectedRole(newUser.roles[0] || 'guest');
      } else if (!web3auth) {
        // Web3Auth not available - that's fine, user can use MetaMask button
        setWeb3AuthAvailable(false);
        // Do NOT auto-connect to MetaMask here
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
      setWeb3AuthAvailable(false);
    } finally {
      setIsInitialized(true);
    }
  }, [setUser, setProvider, setSigner, setIsConnected, setSelectedRole]);

  // Connect with Web3Auth or MetaMask fallback
  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      // Try Web3Auth first if available
      if (web3AuthAvailable) {
        const web3authProvider = await connectWeb3Auth();
        
        if (web3authProvider) {
          const ethersProvider = new ethers.BrowserProvider(web3authProvider);
          const signer = await ethersProvider.getSigner();
          const address = await signer.getAddress();
          
          const userInfo = await getUserInfo();
          
          const newUser: User = {
            address,
            name: userInfo?.name || undefined,
            email: userInfo?.email || undefined,
            profileImage: userInfo?.profileImage || undefined,
            roles: determineUserRoles(address),
            authenticationType: 'web3auth',
          };

          setUser(newUser);
          setProvider(ethersProvider);
          setSigner(signer);
          setIsConnected(true);
          setSelectedRole(newUser.roles[0] || 'guest');

          addNotification({
            type: 'success',
            title: 'Connected',
            message: `Welcome, ${userInfo?.name || 'User'}!`,
          });

          return newUser;
        }
      }
      
      // Fall back to MetaMask
      console.log('Web3Auth unavailable, falling back to MetaMask...');
      const newUser = await connectMetaMask();
      return newUser;
    } catch (error: unknown) {
      console.error('Connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      addNotification({
        type: 'error',
        title: 'Connection failed',
        message: errorMessage,
      });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [web3AuthAvailable, setIsConnecting, setUser, setProvider, setSigner, setIsConnected, setSelectedRole, addNotification]);

  // Connect with MetaMask directly
  const connectMetaMask = useCallback(async () => {
    try {
      setIsConnecting(true);
      
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      await ethersProvider.send('eth_requestAccounts', []);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      
      const newUser: User = {
        address,
        roles: determineUserRoles(address),
        authenticationType: 'metamask',
      };

      setUser(newUser);
      setProvider(ethersProvider);
      setSigner(signer);
      setIsConnected(true);
      setSelectedRole(newUser.roles[0] || 'guest');

      addNotification({
        type: 'success',
        title: 'Connected',
        message: 'Successfully connected with MetaMask',
      });

      return newUser;
    } catch (error: unknown) {
      console.error('MetaMask connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      addNotification({
        type: 'error',
        title: 'Connection failed',
        message: errorMessage,
      });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [setIsConnecting, setUser, setProvider, setSigner, setIsConnected, setSelectedRole, addNotification]);

  // Disconnect
  const disconnect = useCallback(async () => {
    // Save auth type BEFORE clearing store
    const wasWeb3Auth = authTypeRef.current === 'web3auth';
    
    try {
      // Disconnect from Web3Auth first if needed
      if (wasWeb3Auth) {
        await disconnectWeb3Auth();
      }
    } catch (error) {
      console.error('Web3Auth disconnect error:', error);
      // Continue with store disconnect even if Web3Auth fails
    }
    
    // Clear store state
    storeDisconnect();
    
    // Clear the ref
    authTypeRef.current = null;
    
    addNotification({
      type: 'info',
      title: 'Disconnected',
      message: 'Your wallet has been disconnected',
    });
  }, [storeDisconnect, addNotification]);

  // Listen for MetaMask account changes - but only if user is connected via MetaMask
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    if (user?.authenticationType !== 'metamask') return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accountsArray = accounts as string[];
      if (accountsArray.length === 0) {
        // User disconnected in MetaMask
        storeDisconnect();
        authTypeRef.current = null;
      }
      // Don't auto-reconnect on account change - user should explicitly reconnect
    };

    const handleChainChanged = () => {
      // Reload on chain change
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [user?.authenticationType, storeDisconnect]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    user,
    isInitialized,
    isConnecting,
    connect,
    connectMetaMask,
    disconnect,
  };
};

// Helper function to determine user roles based on address
// In production, this would check on-chain data
function determineUserRoles(address: string): UserRole[] {
  const roles: UserRole[] = [];
  
  // For demo purposes, we'll assign all roles
  // In production, these would be checked against contract state
  roles.push('lp');
  roles.push('borrower');
  roles.push('publisher');
  
  // Check if admin (hardcoded for demo)
  const adminAddresses = [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Anvil default account 0
  ];
  
  if (adminAddresses.includes(address)) {
    roles.push('admin');
  }
  
  return roles.length > 0 ? roles : ['guest'];
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}
