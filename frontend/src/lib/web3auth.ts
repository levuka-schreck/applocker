import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK, IProvider } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { getChainConfig } from "@/contracts";

const chainConfig = getChainConfig();

// Configure Web3Auth chain
const web3AuthChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: `0x${chainConfig.chainId.toString(16)}`,
  rpcTarget: chainConfig.rpcUrl,
  displayName: chainConfig.chainName,
  blockExplorerUrl: chainConfig.blockExplorer || "",
  ticker: chainConfig.nativeCurrency.symbol,
  tickerName: chainConfig.nativeCurrency.name,
};

// Initialize the Ethereum provider
const ethereumPrivateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig: web3AuthChainConfig },
});

// Create Web3Auth instance
let web3authInstance: Web3Auth | null = null;
let initializationFailed = false;
let initializationError: Error | null = null;

export const isWeb3AuthAvailable = (): boolean => {
  const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
  return !!clientId && clientId !== 'your_client_id_here' && !initializationFailed;
};

export const getWeb3Auth = async (): Promise<Web3Auth | null> => {
  // If initialization already failed, don't retry
  if (initializationFailed) {
    return null;
  }

  if (web3authInstance) {
    return web3authInstance;
  }

  const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
  
  // Check if we have a valid client ID
  if (!clientId || clientId === 'your_client_id_here') {
    console.warn('Web3Auth client ID not configured. Using MetaMask-only mode.');
    console.warn('Get a client ID from https://dashboard.web3auth.io');
    initializationFailed = true;
    return null;
  }

  try {
    web3authInstance = new Web3Auth({
      clientId,
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      privateKeyProvider: ethereumPrivateKeyProvider,
      uiConfig: {
        appName: "AppEx Payments Protocol",
        mode: "dark",
        loginMethodsOrder: ["google", "github", "twitter", "discord"],
        logoLight: "https://web3auth.io/images/w3a-L-Favicon-1.svg",
        logoDark: "https://web3auth.io/images/w3a-D-Favicon-1.svg",
        defaultLanguage: "en",
        primaryButton: "socialLogin",
        theme: {
          primary: "#00e6b8",
        },
      },
    });

    await web3authInstance.initModal();
    
    return web3authInstance;
  } catch (error) {
    console.error('Failed to initialize Web3Auth:', error);
    console.warn('Falling back to MetaMask-only mode.');
    initializationFailed = true;
    initializationError = error as Error;
    web3authInstance = null;
    return null;
  }
};

export const connectWeb3Auth = async (): Promise<IProvider | null> => {
  const web3auth = await getWeb3Auth();
  if (!web3auth) {
    return null;
  }
  const provider = await web3auth.connect();
  return provider;
};

export const disconnectWeb3Auth = async (): Promise<void> => {
  // Use the existing instance directly, don't call getWeb3Auth which might reinitialize
  if (web3authInstance && web3authInstance.connected) {
    try {
      await web3authInstance.logout();
    } catch (error) {
      console.error('Web3Auth logout error:', error);
    }
    // Reset the instance so a fresh login can happen
    web3authInstance = null;
    initializationFailed = false;
    initializationError = null;
  }
};

export const getUserInfo = async () => {
  const web3auth = await getWeb3Auth();
  if (!web3auth || !web3auth.connected) {
    return null;
  }
  return await web3auth.getUserInfo();
};

export const isWeb3AuthConnected = async (): Promise<boolean> => {
  const web3auth = await getWeb3Auth();
  return web3auth ? web3auth.connected : false;
};

export const getPrivateKey = async (): Promise<string | null> => {
  // Use existing instance directly
  if (!web3authInstance || !web3authInstance.connected || !web3authInstance.provider) {
    return null;
  }
  
  try {
    // Request private key from the provider using the correct method
    const privateKey = await web3authInstance.provider.request({
      method: "eth_private_key",
    }) as string;
    
    if (!privateKey) {
      return null;
    }
    
    // Ensure proper hex format with 0x prefix
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    
    // Validate it's a proper 32-byte hex string (64 chars + 0x prefix)
    if (formattedKey.length !== 66) {
      console.error('Invalid private key length:', formattedKey.length);
      return null;
    }
    
    return formattedKey;
  } catch (error) {
    console.error('Failed to get private key:', error);
    return null;
  }
};

export const getInitializationError = (): Error | null => initializationError;
