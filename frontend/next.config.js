/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false,
      encoding: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  env: {
    NEXT_PUBLIC_WEB3AUTH_CLIENT_ID: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '31337',
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545',
    NEXT_PUBLIC_PAYMENTS_VAULT_ADDRESS: process.env.NEXT_PUBLIC_PAYMENTS_VAULT_ADDRESS,
    NEXT_PUBLIC_APPEX_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_APPEX_TOKEN_ADDRESS,
    NEXT_PUBLIC_USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS,
    NEXT_PUBLIC_LP_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_LP_TOKEN_ADDRESS,
  },
}

module.exports = nextConfig
