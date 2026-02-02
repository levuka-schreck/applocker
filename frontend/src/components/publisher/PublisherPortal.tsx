'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper,
  DollarSign,
  Coins,
  Building,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  Info,
  RefreshCw,
  Download,
  History,
  Settings,
  Zap,
  Gift,
  Wallet,
  ArrowRight,
  CreditCard,
  Percent
} from 'lucide-react';
import { Card, Button, Input, Badge, Tabs, ProgressBar, Modal, StatDisplay, EmptyState } from '@/components/ui';
import { useAppStore } from '@/lib/store';
import { usePartnersApi, usePaymentRequestsApi } from '@/hooks/useApi';
import { formatUSDC, formatAddress } from '@/lib/utils';

type Tab = 'request' | 'earnings' | 'history' | 'preferences';

interface PaymentPreferences {
  defaultAppexPercentage: number;
  autoRequest: boolean;
  minimumThreshold: bigint;
}

const defaultPreferences: PaymentPreferences = {
  defaultAppexPercentage: 50,
  autoRequest: false,
  minimumThreshold: BigInt(100 * 1e6)
};

export const PublisherPortal = () => {
  const [activeTab, setActiveTab] = useState<Tab>('request');
  const [requestAmount, setRequestAmount] = useState('');
  const [appexPercentage, setAppexPercentage] = useState(defaultPreferences.defaultAppexPercentage);
  const [selectedBorrower, setSelectedBorrower] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [requestNote, setRequestNote] = useState('');

  const addNotification = useAppStore((state) => state.addNotification);
  const user = useAppStore((state) => state.user);
  
  // Use API hooks for persistent data
  const { partners } = usePartnersApi();
  const { paymentRequests, addPaymentRequest } = usePaymentRequestsApi();

  // Get selected partner details
  const selectedPartner = partners.find(p => p.address === selectedBorrower);

  // Get this publisher's requests
  const myRequests = user?.address 
    ? paymentRequests.filter(r => r.publisherAddress.toLowerCase() === user.address.toLowerCase())
    : [];

  // Calculate totals from requests
  const pendingRequests = myRequests.filter(r => r.status === 'pending');
  const paidRequests = myRequests.filter(r => r.status === 'paid');
  const totalPending = pendingRequests.reduce((acc, r) => acc + parseFloat(r.amount), 0);
  const totalPaid = paidRequests.reduce((acc, r) => acc + parseFloat(r.amount), 0);
  const totalEarnings = totalPending + totalPaid;

  const handleRequestPayment = () => {
    if (!requestAmount || parseFloat(requestAmount) <= 0) {
      addNotification({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid amount' });
      return;
    }
    if (!selectedBorrower) {
      addNotification({ type: 'error', title: 'No Partner Selected', message: 'Please select a partner company' });
      return;
    }
    if (!user?.address) {
      addNotification({ type: 'error', title: 'Not Connected', message: 'Please connect your wallet' });
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmRequest = async () => {
    if (!user?.address) return;
    
    setShowConfirmModal(false);
    setIsLoading(true);

    // Create the payment request via API
    const result = await addPaymentRequest({
      publisherAddress: user.address,
      borrowerAddress: selectedBorrower,
      amount: requestAmount,
      appexPercentage: appexPercentage,
      note: requestNote || undefined,
    });

    if (result) {
      addNotification({
        type: 'success',
        title: 'Payment Requested',
        message: `Request for $${requestAmount} sent to ${selectedPartner?.name || 'partner'}. They will review and process your payment.`
      });
    } else {
      addNotification({
        type: 'error',
        title: 'Request Failed',
        message: 'Failed to create payment request. Please try again.'
      });
    }

    setRequestAmount('');
    setSelectedBorrower('');
    setRequestNote('');
    setIsLoading(false);
  };

  const savePreferences = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    addNotification({
      type: 'success',
      title: 'Preferences Saved',
      message: 'Your payment preferences have been updated'
    });
    setIsLoading(false);
  };

  const tabs = [
    { id: 'request' as Tab, label: 'Request Payment', icon: <Download className="w-4 h-4" /> },
    { id: 'earnings' as Tab, label: 'My Earnings', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'history' as Tab, label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'preferences' as Tab, label: 'Preferences', icon: <Settings className="w-4 h-4" /> }
  ];

  const appexValue = requestAmount ? parseFloat(requestAmount) * (appexPercentage / 100) : 0;
  const usdcValue = requestAmount ? parseFloat(requestAmount) * ((100 - appexPercentage) / 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-appex-500 to-staking flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-white" />
            </div>
            Publisher Portal
          </h1>
          <p className="text-surface-400 mt-1">Request instant payments and manage your earnings</p>
        </div>
        <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-vault/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-vault" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Total Earnings</p>
              <p className="text-xl font-bold">${totalEarnings.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-staking/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-staking" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Pending</p>
              <p className="text-xl font-bold">${totalPending.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Received</p>
              <p className="text-xl font-bold">${totalPaid.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-appex-500/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-appex-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Requests</p>
              <p className="text-xl font-bold text-appex-400">{myRequests.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Interface */}
      <Card className="p-6">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as Tab)}
        />

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {activeTab === 'request' && (
              <motion.div
                key="request"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Hero Banner */}
                <div className="p-6 bg-gradient-to-r from-appex-500/20 to-vault/20 border border-appex-500/20 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-appex-500/30 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-appex-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Instant Payments</h3>
                      <p className="text-surface-400">
                        Get paid immediately instead of waiting 120-180 days. Choose your payment mix.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Select Partner */}
                <div className="space-y-3">
                  <label className="text-sm text-surface-400">Select Partner Company</label>
                  <div className="space-y-2">
                    {partners.length === 0 ? (
                      <div className="p-6 border border-dashed border-white/10 rounded-xl text-center">
                        <Building className="w-8 h-8 text-surface-500 mx-auto mb-2" />
                        <p className="text-surface-400">No partner companies available</p>
                        <p className="text-sm text-surface-500 mt-1">Partner companies will appear here once they are registered in the protocol</p>
                      </div>
                    ) : (
                      partners.map((partner) => (
                        <button
                          key={partner.address}
                          onClick={() => setSelectedBorrower(partner.address)}
                          className={`w-full p-4 rounded-xl border text-left transition-all ${
                            selectedBorrower === partner.address
                              ? 'border-appex-500 bg-appex-500/10'
                              : 'border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center">
                                <Building className="w-5 h-5 text-surface-300" />
                              </div>
                              <div>
                                <p className="font-medium">{partner.name}</p>
                                <p className="text-sm text-surface-400 font-mono">{formatAddress(partner.address)}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-surface-400">Borrow Limit</p>
                              <p className="font-semibold text-appex-400">${Number(partner.borrowLimit).toLocaleString()}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Request Amount */}
                <div className="space-y-2">
                  <label className="text-sm text-surface-400">Request Amount (USDC)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    leftElement={<DollarSign className="w-4 h-4" />}
                    className="text-xl"
                  />
                  {selectedPartner && (
                    <p className="text-xs text-surface-500">
                      Selected: {selectedPartner.name} (Limit: ${Number(selectedPartner.borrowLimit).toLocaleString()})
                    </p>
                  )}
                </div>

                {/* Payment Split */}
                <div className="space-y-4">
                  <label className="text-sm text-surface-400">Payment Split - Complete Optionality</label>
                  <div className="p-6 bg-surface-800/50 rounded-xl space-y-6">
                    {/* Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-appex-400" />
                          <span className="font-medium">$APPEX</span>
                        </div>
                        <span className="text-2xl font-bold text-appex-400">{appexPercentage}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={appexPercentage}
                        onChange={(e) => setAppexPercentage(parseInt(e.target.value))}
                        className="w-full h-3 bg-surface-700 rounded-full appearance-none cursor-pointer accent-appex-500"
                      />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-surface-400">0% APPEX</span>
                        <span className="text-surface-400">100% APPEX</span>
                      </div>
                    </div>

                    {/* Split Preview */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-appex-500/10 border border-appex-500/20 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="w-5 h-5 text-appex-400" />
                          <span className="font-medium">$APPEX</span>
                        </div>
                        <p className="text-2xl font-bold text-appex-400">${appexValue.toFixed(2)}</p>
                        <p className="text-xs text-surface-400 mt-1">Use for platform discounts or hold</p>
                      </div>
                      <div className="p-4 bg-vault/10 border border-vault/20 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-5 h-5 text-vault" />
                          <span className="font-medium">USDC</span>
                        </div>
                        <p className="text-2xl font-bold">${usdcValue.toFixed(2)}</p>
                        <p className="text-xs text-surface-400 mt-1">Instant stablecoin liquidity</p>
                      </div>
                    </div>

                    {/* Benefits Info */}
                    {appexPercentage > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <Gift className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-green-400">$APPEX Benefits</p>
                          <p className="text-surface-400">
                            Use $APPEX for discounted subscriptions and services within partner platforms, 
                            or hold for potential appreciation.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleRequestPayment}
                  isLoading={isLoading}
                  disabled={!requestAmount || !selectedBorrower || parseFloat(requestAmount) <= 0}
                  leftIcon={<Zap className="w-5 h-5" />}
                >
                  Request Instant Payment
                </Button>

                {/* Info Note */}
                <div className="flex items-start gap-3 p-4 bg-surface-800/50 rounded-xl">
                  <Info className="w-5 h-5 text-surface-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-surface-400">
                    <p className="font-medium text-surface-300 mb-1">Zero Fees for Publishers</p>
                    <p>
                      You pay nothing. The borrowing fees are covered by partner companies 
                      as part of their competitive advantage in offering instant payments.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'earnings' && (
              <motion.div
                key="earnings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Summary Cards */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="p-4 bg-gradient-to-br from-vault/10 to-transparent border-vault/20">
                    <p className="text-sm text-surface-400 mb-1">Total Received</p>
                    <p className="text-2xl font-bold">${totalPaid.toLocaleString()}</p>
                    <p className="text-xs text-surface-500 mt-1">{paidRequests.length} payments</p>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-staking/10 to-transparent border-staking/20">
                    <p className="text-sm text-surface-400 mb-1">Pending</p>
                    <p className="text-2xl font-bold">${totalPending.toLocaleString()}</p>
                    <p className="text-xs text-surface-500 mt-1">{pendingRequests.length} requests</p>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-appex-500/10 to-transparent border-appex-500/20">
                    <p className="text-sm text-surface-400 mb-1">Total Requests</p>
                    <p className="text-2xl font-bold text-appex-400">{myRequests.length}</p>
                    <p className="text-xs text-surface-500 mt-1">All time</p>
                  </Card>
                </div>

                {/* Earnings by Partner */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Earnings by Partner</h3>
                  {partners.length === 0 ? (
                    <div className="p-6 border border-dashed border-white/10 rounded-xl text-center">
                      <Building className="w-8 h-8 text-surface-500 mx-auto mb-2" />
                      <p className="text-surface-400">No partner earnings yet</p>
                      <p className="text-sm text-surface-500 mt-1">Earnings will appear here once you receive payments from partners</p>
                    </div>
                  ) : (
                    partners.map((partner) => {
                      const partnerRequests = myRequests.filter(r => r.borrowerAddress.toLowerCase() === partner.address.toLowerCase());
                      const paidFromPartner = partnerRequests.filter(r => r.status === 'paid');
                      const totalFromPartner = paidFromPartner.reduce((acc, r) => acc + parseFloat(r.amount), 0);
                      return (
                        <div key={partner.address} className="p-4 bg-surface-800/50 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-surface-700 flex items-center justify-center">
                                <Building className="w-5 h-5 text-surface-300" />
                              </div>
                              <div>
                                <p className="font-medium">{partner.name}</p>
                                <p className="text-sm text-surface-400">{paidFromPartner.length} payments</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">${totalFromPartner.toLocaleString()}</p>
                              <p className="text-sm text-surface-400">total earned</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <h3 className="font-semibold">Payment Requests</h3>
                <div className="space-y-3">
                  {myRequests.length === 0 ? (
                    <div className="p-8 border border-dashed border-white/10 rounded-xl text-center">
                      <History className="w-10 h-10 text-surface-500 mx-auto mb-3" />
                      <p className="text-surface-400 font-medium">No payment requests yet</p>
                      <p className="text-sm text-surface-500 mt-1">Your payment requests will appear here once you submit them</p>
                    </div>
                  ) : (
                    myRequests.map((request) => {
                      const partner = partners.find(p => p.address.toLowerCase() === request.borrowerAddress.toLowerCase());
                      return (
                        <div key={request.id} className="p-4 bg-surface-800/50 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                request.status === 'paid' ? 'bg-green-500/20' :
                                request.status === 'approved' ? 'bg-staking/20' :
                                request.status === 'rejected' ? 'bg-red-500/20' :
                                'bg-yellow-500/20'
                              }`}>
                                {request.status === 'paid' ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : request.status === 'approved' ? (
                                  <Clock className="w-5 h-5 text-staking" />
                                ) : request.status === 'rejected' ? (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                ) : (
                                  <Clock className="w-5 h-5 text-yellow-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{partner?.name || formatAddress(request.borrowerAddress)}</p>
                                <p className="text-sm text-surface-400">
                                  {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            <Badge variant={
                              request.status === 'paid' ? 'success' :
                              request.status === 'approved' ? 'warning' :
                              request.status === 'rejected' ? 'error' :
                              'default'
                            }>
                              {request.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-surface-400">Amount</p>
                              <p className="font-medium">${parseFloat(request.amount).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-surface-400">$APPEX %</p>
                              <p className="font-medium text-appex-400">{request.appexPercentage}%</p>
                            </div>
                            <div>
                              <p className="text-surface-400">USDC %</p>
                              <p className="font-medium">{100 - request.appexPercentage}%</p>
                            </div>
                          </div>
                          {request.note && (
                            <p className="mt-2 text-sm text-surface-400 italic">"{request.note}"</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'preferences' && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <h3 className="font-semibold">Payment Preferences</h3>

                {/* Default Split */}
                <div className="space-y-3">
                  <label className="text-sm text-surface-400">Default $APPEX Percentage</label>
                  <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span>$APPEX</span>
                      <span className="font-semibold text-appex-400">{preferences.defaultAppexPercentage}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={preferences.defaultAppexPercentage}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        defaultAppexPercentage: parseInt(e.target.value)
                      })}
                      className="w-full accent-appex-500"
                    />
                    <p className="text-xs text-surface-500">
                      This will be the default split for new payment requests
                    </p>
                  </div>
                </div>

                {/* Minimum Threshold */}
                <div className="space-y-2">
                  <label className="text-sm text-surface-400">Minimum Request Threshold (USDC)</label>
                  <Input
                    type="number"
                    placeholder="100.00"
                    value={formatUSDC(preferences.minimumThreshold, false)}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      minimumThreshold: BigInt(parseFloat(e.target.value || '0') * 1e6)
                    })}
                    leftElement={<DollarSign className="w-4 h-4" />}
                  />
                  <p className="text-xs text-surface-500">
                    Minimum amount required to request a payment
                  </p>
                </div>

                {/* Auto Request */}
                <div className="flex items-center justify-between p-4 bg-surface-800/50 rounded-xl">
                  <div>
                    <p className="font-medium">Auto-Request Payments</p>
                    <p className="text-sm text-surface-400">
                      Automatically request payment when earnings reach threshold
                    </p>
                  </div>
                  <button
                    onClick={() => setPreferences({ ...preferences, autoRequest: !preferences.autoRequest })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      preferences.autoRequest ? 'bg-appex-500' : 'bg-surface-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      preferences.autoRequest ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <Button
                  className="w-full"
                  onClick={savePreferences}
                  isLoading={isLoading}
                >
                  Save Preferences
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Payment Request"
      >
        <div className="space-y-4">
          <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-surface-400">Total Amount</span>
              <span className="font-semibold">${requestAmount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-400">$APPEX ({appexPercentage}%)</span>
              <span className="font-semibold text-appex-400">${appexValue.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-surface-400">USDC ({100 - appexPercentage}%)</span>
              <span className="font-semibold">${usdcValue.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-appex-500/10 border border-appex-500/20 rounded-xl">
            <Info className="w-5 h-5 text-appex-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-surface-300">
              Your payment will be processed near-instantly. $APPEX will be purchased 
              on the DEX and delivered to your wallet along with any USDC.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={confirmRequest}
              leftIcon={<Zap className="w-4 h-4" />}
            >
              Confirm Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
