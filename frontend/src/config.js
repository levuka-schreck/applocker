// Environment Configuration
// This file contains configuration that can be customized

export const config = {
  // Web3Auth Client ID
  // This is a public testnet Client ID for development
  // For production, get your own from: https://dashboard.web3auth.io/
  web3AuthClientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID || 
    "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
  
  // Web3Auth Network
  // IMPORTANT: Use 'sapphire_devnet' for testing without registration
  // Options: 'sapphire_devnet', 'sapphire_mainnet', 'testnet', 'mainnet', 'cyan', 'aqua'
  web3AuthNetwork: import.meta.env.VITE_WEB3AUTH_NETWORK || 'sapphire_devnet',
  
  // Chain Configuration
  chainId: import.meta.env.VITE_CHAIN_ID || "0x7A69", // 31337 for Anvil
  rpcUrl: import.meta.env.VITE_RPC_URL || "http://localhost:8545",
  chainName: import.meta.env.VITE_CHAIN_NAME || "Anvil Local",
  blockExplorer: import.meta.env.VITE_BLOCK_EXPLORER || "",
  nativeCurrency: {
    name: import.meta.env.VITE_CURRENCY_NAME || "Ethereum",
    symbol: import.meta.env.VITE_CURRENCY_SYMBOL || "ETH",
    decimals: 18
  }
};
