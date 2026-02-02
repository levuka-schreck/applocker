'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Banknote,
  Gift,
  Lock,
  Unlock,
  ExternalLink,
  X,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  LayoutGrid,
  List,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Card, Button, Badge, Modal } from '@/components/ui';
import { Transaction } from '@/types';
import { formatUSDC, formatToken, formatAddress, formatDate } from '@/lib/utils';

// Transaction type configuration
const transactionTypeConfig: Record<string, {
  icon: typeof ArrowDownLeft;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  deposit: {
    icon: ArrowDownLeft,
    label: 'Deposit',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    description: 'USDC deposited to vault'
  },
  withdraw: {
    icon: ArrowUpRight,
    label: 'Withdraw',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    description: 'USDC withdrawn from vault'
  },
  borrow: {
    icon: Banknote,
    label: 'Borrow',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    description: 'Borrowed from vault'
  },
  repay: {
    icon: CheckCircle,
    label: 'Repay',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    description: 'Loan repayment'
  },
  stake: {
    icon: Lock,
    label: 'Stake',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    description: '$APPEX staked'
  },
  unstake: {
    icon: Unlock,
    label: 'Unstake',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    description: '$APPEX unstaked'
  },
  payout: {
    icon: Coins,
    label: 'Payout',
    color: 'text-appex-400',
    bgColor: 'bg-appex-500/20',
    description: 'Publisher payment'
  },
  claim: {
    icon: Gift,
    label: 'Claim',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    description: 'Rewards claimed'
  }
};

// Default config for unknown transaction types
const defaultTypeConfig = {
  icon: History,
  label: 'Transaction',
  color: 'text-surface-400',
  bgColor: 'bg-surface-500/20',
  description: 'Unknown transaction'
};

// Helper to get transaction type config safely
const getTypeConfig = (type: string) => transactionTypeConfig[type] || defaultTypeConfig;

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20'
  },
  confirmed: {
    icon: CheckCircle,
    label: 'Confirmed',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20'
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20'
  }
};

// Helper to convert milliseconds to seconds for blockchain timestamps
const msToSec = (ms: number) => Math.floor(ms / 1000);

