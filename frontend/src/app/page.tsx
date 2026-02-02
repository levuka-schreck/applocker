'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  Zap, 
  Shield, 
  TrendingUp, 
  Users, 
  Coins,
  ArrowRight,
  ChevronRight,
  Globe,
  Lock,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/dashboard/Layout';
import { DashboardOverview } from '@/components/dashboard/Overview';
import { GovernancePortal } from '@/components/governance/GovernancePortal';
import { VaultInterface } from '@/components/vault/VaultInterface';
import { StakingInterface } from '@/components/staking/StakingInterface';
import { BorrowerPortal } from '@/components/borrower/BorrowerPortal';
import { BorrowerApplication } from '@/components/borrower/BorrowerApplication';
import { PublisherPortal } from '@/components/publisher/PublisherPortal';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { TransactionHistory } from '@/components/history/TransactionHistory';
import { Settings } from '@/components/settings/Settings';
import { Button, Card } from '@/components/ui';

// Landing Page Component
const LandingPage = () => {
  const { connect, isConnecting } = useAuth();
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Instant Settlements',
      description: 'Publishers receive payments instantly instead of waiting 120-180 days.'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Secure Protocol',
      description: 'Smart contract-based vault with audited security measures.'
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Competitive Yields',
      description: 'Earn 5-15% LP yield with additional staking rewards.'
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Governance Rights',
      description: 'Stake $APPEX to vote on borrower approvals and protocol parameters.'
    }
  ];

  const stats = [
    { label: 'Total Value Locked', value: '$0', suffix: 'M' },
    { label: 'Active Borrowers', value: '0', suffix: '' },
    { label: 'Publishers Paid', value: '0', suffix: '+' },
    { label: 'Avg. APY', value: '0', suffix: '%' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen mesh-bg overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-appex-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-vault/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.2, 0.4],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-appex-500 to-vault flex items-center justify-center">
            <span className="text-lg font-bold text-surface-950">A</span>
          </div>
          <div>
            <span className="text-xl font-bold text-gradient">AppEx</span>
            <p className="text-xs text-surface-400 hidden sm:block">Payments Protocol</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-surface-300 hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-surface-300 hover:text-white transition-colors">How It Works</a>
          <a href="https://docs.appex.io" target="_blank" className="text-surface-300 hover:text-white transition-colors">Docs</a>
        </div>

        <Button 
          onClick={connect}
          isLoading={isConnecting}
          leftIcon={<Wallet className="w-4 h-4" />}
        >
          Connect Wallet
        </Button>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 lg:px-12 pt-12 lg:pt-24 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-appex-500/10 border border-appex-500/20 rounded-full mb-6">
                <Sparkles className="w-4 h-4 text-appex-400" />
                <span className="text-sm text-appex-400">Now Live on Testnet</span>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-6">
                Instant Payments for{' '}
                <span className="text-gradient">Publishers</span>
              </h1>
              
              <p className="text-lg text-surface-300 mb-8 max-w-lg">
                Stop waiting 120-180 days for your earnings. AppEx Payments Protocol 
                enables near-instant settlements powered by decentralized liquidity vaults.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  onClick={connect}
                  isLoading={isConnecting}
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                >
                  Launch App
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => window.open('https://docs.appex.io', '_blank')}
                >
                  Read Whitepaper
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 pt-12 border-t border-white/5">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                  >
                    <p className="text-2xl font-bold">
                      {stat.value}
                      <span className="text-appex-400">{stat.suffix}</span>
                    </p>
                    <p className="text-sm text-surface-400">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Feature Cards Animation */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative aspect-square max-w-lg mx-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature}
                    initial={{ opacity: 0, scale: 0.9, rotateY: -30 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 0.9, rotateY: 30 }}
                    transition={{ duration: 0.5 }}
                    className="glass-card p-8 absolute inset-0 flex flex-col justify-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-appex-500/20 to-vault/20 flex items-center justify-center mb-6 text-appex-400">
                      {features[activeFeature].icon}
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{features[activeFeature].title}</h3>
                    <p className="text-surface-300">{features[activeFeature].description}</p>
                  </motion.div>
                </AnimatePresence>

                {/* Feature indicators */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                  {features.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveFeature(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === activeFeature ? 'w-8 bg-appex-500' : 'bg-surface-600'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 px-6 lg:px-12 py-20">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-surface-400 max-w-2xl mx-auto">
              A simple yet powerful protocol connecting liquidity providers, 
              partner companies, and publishers in a seamless payment ecosystem.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'LPs Provide Liquidity',
                description: 'Liquidity providers deposit USDC into the Payments Vault and receive LP tokens representing their share.',
                icon: <Coins className="w-6 h-6" />,
                color: 'from-appex-500 to-appex-600'
              },
              {
                step: '02',
                title: 'Borrowers Fund Payouts',
                description: 'Partner companies borrow from the vault to fund instant publisher payments, paying fees that generate LP yields.',
                icon: <Globe className="w-6 h-6" />,
                color: 'from-vault to-indigo-500'
              },
              {
                step: '03',
                title: 'Publishers Get Paid Instantly',
                description: 'Publishers receive payments immediately in $APPEX, USDC, or fiat - choosing their preferred mix.',
                icon: <Zap className="w-6 h-6" />,
                color: 'from-governance to-purple-500'
              }
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full group hover:border-appex-500/30">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <div className="text-sm font-mono text-appex-400 mb-2">{item.step}</div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-surface-400">{item.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative z-10 px-6 lg:px-12 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Complete <span className="text-gradient">Optionality</span>
              </h2>
              <p className="text-surface-300 mb-8">
                Publishers choose how they want to receive payments. $APPEX tokens 
                for platform discounts and potential appreciation, USDC for stability, 
                or fiat for traditional expenses.
              </p>

              <div className="space-y-4">
                {[
                  { label: '$APPEX Token', desc: 'Use within partner platforms for discounted services', pct: '40%' },
                  { label: 'USDC Stablecoin', desc: 'Instant liquidity with no volatility', pct: '40%' },
                  { label: 'Fiat Currency', desc: 'Direct bank transfers in 1-3 business days', pct: '20%' }
                ].map((option) => (
                  <div key={option.label} className="flex items-center gap-4 p-4 glass-card rounded-xl">
                    <div className="flex-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-surface-400">{option.desc}</p>
                    </div>
                    <div className="text-xl font-bold text-appex-400">{option.pct}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card p-8"
            >
              <h3 className="text-xl font-bold mb-6">For Liquidity Providers</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-appex-500/20 flex items-center justify-center text-appex-400 flex-shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">5-15% LP Yield</p>
                    <p className="text-sm text-surface-400">Based on payment terms (Net-30 to Net-180)</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-vault/20 flex items-center justify-center text-vault flex-shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">Staking Rewards</p>
                    <p className="text-sm text-surface-400">Stake $APPEX for additional protocol fee distributions</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-governance/20 flex items-center justify-center text-governance flex-shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">Governance Rights</p>
                    <p className="text-sm text-surface-400">Vote on borrower approvals and protocol parameters</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 lg:px-12 py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-appex-500/10 to-vault/10" />
            <div className="relative z-10">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-surface-300 mb-8 max-w-xl mx-auto">
                Connect your wallet to access the AppEx Payments Protocol. 
                Provide liquidity, stake tokens, or explore the ecosystem.
              </p>
              <Button
                size="lg"
                onClick={connect}
                isLoading={isConnecting}
                rightIcon={<ChevronRight className="w-5 h-5" />}
              >
                Connect Wallet
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 lg:px-12 py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-appex-500 to-vault flex items-center justify-center">
              <span className="text-sm font-bold text-surface-950">A</span>
            </div>
            <span className="font-semibold text-gradient">AppEx Protocol</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-surface-400">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
          <p className="text-sm text-surface-500">
            © 2024 AppEx Protocol. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

// Main Dashboard Content Router
const DashboardContent = () => {
  const activeTab = useAppStore((state) => state.activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'vault':
        return <VaultInterface />;
      case 'staking':
        return <StakingInterface />;
      case 'borrower':
        return <BorrowerPortal />;
      case 'publisher':
        return <PublisherPortal />;
      case 'apply':
        return <BorrowerApplication />;
      case 'governance':
        return <GovernancePortal />;
      case 'admin':
        return <AdminPanel />;
      case 'history':
        return <TransactionHistory />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <DashboardLayout>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
};

// Main Page Component
export default function Home() {
  const isConnected = useAppStore((state) => state.isConnected);
  const setPartners = useAppStore((state) => state.setPartners);
  const setPaymentRequests = useAppStore((state) => state.setPaymentRequests);
  const [mounted, setMounted] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load data from SQLite on mount
  useEffect(() => {
    if (mounted && !dataLoaded) {
      const loadData = async () => {
        try {
          // Fetch partners
          const partnersRes = await fetch('/api/partners');
          if (partnersRes.ok) {
            const partners = await partnersRes.json();
            setPartners(partners);
          }
          
          // Fetch payment requests
          const requestsRes = await fetch('/api/payment-requests');
          if (requestsRes.ok) {
            const requests = await requestsRes.json();
            setPaymentRequests(requests);
          }
        } catch (err) {
          console.error('Failed to load data:', err);
        }
        setDataLoaded(true);
      };
      loadData();
    }
  }, [mounted, dataLoaded, setPartners, setPaymentRequests]);

  if (!mounted) {
    return null;
  }

  return isConnected ? <DashboardContent /> : <LandingPage />;
}
