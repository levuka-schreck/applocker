'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  ArrowUpFromLine,
  ArrowDownToLine,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  Info,
  RefreshCw,
  Send,
  Receipt,
  Wallet,
  CreditCard,
  Percent,
  Coins
} from 'lucide-react';
import { Card, Button, Input, Badge, Tabs, ProgressBar, Modal, StatDisplay, EmptyState } from '@/components/ui';
import { useAppStore } from '@/lib/store';
import { useBorrowerManagement } from '@/hooks/useContracts';
import { usePartnersApi, usePaymentRequestsApi } from '@/hooks/useApi';
import { formatUSDC, formatToken, formatAddress } from '@/lib/utils';

type Tab = 'overview' | 'borrow' | 'repay' | 'payments' | 'fees';

interface Loan {
  id: string;
  amount: bigint;
  lpFee: bigint;
  protocolFee: bigint;
  publisher: string;
  appexPercentage: number;
  usdcPercentage: number;
  createdAt: Date;
  status: 'active' | 'repaid';
  protocolFeePaid: boolean;
  feesOwed: bigint;
}

export const BorrowerPortal = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [publisherAddress, setPublisherAddress] = useState('');
  const [appexPercentage, setAppexPercentage] = useState(50);
  const [repayAmount, setRepayAmount] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [feePaymentAmount, setFeePaymentAmount] = useState('');
  const [payInAppex, setPayInAppex] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPayRequestModal, setShowPayRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'borrow' | 'repay' | 'payFees' | 'payRequest' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addNotification = useAppStore((state) => state.addNotification);
  const selectedRole = useAppStore((state) => state.selectedRole);
  const setGlobalActiveTab = useAppStore((state) => state.setActiveTab);
  const user = useAppStore((state) => state.user);
  
  // Use API hooks for persistent data
  const { partners } = usePartnersApi();
  const { paymentRequests, updatePaymentRequest } = usePaymentRequestsApi();

  // Fetch real borrower data from contract
  const { 
    currentUserBorrower, 
    refetchCurrentBorrower, 
    borrowerStatusLoading,
    createLoan,
    isLoading: loanLoading,
    loans: contractLoans,
    loansLoading,
    fetchLoans,
    repayLoan,
    payProtocolFee,
  } = useBorrowerManagement();

  // Get pending payment requests for this borrower
  const pendingRequests = user?.address
    ? paymentRequests.filter(
        r => r.borrowerAddress.toLowerCase() === user.address.toLowerCase() && r.status === 'pending'
      )
    : [];

  // Get company name from partners store (if exists)
  const partnerInfo = user?.address 
    ? partners.find(p => p.address.toLowerCase() === user.address.toLowerCase())
    : null;

  // Calculate total protocol fees owed from loans where protocol fee not paid
  const totalProtocolFeesOwed = contractLoans
    .filter(l => !l.protocolFeePaid)
    .reduce((sum, l) => sum + l.protocolFee, 0n);

  // Convert contract data to display format
  const borrowerData = currentUserBorrower ? {
    approved: currentUserBorrower.approved,
    companyName: partnerInfo?.name || 'Your Company',
    borrowingLimit: currentUserBorrower.borrowLimit,
    currentOutstanding: currentUserBorrower.currentDebt,
    totalBorrowed: currentUserBorrower.totalBorrowed,
    totalRepaid: currentUserBorrower.totalRepaid,
    totalFeesPaid: currentUserBorrower.totalFeesPaid,
    feesOwed: totalProtocolFeesOwed,
    approvalDate: new Date(),
    lpYieldRate: currentUserBorrower.lpYieldRate,
    protocolFeeRate: currentUserBorrower.protocolFeeRate,
  } : null;

  // Map contract loans to UI Loan interface
  const loans: Loan[] = contractLoans.map(loan => ({
    id: loan.id,
    amount: loan.principal,
    lpFee: loan.lpFee,
    protocolFee: loan.protocolFee,
    publisher: loan.publisher,
    appexPercentage: 0, // Not tracked per-loan in contract
    usdcPercentage: 100,
    createdAt: new Date(loan.startTime * 1000),
    status: loan.repaid ? 'repaid' as const : 'active' as const,
    protocolFeePaid: loan.protocolFeePaid,
    feesOwed: loan.protocolFee,
  }));

  const availableCredit = borrowerData 
    ? borrowerData.borrowingLimit - borrowerData.currentOutstanding
    : 0n;
  const utilizationRate = borrowerData && borrowerData.borrowingLimit > 0n 
    ? Number(borrowerData.currentOutstanding) / Number(borrowerData.borrowingLimit)
    : 0;

  const handleApplyForBorrower = () => {
    addNotification({
      type: 'info',
      title: 'Borrower Application',
      message: 'Submit your application to become an approved borrower.',
    });
    // Navigate to Apply as Borrower panel
    setGlobalActiveTab('apply');
  };

  const handleBorrow = () => {
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) {
      addNotification({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid borrow amount' });
      return;
    }
    if (!publisherAddress || !publisherAddress.startsWith('0x')) {
      addNotification({ type: 'error', title: 'Invalid Address', message: 'Please enter a valid publisher address' });
      return;
    }
    setPendingAction('borrow');
    setShowConfirmModal(true);
  };

  const handleRepay = () => {
    if (!selectedLoanId) {
      addNotification({ type: 'error', title: 'No Loan Selected', message: 'Please select a loan to repay' });
      return;
    }
    setPendingAction('repay');
    setShowConfirmModal(true);
  };

  const handlePayFees = () => {
    if (!feePaymentAmount || parseFloat(feePaymentAmount) <= 0) {
      addNotification({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid fee payment amount' });
      return;
    }
    setPendingAction('payFees');
    setShowConfirmModal(true);
  };

  // Handle paying a publisher's request
  const handlePayRequest = async () => {
    if (!selectedRequest) return;
    
    const request = pendingRequests.find(r => r.id === selectedRequest);
    if (!request) return;

    setShowPayRequestModal(false);
    setIsLoading(true);

    try {
      // Call createLoan on the contract
      const loanId = await createLoan(
        request.publisherAddress,
        request.amount,
        30, // 30 day term
        request.appexPercentage > 0, // payInAppex
        request.appexPercentage
      );

      if (loanId !== null) {
        // Update the payment request status via API
        await updatePaymentRequest(request.id, { 
          status: 'paid', 
          processedAt: Date.now(),
          loanId: Number(loanId)
        });
        
        addNotification({
          type: 'success',
          title: 'Payment Sent',
          message: `$${parseFloat(request.amount).toLocaleString()} sent to publisher`
        });

        // Refresh loans list to show the new loan
        await fetchLoans();
        await refetchCurrentBorrower();
      }
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsLoading(false);
      setSelectedRequest(null);
      setPendingAction(null);
    }
  };

  const confirmAction = async () => {
    setShowConfirmModal(false);
    setIsLoading(true);

    try {
      if (pendingAction === 'borrow') {
        // Call createLoan on the contract
        const loanId = await createLoan(
          publisherAddress,
          borrowAmount,
          30, // 30 day term
          appexPercentage > 0, // payInAppex
          appexPercentage
        );

        if (loanId !== null) {
          addNotification({ type: 'success', title: 'Loan Created', message: `Successfully borrowed ${borrowAmount} USDC` });
          setBorrowAmount('');
          setPublisherAddress('');
          await fetchLoans(); // Refresh loans list
        }
      } else if (pendingAction === 'repay') {
        // Repay principal + LP fee only (new contract)
        const success = await repayLoan(selectedLoanId);
        if (success) {
          setSelectedLoanId('');
        }
      } else if (pendingAction === 'payFees') {
        // Pay protocol fee separately (with APPEX discount option)
        const success = await payProtocolFee(selectedLoanId, payInAppex);
        if (success) {
          setSelectedLoanId('');
          setPayInAppex(false);
        }
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setIsLoading(false);
      setPendingAction(null);
    }
  };

  const tabs = [
    { id: 'overview' as Tab, label: 'Overview', icon: <Building2 className="w-4 h-4" /> },
    { id: 'borrow' as Tab, label: 'Borrow', icon: <ArrowDownToLine className="w-4 h-4" /> },
    { id: 'repay' as Tab, label: 'Repay', icon: <ArrowUpFromLine className="w-4 h-4" /> },
    { id: 'payments' as Tab, label: 'Payments', icon: <Send className="w-4 h-4" /> },
    { id: 'fees' as Tab, label: 'Fees', icon: <Receipt className="w-4 h-4" /> }
  ];

  // Loading state
  if (borrowerStatusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-surface-700 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Building2 className="w-8 h-8 text-surface-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Loading Borrower Status...</h2>
          <p className="text-surface-400">Checking your borrower approval status</p>
        </Card>
      </div>
    );
  }

  // Check if user has borrower access
  if (!borrowerData || !borrowerData.approved) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Borrower Access Required</h2>
          <p className="text-surface-400 mb-6">
            You need to be an approved borrower to access this portal. 
            Submit an application to get started.
          </p>
          <div className="space-y-3">
            <Button onClick={handleApplyForBorrower} leftIcon={<FileText className="w-4 h-4" />}>
              Apply as Borrower
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => refetchCurrentBorrower()}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh Status
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-governance to-vault flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            Borrower Portal
          </h1>
          <p className="text-surface-400 mt-1">{borrowerData.companyName} - Manage loans and publisher payments</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved Borrower
          </Badge>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-vault/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-vault" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Borrowing Limit</p>
              <p className="text-xl font-bold">${formatUSDC(borrowerData.borrowingLimit)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-staking/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-staking" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Outstanding</p>
              <p className="text-xl font-bold">${formatUSDC(borrowerData.currentOutstanding)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-appex-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-appex-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Available Credit</p>
              <p className="text-xl font-bold text-appex-400">${formatUSDC(availableCredit)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-governance/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-governance" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Fees Owed</p>
              <p className="text-xl font-bold">${formatUSDC(borrowerData.feesOwed)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Credit Utilization */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-surface-400">Credit Utilization</span>
          <Badge variant={utilizationRate > 0.8 ? 'error' : utilizationRate > 0.6 ? 'warning' : 'success'}>
            {(utilizationRate * 100).toFixed(1)}%
          </Badge>
        </div>
        <ProgressBar 
          value={utilizationRate * 100} 
          max={100} 
          variant={utilizationRate > 0.8 ? 'danger' : utilizationRate > 0.6 ? 'warning' : 'success'} 
        />
        <div className="flex items-center justify-between mt-2 text-sm text-surface-500">
          <span>${formatUSDC(borrowerData.currentOutstanding)} used</span>
          <span>${formatUSDC(availableCredit)} available</span>
        </div>
      </Card>

      {/* Main Interface */}
      <Card className="p-6">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as Tab)}
        />

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Account Summary */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Account Summary</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-surface-400">Company Name</span>
                        <span className="font-medium">{borrowerData.companyName}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-surface-400">Approval Date</span>
                        <span className="font-medium">{borrowerData.approvalDate.toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-surface-400">Total Borrowed</span>
                        <span className="font-medium">${formatUSDC(borrowerData.totalBorrowed)}</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-surface-400">Total Repaid</span>
                        <span className="font-medium">${formatUSDC(borrowerData.totalRepaid)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Loans */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Active Loans ({loansLoading ? '...' : loans.filter(l => l.status === 'active').length})</h3>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {loansLoading ? (
                        <div className="p-4 bg-surface-800/50 rounded-xl text-center text-surface-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                          <p>Loading loans...</p>
                        </div>
                      ) : loans.filter(l => l.status === 'active').length === 0 ? (
                        <div className="p-4 bg-surface-800/50 rounded-xl text-center text-surface-400">
                          <p>No active loans</p>
                        </div>
                      ) : (
                        loans.filter(l => l.status === 'active').map((loan) => (
                          <div key={loan.id} className="p-3 bg-surface-800/50 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono text-sm">Loan #{loan.id}</span>
                              <Badge variant="warning">Active</Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-surface-400">Amount</span>
                              <span>${formatUSDC(loan.amount)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-surface-400">Age</span>
                              <span>{Math.floor((Date.now() - loan.createdAt.getTime()) / (24 * 60 * 60 * 1000))} days</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'borrow' && (
              <motion.div
                key="borrow"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Available Credit */}
                <div className="p-4 bg-appex-500/10 border border-appex-500/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-6 h-6 text-appex-400" />
                    <div>
                      <p className="text-sm text-surface-400">Available to Borrow</p>
                      <p className="text-2xl font-bold text-appex-400">${formatUSDC(availableCredit)}</p>
                    </div>
                  </div>
                </div>

                {/* Borrow Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-surface-400">Borrow Amount (USDC)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={borrowAmount}
                      onChange={(e) => setBorrowAmount(e.target.value)}
                      leftElement={<DollarSign className="w-4 h-4" />}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-surface-400">Publisher Address</label>
                    <Input
                      type="text"
                      placeholder="0x..."
                      value={publisherAddress}
                      onChange={(e) => setPublisherAddress(e.target.value)}
                      leftElement={<Users className="w-4 h-4" />}
                    />
                    <p className="text-xs text-surface-500">The address that will receive the payment</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm text-surface-400">Payment Split</label>
                    <div className="p-4 bg-surface-800/50 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <span>$APPEX</span>
                        <span className="font-semibold text-appex-400">{appexPercentage}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={appexPercentage}
                        onChange={(e) => setAppexPercentage(parseInt(e.target.value))}
                        className="w-full accent-appex-500"
                      />
                      <div className="flex items-center justify-between text-sm text-surface-400">
                        <span>USDC: {100 - appexPercentage}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {borrowAmount && parseFloat(borrowAmount) > 0 && publisherAddress && (
                  <div className="p-4 bg-vault/10 border border-vault/20 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-sm text-vault">
                      <Info className="w-4 h-4" />
                      <span>Transaction Preview</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400">Borrowing</span>
                      <span className="font-semibold">${borrowAmount} USDC</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400">Publisher receives $APPEX</span>
                      <span className="font-semibold">{appexPercentage}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400">Publisher receives USDC</span>
                      <span className="font-semibold">{100 - appexPercentage}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400">Est. Fees (5%)</span>
                      <span className="font-semibold">${(parseFloat(borrowAmount) * 0.05).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleBorrow}
                  isLoading={isLoading}
                  disabled={!borrowAmount || !publisherAddress || parseFloat(borrowAmount) <= 0}
                  leftIcon={<ArrowDownToLine className="w-5 h-5" />}
                >
                  Create Loan & Pay Publisher
                </Button>
              </motion.div>
            )}

            {activeTab === 'repay' && (
              <motion.div
                key="repay"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Outstanding Amount */}
                <div className="p-4 bg-staking/10 border border-staking/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-staking" />
                    <div>
                      <p className="text-sm text-surface-400">Total Outstanding</p>
                      <p className="text-2xl font-bold">${formatUSDC(borrowerData.currentOutstanding)}</p>
                    </div>
                  </div>
                </div>

                {/* Loans needing principal repayment */}
                <div className="space-y-3">
                  <label className="text-sm text-surface-400">Principal Repayment</label>
                  <div className="space-y-2">
                    {loans.filter(l => l.status === 'active' && !contractLoans.find(cl => cl.id === l.id)?.repaid).length === 0 ? (
                      <div className="p-4 bg-surface-800/50 rounded-xl text-center text-surface-400">
                        <p>No loans need principal repayment</p>
                      </div>
                    ) : (
                      loans.filter(l => {
                        const contractLoan = contractLoans.find(cl => cl.id === l.id);
                        return contractLoan && !contractLoan.repaid;
                      }).map((loan) => (
                        <div
                          key={loan.id}
                          className="p-4 rounded-xl border border-white/10"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm">Loan #{loan.id}</span>
                            <Badge variant="warning">Principal Due</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <div>
                              <span className="text-surface-400">Principal:</span>
                              <span className="ml-2 font-medium">${formatUSDC(loan.amount)}</span>
                            </div>
                            <div>
                              <span className="text-surface-400">LP Fee:</span>
                              <span className="ml-2 font-medium">${formatUSDC(loan.lpFee)}</span>
                            </div>
                          </div>
                          <div className="p-3 bg-surface-800/50 rounded-lg mb-3">
                            <div className="flex justify-between items-center">
                              <span className="text-surface-400">Amount Due:</span>
                              <span className="text-lg font-bold text-appex-400">
                                ${formatUSDC(loan.amount + loan.lpFee)}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedLoanId(loan.id);
                              setPendingAction('repay');
                              setShowConfirmModal(true);
                            }}
                            isLoading={isLoading && selectedLoanId === loan.id && pendingAction === 'repay'}
                          >
                            Repay Principal + LP Fee
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Protocol fees due */}
                <div className="space-y-3">
                  <label className="text-sm text-surface-400">Protocol Fees Due</label>
                  <div className="space-y-2">
                    {loans.filter(l => !l.protocolFeePaid).length === 0 ? (
                      <div className="p-4 bg-surface-800/50 rounded-xl text-center text-surface-400">
                        <p>No protocol fees outstanding</p>
                      </div>
                    ) : (
                      loans.filter(l => !l.protocolFeePaid).map((loan) => (
                        <div
                          key={`fee-${loan.id}`}
                          className="p-4 rounded-xl border border-white/10"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm">Loan #{loan.id}</span>
                            <Badge variant="info">Fee Due</Badge>
                          </div>
                          <div className="text-sm mb-3">
                            <span className="text-surface-400">Protocol Fee:</span>
                            <span className="ml-2 font-medium">${formatUSDC(loan.protocolFee)}</span>
                          </div>
                          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg mb-3">
                            <p className="text-xs text-green-400">
                              💡 Pay with $APPEX for 25% discount: ${formatUSDC(loan.protocolFee * 75n / 100n)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1"
                              onClick={() => {
                                setSelectedLoanId(loan.id);
                                setPayInAppex(false);
                                setPendingAction('payFees');
                                setShowConfirmModal(true);
                              }}
                              isLoading={isLoading && selectedLoanId === loan.id && !payInAppex && pendingAction === 'payFees'}
                            >
                              Pay ${formatUSDC(loan.protocolFee)} USDC
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 bg-staking hover:bg-staking/90"
                              onClick={() => {
                                setSelectedLoanId(loan.id);
                                setPayInAppex(true);
                                setPendingAction('payFees');
                                setShowConfirmModal(true);
                              }}
                              isLoading={isLoading && selectedLoanId === loan.id && payInAppex && pendingAction === 'payFees'}
                            >
                              Pay ${formatUSDC(loan.protocolFee * 75n / 100n)} APPEX
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Debug Info - helps diagnose address matching issues */}
                <div className="p-3 bg-surface-800/30 border border-surface-700 rounded-lg text-xs font-mono">
                  <p className="text-surface-500">Your address: <span className="text-surface-300">{user?.address || 'Not connected'}</span></p>
                  <p className="text-surface-500">Total requests in system: <span className="text-surface-300">{paymentRequests.length}</span></p>
                  <p className="text-surface-500">Requests for you: <span className="text-surface-300">{pendingRequests.length}</span></p>
                </div>

                {/* Pending Requests Banner */}
                {pendingRequests.length > 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-yellow-400">{pendingRequests.length} Pending Payment Request{pendingRequests.length > 1 ? 's' : ''}</p>
                        <p className="text-sm text-surface-400">Publishers are waiting for payment</p>
                      </div>
                    </div>
                  </div>
                )}

                <h3 className="font-semibold">Publisher Payment Requests</h3>
                <p className="text-sm text-surface-400">
                  Review and process payment requests from publishers. When you approve a request, 
                  funds are borrowed from the vault and sent directly to the publisher.
                </p>

                <div className="space-y-3">
                  {pendingRequests.length === 0 ? (
                    <div className="p-8 border border-dashed border-white/10 rounded-xl text-center">
                      <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                      <p className="text-surface-400 font-medium">No pending requests</p>
                      <p className="text-sm text-surface-500 mt-1">All publisher payment requests have been processed</p>
                      {paymentRequests.length > 0 && (
                        <p className="text-xs text-surface-600 mt-3">
                          Note: There are {paymentRequests.length} request(s) in the system for other borrower addresses.
                        </p>
                      )}
                    </div>
                  ) : (
                    pendingRequests.map((request) => (
                      <div key={request.id} className="p-4 bg-surface-800/50 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                              <Clock className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div>
                              <p className="font-mono text-sm">{formatAddress(request.publisherAddress)}</p>
                              <p className="text-sm text-surface-400">
                                {new Date(request.createdAt).toLocaleDateString()} at {new Date(request.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant="warning">Pending</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-surface-400">Amount</p>
                            <p className="font-medium text-lg">${parseFloat(request.amount).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-surface-400">$APPEX</p>
                            <p className="font-medium text-appex-400">{request.appexPercentage}%</p>
                          </div>
                          <div>
                            <p className="text-surface-400">USDC</p>
                            <p className="font-medium">{100 - request.appexPercentage}%</p>
                          </div>
                        </div>
                        {request.note && (
                          <p className="text-sm text-surface-400 italic mb-4">"{request.note}"</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => {
                              setSelectedRequest(request.id);
                              setPendingAction('payRequest');
                              setShowPayRequestModal(true);
                            }}
                            leftIcon={<CheckCircle className="w-4 h-4" />}
                          >
                            Approve & Pay
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              await updatePaymentRequest(request.id, { status: 'rejected', processedAt: Date.now() });
                              addNotification({
                                type: 'info',
                                title: 'Request Rejected',
                                message: 'Payment request has been rejected'
                              });
                            }}
                            leftIcon={<XCircle className="w-4 h-4" />}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Past Payments */}
                <h3 className="font-semibold mt-8">Payment History</h3>
                <div className="space-y-3">
                  {loans.length === 0 ? (
                    <p className="text-sm text-surface-500">No payment history yet</p>
                  ) : (
                    loans.map((loan) => (
                      <div key={loan.id} className="p-4 bg-surface-800/50 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              loan.status === 'active' ? 'bg-staking/20' : 'bg-green-500/20'
                            }`}>
                              {loan.status === 'active' ? (
                                <Clock className="w-5 h-5 text-staking" />
                              ) : (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-mono text-sm">{loan.id}</p>
                              <p className="text-sm text-surface-400">
                                {loan.createdAt.toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={loan.status === 'active' ? 'warning' : 'success'}>
                            {loan.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-surface-400">Amount</p>
                            <p className="font-medium">${formatUSDC(loan.amount)}</p>
                          </div>
                          <div>
                            <p className="text-surface-400">Publisher</p>
                            <p className="font-medium font-mono">{formatAddress(loan.publisher)}</p>
                          </div>
                          <div>
                            <p className="text-surface-400">Split</p>
                            <p className="font-medium">{loan.appexPercentage}% APPEX / {loan.usdcPercentage}% USDC</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'fees' && (
              <motion.div
                key="fees"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Fees Owed */}
                <div className="p-4 bg-governance/10 border border-governance/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Receipt className="w-6 h-6 text-governance" />
                      <div>
                        <p className="text-sm text-surface-400">Protocol Fees Owed</p>
                        <p className="text-2xl font-bold">${formatUSDC(borrowerData.feesOwed)}</p>
                      </div>
                    </div>
                    {borrowerData.feesOwed > 0n && (
                      <Badge variant="warning">Payment Due</Badge>
                    )}
                  </div>
                </div>

                {/* Payment Options */}
                <div className="space-y-3">
                  <label className="text-sm text-surface-400">Payment Method</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPayInAppex(false)}
                      className={`p-4 rounded-xl border transition-all ${
                        !payInAppex
                          ? 'border-appex-500 bg-appex-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <DollarSign className={`w-6 h-6 mb-2 ${!payInAppex ? 'text-appex-400' : 'text-surface-400'}`} />
                      <p className="font-medium">Pay in USDC</p>
                      <p className="text-sm text-surface-400">Standard rate</p>
                    </button>
                    <button
                      onClick={() => setPayInAppex(true)}
                      className={`p-4 rounded-xl border transition-all ${
                        payInAppex
                          ? 'border-staking bg-staking/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <Coins className={`w-6 h-6 mb-2 ${payInAppex ? 'text-staking' : 'text-surface-400'}`} />
                      <p className="font-medium">Pay in $APPEX</p>
                      <p className="text-sm text-green-400">25% discount!</p>
                    </button>
                  </div>
                </div>

                {/* Fee Payment Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-surface-400">
                      Payment Amount ({payInAppex ? '$APPEX' : 'USDC'})
                    </label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setFeePaymentAmount(formatUSDC(borrowerData.feesOwed, false))}
                    >
                      Pay All
                    </Button>
                  </div>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={feePaymentAmount}
                    onChange={(e) => setFeePaymentAmount(e.target.value)}
                    leftElement={payInAppex ? <Coins className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                  />
                </div>

                {/* Discount Preview */}
                {payInAppex && feePaymentAmount && parseFloat(feePaymentAmount) > 0 && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                      <Percent className="w-4 h-4" />
                      <span>25% Discount Applied!</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400">You save</span>
                      <span className="font-semibold text-green-400">
                        ${(parseFloat(feePaymentAmount) * 0.25).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePayFees}
                  isLoading={isLoading}
                  disabled={!feePaymentAmount || parseFloat(feePaymentAmount) <= 0}
                  leftIcon={<CreditCard className="w-5 h-5" />}
                >
                  Pay Fees
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
        title={
          pendingAction === 'borrow' ? 'Confirm Loan' :
          pendingAction === 'repay' ? 'Confirm Repayment' :
          'Confirm Fee Payment'
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
            {pendingAction === 'borrow' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Borrowing</span>
                  <span className="font-semibold">${borrowAmount} USDC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Publisher</span>
                  <span className="font-semibold font-mono">{formatAddress(publisherAddress)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">$APPEX Split</span>
                  <span className="font-semibold">{appexPercentage}%</span>
                </div>
              </>
            )}
            {pendingAction === 'repay' && selectedLoanId && (() => {
              const loan = loans.find(l => l.id === selectedLoanId);
              const principal = loan?.amount || 0n;
              const lpFee = loan?.lpFee || 0n;
              const totalDue = principal + lpFee;
              
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Loan ID</span>
                    <span className="font-semibold font-mono">#{selectedLoanId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Principal</span>
                    <span className="font-semibold">${formatUSDC(principal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">LP Fee</span>
                    <span className="font-semibold">${formatUSDC(lpFee)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-surface-400">Total Payment</span>
                    <span className="font-bold text-appex-400">${formatUSDC(totalDue)}</span>
                  </div>
                  <p className="text-xs text-surface-500 mt-2">Note: Protocol fee will be paid separately</p>
                </>
              );
            })()}
            {pendingAction === 'payFees' && selectedLoanId && (() => {
              const loan = loans.find(l => l.id === selectedLoanId);
              const protocolFee = loan?.protocolFee || 0n;
              const discountedFee = protocolFee * 75n / 100n;
              
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Loan ID</span>
                    <span className="font-semibold font-mono">#{selectedLoanId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Protocol Fee</span>
                    <span className="font-semibold">${formatUSDC(protocolFee)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Payment Method</span>
                    <span className="font-semibold">{payInAppex ? '$APPEX' : 'USDC'}</span>
                  </div>
                  {payInAppex && (
                    <>
                      <div className="flex items-center justify-between text-green-400">
                        <span>25% Discount Applied</span>
                        <span className="font-semibold">-${formatUSDC(protocolFee - discountedFee)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-surface-400">You Pay</span>
                        <span className="font-bold text-green-400">${formatUSDC(discountedFee)} APPEX</span>
                      </div>
                    </>
                  )}
                  {!payInAppex && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <span className="text-surface-400">You Pay</span>
                      <span className="font-bold text-appex-400">${formatUSDC(protocolFee)} USDC</span>
                    </div>
                  )}
                </>
              );
            })()}
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
              onClick={confirmAction}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pay Request Modal */}
      <Modal
        isOpen={showPayRequestModal}
        onClose={() => {
          setShowPayRequestModal(false);
          setSelectedRequest(null);
          setPendingAction(null);
        }}
        title="Confirm Publisher Payment"
      >
        {selectedRequest && (() => {
          const request = pendingRequests.find(r => r.id === selectedRequest);
          if (!request) return null;
          
          const appexAmount = parseFloat(request.amount) * (request.appexPercentage / 100);
          const usdcAmount = parseFloat(request.amount) * ((100 - request.appexPercentage) / 100);
          
          return (
            <div className="space-y-4">
              <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Publisher</span>
                  <span className="font-mono text-sm">{formatAddress(request.publisherAddress)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-400">Total Amount</span>
                  <span className="font-semibold text-xl">${parseFloat(request.amount).toLocaleString()}</span>
                </div>
                <div className="border-t border-white/10 pt-3 mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-surface-400">$APPEX ({request.appexPercentage}%)</span>
                    <span className="text-appex-400 font-medium">${appexAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-surface-400">USDC ({100 - request.appexPercentage}%)</span>
                    <span className="font-medium">${usdcAmount.toLocaleString()}</span>
                  </div>
                </div>
                {request.note && (
                  <div className="border-t border-white/10 pt-3 mt-3">
                    <p className="text-xs text-surface-500">Note from publisher:</p>
                    <p className="text-sm text-surface-300 italic">"{request.note}"</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  This will borrow funds from the vault and send payment directly to the publisher.
                  A 30-day loan will be created on your account.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setShowPayRequestModal(false);
                    setSelectedRequest(null);
                    setPendingAction(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handlePayRequest}
                  isLoading={isLoading || loanLoading}
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                >
                  Approve & Pay
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