// Transaction Details Modal Component
const TransactionDetailsModal = ({
  transaction,
  isOpen,
  onClose
}: {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!transaction) return null;

  const config = getTypeConfig(transaction.type);
  const StatusIcon = statusConfig[transaction.status].icon;
  const TypeIcon = config.icon;

  const isTokenAmount = ['stake', 'unstake', 'claim'].includes(transaction.type);
  const formattedAmount = isTokenAmount
    ? formatToken(transaction.amount)
    : formatUSDC(transaction.amount);
  const amountLabel = isTokenAmount ? '$APPEX' : 'USDC';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Details">
      <div className="space-y-6">
        {/* Transaction Type Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center ${config.color}`}>
              <TypeIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{config.label}</h3>
              <p className="text-sm text-surface-400">{config.description}</p>
            </div>
          </div>
          <Badge variant={transaction.status === 'confirmed' ? 'success' : transaction.status === 'pending' ? 'warning' : 'error'}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusConfig[transaction.status].label}
          </Badge>
        </div>

        {/* Amount */}
        <div className="glass-card p-4 rounded-xl">
          <p className="text-sm text-surface-400 mb-1">Amount</p>
          <p className="text-2xl font-bold">
            {['withdraw', 'unstake', 'borrow'].includes(transaction.type) ? '-' : '+'}
            {formattedAmount} {amountLabel}
          </p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-surface-400 mb-1">Date & Time</p>
            <p className="font-medium">{formatDate(transaction.timestamp)}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-surface-400 mb-1">Status</p>
            <p className={`font-medium ${statusConfig[transaction.status].color}`}>
              {statusConfig[transaction.status].label}
            </p>
          </div>
        </div>

        {/* Addresses */}
        <div className="space-y-3">
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-surface-400 mb-1">From Address</p>
            <p className="font-mono text-sm break-all">{transaction.from}</p>
          </div>
          {transaction.to && (
            <div className="glass-card p-4 rounded-xl">
              <p className="text-sm text-surface-400 mb-1">To Address</p>
              <p className="font-mono text-sm break-all">{transaction.to}</p>
            </div>
          )}
        </div>

        {/* Transaction Hash */}
        <div className="glass-card p-4 rounded-xl">
          <p className="text-sm text-surface-400 mb-1">Transaction Hash</p>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm break-all flex-1">{transaction.hash}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(`https://etherscan.io/tx/${transaction.hash}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => window.open(`https://etherscan.io/tx/${transaction.hash}`, '_blank')}
            leftIcon={<ExternalLink className="w-4 h-4" />}
          >
            View on Explorer
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const TransactionHistory = () => {
  const addNotification = useAppStore((state) => state.addNotification);
  const storeTransactions = useAppStore((state) => state.transactions);
  
  // State - use store transactions instead of mock data
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Transaction['type'][]>([]);
  const [selectedStatus, setSelectedStatus] = useState<Transaction['status'] | 'all'>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use store transactions (deduplicated by hash)
  const transactions = useMemo(() => {
    const seen = new Set<string>();
    return storeTransactions.filter(tx => {
      if (seen.has(tx.hash)) return false;
      seen.add(tx.hash);
      return true;
    });
  }, [storeTransactions]);
  
  const itemsPerPage = 10;

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !tx.hash.toLowerCase().includes(query) &&
          !tx.from.toLowerCase().includes(query) &&
          !(tx.to && tx.to.toLowerCase().includes(query)) &&
          !getTypeConfig(tx.type).label.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(tx.type)) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && tx.status !== selectedStatus) {
        return false;
      }

      // Date range filter (timestamps are in seconds)
      if (dateRange.start) {
        const startDate = msToSec(new Date(dateRange.start).getTime());
        if (tx.timestamp < startDate) return false;
      }
      if (dateRange.end) {
        const endDate = msToSec(new Date(dateRange.end).getTime() + 24 * 60 * 60 * 1000);
        if (tx.timestamp > endDate) return false;
      }

      return true;
    });
  }, [transactions, searchQuery, selectedTypes, selectedStatus, dateRange]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate statistics (timestamps in seconds)
  const stats = useMemo(() => {
    const now = msToSec(Date.now());
    const oneDay = 24 * 60 * 60; // seconds
    const oneWeek = 7 * oneDay;

    const todayTx = filteredTransactions.filter(tx => tx.timestamp > now - oneDay);
    const weekTx = filteredTransactions.filter(tx => tx.timestamp > now - oneWeek);

    const totalIn = filteredTransactions
      .filter(tx => ['deposit', 'repay', 'claim'].includes(tx.type))
      .reduce((acc, tx) => acc + tx.amount, BigInt(0));

    const totalOut = filteredTransactions
      .filter(tx => ['withdraw', 'borrow', 'payout'].includes(tx.type))
      .reduce((acc, tx) => acc + tx.amount, BigInt(0));

    return {
      total: filteredTransactions.length,
      today: todayTx.length,
      thisWeek: weekTx.length,
      totalIn,
      totalOut
    };
  }, [filteredTransactions]);

  // Toggle type filter
  const toggleTypeFilter = (type: Transaction['type']) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTypes([]);
    setSelectedStatus('all');
    setDateRange({ start: '', end: '' });
    setCurrentPage(1);
  };

  // Refresh transactions
  const refreshTransactions = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    addNotification({
      type: 'success',
      title: 'Transactions Updated',
      message: 'Transaction history has been refreshed',
    });
  };

  // Export transactions
  const exportTransactions = () => {
    const headers = ['Hash', 'Type', 'Amount', 'Status', 'Date', 'From', 'To'];
    const rows = filteredTransactions.map((tx) => {
      const isTokenAmount = ['stake', 'unstake', 'claim'].includes(tx.type);
      return [
        tx.hash,
        getTypeConfig(tx.type).label,
        isTokenAmount ? `${formatToken(tx.amount)} APPEX` : `${formatUSDC(tx.amount)} USDC`,
        statusConfig[tx.status].label,
        formatDate(tx.timestamp),
        tx.from,
        tx.to || '-'
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appex-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    addNotification({
      type: 'success',
      title: 'Export Complete',
      message: `Exported ${filteredTransactions.length} transactions`,
    });
  };

  // Open transaction details
  const openDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
              <History className="w-5 h-5 text-surface-300" />
            </div>
            Transaction History
          </h1>
          <p className="text-surface-400 mt-1">View and filter all your protocol transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={refreshTransactions}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            onClick={exportTransactions}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-surface-400 mb-1">Total Transactions</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-surface-400 mb-1">Today</p>
          <p className="text-2xl font-bold">{stats.today}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-surface-400 mb-1">This Week</p>
          <p className="text-2xl font-bold">{stats.thisWeek}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-sm text-surface-400">Total In</p>
          </div>
          <p className="text-xl font-bold text-green-400">{formatUSDC(stats.totalIn)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <p className="text-sm text-surface-400">Total Out</p>
          </div>
          <p className="text-xl font-bold text-red-400">{formatUSDC(stats.totalOut)}</p>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search by hash, address, or type..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-lg focus:ring-2 focus:ring-appex-500 focus:border-transparent transition-all"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'cards' ? 'bg-surface-700 text-white' : 'text-surface-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<Filter className="w-4 h-4" />}
          >
            Filters
            {(selectedTypes.length > 0 || selectedStatus !== 'all' || dateRange.start || dateRange.end) && (
              <span className="ml-2 w-5 h-5 bg-appex-500 rounded-full text-xs flex items-center justify-center">
                {selectedTypes.length + (selectedStatus !== 'all' ? 1 : 0) + (dateRange.start ? 1 : 0) + (dateRange.end ? 1 : 0)}
              </span>
            )}
          </Button>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-surface-700 space-y-4">
                {/* Transaction Type Filters */}
                <div>
                  <p className="text-sm font-medium text-surface-400 mb-2">Transaction Type</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(transactionTypeConfig) as Transaction['type'][]).map((type) => {
                      const config = getTypeConfig(type);
                      const Icon = config.icon;
                      const isSelected = selectedTypes.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => toggleTypeFilter(type)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            isSelected
                              ? `${config.bgColor} ${config.color} border-current`
                              : 'border-surface-700 text-surface-400 hover:border-surface-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status and Date Filters */}
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Status Filter */}
                  <div>
                    <p className="text-sm font-medium text-surface-400 mb-2">Status</p>
                    <select
                      value={selectedStatus}
                      onChange={(e) => {
                        setSelectedStatus(e.target.value as Transaction['status'] | 'all');
                        setCurrentPage(1);
                      }}
                      className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg focus:ring-2 focus:ring-appex-500 focus:border-transparent"
                    >
                      <option value="all">All Statuses</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>

                  {/* Start Date */}
                  <div>
                    <p className="text-sm font-medium text-surface-400 mb-2">Start Date</p>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => {
                          setDateRange((prev) => ({ ...prev, start: e.target.value }));
                          setCurrentPage(1);
                        }}
                        className="w-full pl-10 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg focus:ring-2 focus:ring-appex-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* End Date */}
                  <div>
                    <p className="text-sm font-medium text-surface-400 mb-2">End Date</p>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => {
                          setDateRange((prev) => ({ ...prev, end: e.target.value }));
                          setCurrentPage(1);
                        }}
                        className="w-full pl-10 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg focus:ring-2 focus:ring-appex-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Transactions List */}
      <Card>
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-surface-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Transactions Found</h3>
            <p className="text-surface-400 mb-4">
              {searchQuery || selectedTypes.length > 0 || selectedStatus !== 'all' || dateRange.start || dateRange.end
                ? 'Try adjusting your filters to see more results'
                : 'Your transaction history will appear here'}
            </p>
            {(searchQuery || selectedTypes.length > 0 || selectedStatus !== 'all' || dateRange.start || dateRange.end) && (
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          // Table View
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left py-4 px-4 text-sm font-medium text-surface-400">Type</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-surface-400">Amount</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-surface-400 hidden md:table-cell">Hash</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-surface-400">Status</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-surface-400 hidden lg:table-cell">Date</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-surface-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx) => {
                  const typeConfig = getTypeConfig(tx.type);
                  const statusConf = statusConfig[tx.status];
                  const TypeIcon = typeConfig.icon;
                  const StatusIcon = statusConf.icon;
                  const isTokenAmount = ['stake', 'unstake', 'claim'].includes(tx.type);
                  
                  return (
                    <tr
                      key={tx.hash}
                      className="border-b border-surface-800 hover:bg-surface-800/50 transition-colors cursor-pointer"
                      onClick={() => openDetails(tx)}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${typeConfig.bgColor} flex items-center justify-center ${typeConfig.color}`}>
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{typeConfig.label}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`font-mono font-medium ${
                          ['withdraw', 'borrow', 'unstake'].includes(tx.type) ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {['withdraw', 'borrow', 'unstake', 'payout'].includes(tx.type) ? '-' : '+'}
                          {isTokenAmount ? formatToken(tx.amount) : formatUSDC(tx.amount)}
                          <span className="text-surface-400 ml-1 text-sm">
                            {isTokenAmount ? 'APPEX' : 'USDC'}
                          </span>
                        </span>
                      </td>
                      <td className="py-4 px-4 hidden md:table-cell">
                        <span className="font-mono text-sm text-surface-400">
                          {formatAddress(tx.hash)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant={tx.status === 'confirmed' ? 'success' : tx.status === 'pending' ? 'warning' : 'error'}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConf.label}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 hidden lg:table-cell">
                        <span className="text-sm text-surface-400">{formatDate(tx.timestamp)}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://etherscan.io/tx/${tx.hash}`, '_blank');
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // Card View
          <div className="p-4 grid gap-4 md:grid-cols-2">
            {paginatedTransactions.map((tx) => {
              const typeConfig = getTypeConfig(tx.type);
              const statusConf = statusConfig[tx.status];
              const TypeIcon = typeConfig.icon;
              const StatusIcon = statusConf.icon;
              const isTokenAmount = ['stake', 'unstake', 'claim'].includes(tx.type);

              return (
                <motion.div
                  key={tx.hash}
                  className="glass-card p-4 rounded-xl hover:border-appex-500/30 transition-all cursor-pointer"
                  whileHover={{ scale: 1.01 }}
                  onClick={() => openDetails(tx)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${typeConfig.bgColor} flex items-center justify-center ${typeConfig.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{typeConfig.label}</p>
                        <p className="text-xs text-surface-400">{formatDate(tx.timestamp)}</p>
                      </div>
                    </div>
                    <Badge variant={tx.status === 'confirmed' ? 'success' : tx.status === 'pending' ? 'warning' : 'error'}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConf.label}
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-surface-400">Amount</p>
                      <p className={`text-lg font-bold font-mono ${
                        ['withdraw', 'borrow', 'unstake'].includes(tx.type) ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {['withdraw', 'borrow', 'unstake', 'payout'].includes(tx.type) ? '-' : '+'}
                        {isTokenAmount ? formatToken(tx.amount) : formatUSDC(tx.amount)}
                        <span className="text-surface-400 ml-1 text-sm">
                          {isTokenAmount ? 'APPEX' : 'USDC'}
                        </span>
                      </p>
                    </div>
                    <p className="text-xs font-mono text-surface-500">
                      {formatAddress(tx.hash)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-surface-700">
            <p className="text-sm text-surface-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of{' '}
              {filteredTransactions.length} transactions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-appex-500 text-white'
                          : 'text-surface-400 hover:bg-surface-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        transaction={selectedTransaction}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedTransaction(null);
        }}
      />
    </div>
  );
};

export default TransactionHistory;
