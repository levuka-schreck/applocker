'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  RefreshCw,
  Search,
  Sliders,
  Info,
  UserPlus,
  UserMinus,
  Crown,
  Vote,
  FileText,
  Lock,
  Timer,
  XCircle
} from 'lucide-react';
import { Card, Button, Input, Badge, Tabs, Modal, EmptyState } from '@/components/ui';
import { useAppStore } from '@/lib/store';
import { useGovernance, useBorrowerManagement, useVaultStats } from '@/hooks/useContracts';
import { usePartnersApi, useBorrowerApplicationsApi } from '@/hooks/useApi';
import { formatUSDC } from '@/lib/utils';

type Tab = 'admins' | 'governors' | 'partners' | 'applications' | 'borrowers' | 'proposals' | 'parameters';

export const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState<Tab>('admins');
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [newGovernorAddress, setNewGovernorAddress] = useState('');
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newBorrowerAddress, setNewBorrowerAddress] = useState('');
  const [newBorrowerLimit, setNewBorrowerLimit] = useState('');
  const [newBorrowerLpYield, setNewBorrowerLpYield] = useState('500'); // 5% in basis points
  const [newBorrowerProtocolFee, setNewBorrowerProtocolFee] = useState('200'); // 2% in basis points
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddGovernorModal, setShowAddGovernorModal] = useState(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showProposeBorrowerModal, setShowProposeBorrowerModal] = useState(false);
  const [showApproveProposalModal, setShowApproveProposalModal] = useState(false);
  const [showExecuteProposalModal, setShowExecuteProposalModal] = useState(false);
  const [proposalIdToApprove, setProposalIdToApprove] = useState('');
  const [proposalIdToExecute, setProposalIdToExecute] = useState('');
  const [proposalStatus, setProposalStatus] = useState<{
    ready: boolean;
    executeAfter: number;
    executed: boolean;
    approvals: number;
  } | null>(null);
  const [lookupAddress, setLookupAddress] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [newTimelockAddress, setNewTimelockAddress] = useState('');
  const [isSettingTimelock, setIsSettingTimelock] = useState(false);

  const { user } = useAppStore();
  const addNotification = useAppStore((state) => state.addNotification);
  const { 
    partners, 
    addPartner: addPartnerApi, 
    removePartner: removePartnerApi,
    isLoading: partnersLoading,
  } = usePartnersApi();
  const {
    applications,
    fetchApplications,
    updateApplication,
    isLoading: applicationsLoading,
  } = useBorrowerApplicationsApi();
  const { vaultStats, refetch: refetchStats } = useVaultStats();
  const {
    governors,
    admins,
    isGovernor,
    isAdmin,
    isOwner,
    governorCount,
    adminCount,
    initializeGovernor,
    addGovernor,
    removeGovernor,
    addAdmin,
    removeAdmin,
    isLoading: governanceLoading,
    refetch: refetchGovernance,
  } = useGovernance();
  const {
    getBorrower,
    proposeBorrower,
    approveProposal,
    executeProposal,
    getProposalStatus,
    approveBorrowerDirect,
    timelockAddress,
    setTimelock,
    isLoading: borrowerLoading,
  } = useBorrowerManagement();

  // Fetch applications on mount
  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const pendingApplications = applications.filter(a => a.status === 'pending');

  const handleApproveApplication = async (app: typeof applications[0]) => {
    // First approve on-chain
    const success = await approveBorrowerDirect(
      app.applicantAddress,
      app.requestedLimit,
      500, // 5% LP yield
      200  // 2% protocol fee
    );
    
    if (success) {
      // Store partner with name via API
      await addPartnerApi({
        address: app.applicantAddress,
        name: app.companyName,
        borrowLimit: app.requestedLimit,
        lpYieldRate: 500,
        protocolFeeRate: 200,
        approved: true,
      });
      
      // Update application status
      await updateApplication(app.id, {
        status: 'approved',
        processedAt: Date.now(),
        processedBy: user?.address,
      });
      
      addNotification({
        type: 'success',
        title: 'Application Approved',
        message: `${app.companyName} has been approved as a borrower`
      });
    }
  };

  const handleRejectApplication = async (app: typeof applications[0], reason: string) => {
    await updateApplication(app.id, {
      status: 'rejected',
      processedAt: Date.now(),
      processedBy: user?.address,
      rejectionReason: reason,
    });
    
    addNotification({
      type: 'info',
      title: 'Application Rejected',
      message: `${app.companyName}'s application has been rejected`
    });
  };

  const handleInitializeGovernor = async () => {
    if (!newGovernorAddress) return;
    const success = await initializeGovernor(newGovernorAddress);
    if (success) {
      setNewGovernorAddress('');
      setShowAddGovernorModal(false);
    }
  };

  const handleAddGovernor = async () => {
    if (!newGovernorAddress) return;
    
    // If user is owner but not governor, and there are already governors,
    // they can't add more (contract requires governor role)
    if (isOwner && !isGovernor && governorCount > 0) {
      addNotification({
        type: 'error',
        title: 'Cannot Add Governor',
        message: 'As owner, you can only initialize the first governor. To add more governors, you must also be a governor yourself.'
      });
      return;
    }
    
    // If no governors exist, use initializeGovernor (owner only)
    if (governorCount === 0 && isOwner) {
      const success = await initializeGovernor(newGovernorAddress);
      if (success) {
        setNewGovernorAddress('');
        setShowAddGovernorModal(false);
      }
      return;
    }
    
    // Otherwise use addGovernor (requires governor role)
    const success = await addGovernor(newGovernorAddress);
    if (success) {
      setNewGovernorAddress('');
      setShowAddGovernorModal(false);
    }
  };

  const handleRemoveGovernor = async (address: string) => {
    await removeGovernor(address);
  };

  const handleAddAdmin = async () => {
    if (!newAdminAddress) return;
    const success = await addAdmin(newAdminAddress);
    if (success) {
      setNewAdminAddress('');
      setShowAddAdminModal(false);
    }
  };

  const handleRemoveAdmin = async (address: string) => {
    await removeAdmin(address);
  };

  const handleProposeBorrower = async () => {
    if (!newBorrowerAddress || !newBorrowerLimit) return;
    const proposalId = await proposeBorrower(
      newBorrowerAddress,
      newBorrowerLimit,
      parseInt(newBorrowerLpYield),
      parseInt(newBorrowerProtocolFee)
    );
    if (proposalId) {
      setNewBorrowerAddress('');
      setNewBorrowerLimit('');
      setShowProposeBorrowerModal(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!proposalIdToApprove) return;
    const success = await approveProposal(proposalIdToApprove);
    if (success) {
      setProposalIdToApprove('');
      setShowApproveProposalModal(false);
    }
  };

  const handleCheckProposalStatus = async () => {
    if (!proposalIdToExecute) return;
    const status = await getProposalStatus(proposalIdToExecute);
    setProposalStatus(status);
  };

  const handleExecuteProposal = async () => {
    if (!proposalIdToExecute) return;
    const success = await executeProposal(proposalIdToExecute);
    if (success) {
      setProposalIdToExecute('');
      setProposalStatus(null);
      setShowExecuteProposalModal(false);
      // Refresh applications list
      fetchApplications();
    }
  };

  const handleLookupBorrower = async () => {
    if (!lookupAddress) return;
    const result = await getBorrower(lookupAddress);
    setLookupResult(result);
  };

  const handleSetTimelock = async () => {
    if (!newTimelockAddress) return;
    setIsSettingTimelock(true);
    const success = await setTimelock(newTimelockAddress);
    if (success) {
      setNewTimelockAddress('');
    }
    setIsSettingTimelock(false);
  };

  const handleAddPartner = async () => {
    if (!newBorrowerAddress || !newBorrowerLimit || !newPartnerName) return;
    const success = await approveBorrowerDirect(
      newBorrowerAddress,
      newBorrowerLimit,
      parseInt(newBorrowerLpYield),
      parseInt(newBorrowerProtocolFee)
    );
    if (success) {
      // Store partner with name via API
      await addPartnerApi({
        address: newBorrowerAddress,
        name: newPartnerName,
        borrowLimit: newBorrowerLimit,
        lpYieldRate: parseInt(newBorrowerLpYield),
        protocolFeeRate: parseInt(newBorrowerProtocolFee),
        approved: true,
      });
      setNewPartnerName('');
      setNewBorrowerAddress('');
      setNewBorrowerLimit('');
      setNewBorrowerLpYield('500');
      setNewBorrowerProtocolFee('200');
      setShowAddPartnerModal(false);
    }
  };

  const handleRemovePartner = async (address: string) => {
    await removePartnerApi(address);
  };

  const tabs = [
    { 
      id: 'admins' as Tab, 
      label: 'Admins', 
      icon: <Shield className="w-4 h-4" />,
      count: adminCount,
      ownerOnly: true
    },
    { 
      id: 'governors' as Tab, 
      label: 'Governors', 
      icon: <Crown className="w-4 h-4" />,
      count: governorCount 
    },
    { 
      id: 'partners' as Tab, 
      label: 'Approved Borrowers', 
      icon: <Building2 className="w-4 h-4" />,
      count: partners.length
    },
    { 
      id: 'applications' as Tab, 
      label: 'Applications', 
      icon: <FileText className="w-4 h-4" />,
      count: pendingApplications.length,
      highlight: pendingApplications.length > 0
    },
    { 
      id: 'borrowers' as Tab, 
      label: 'Lookup', 
      icon: <Search className="w-4 h-4" />
    },
    { 
      id: 'proposals' as Tab, 
      label: 'Proposals', 
      icon: <FileText className="w-4 h-4" />
    },
    { 
      id: 'parameters' as Tab, 
      label: 'Parameters', 
      icon: <Sliders className="w-4 h-4" />
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            Governance Panel
          </h1>
          <p className="text-surface-400 mt-1">
            Manage governors and borrower proposals through governance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isOwner && (
            <Badge variant="default" className="bg-yellow-500/20 text-yellow-400">
              <Crown className="w-3 h-3 mr-1" />
              Contract Owner
            </Badge>
          )}
          {isGovernor && (
            <Badge variant="success">
              <Vote className="w-3 h-3 mr-1" />
              Governor
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { refetchGovernance(); refetchStats(); }}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Governance Requirements Notice */}
      <Card className="p-4 bg-blue-500/10 border-blue-500/20">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-400 mb-1">Governance Security Model</p>
            <p className="text-surface-400">
              All borrower approvals require <span className="text-white font-medium">minimum 2 governor approvals</span> and 
              go through a <span className="text-white font-medium">timelock delay</span> before execution. 
              This ensures no single actor can approve borrowers unilaterally.
            </p>
          </div>
        </div>
      </Card>

      {/* Role Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${isOwner ? 'bg-yellow-500/20' : 'bg-surface-700'} flex items-center justify-center`}>
              <Crown className={`w-5 h-5 ${isOwner ? 'text-yellow-500' : 'text-surface-500'}`} />
            </div>
            <div>
              <p className="text-sm text-surface-400">Owner Status</p>
              <p className="font-semibold">{isOwner ? 'You are owner' : 'Not owner'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${isGovernor ? 'bg-green-500/20' : 'bg-surface-700'} flex items-center justify-center`}>
              <Vote className={`w-5 h-5 ${isGovernor ? 'text-green-500' : 'text-surface-500'}`} />
            </div>
            <div>
              <p className="text-sm text-surface-400">Governor Status</p>
              <p className="font-semibold">{isGovernor ? 'You are governor' : 'Not governor'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-vault/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-vault" />
            </div>
            <div>
              <p className="text-sm text-surface-400">Total Governors</p>
              <p className="font-semibold">{governorCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${timelockAddress ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
              <Timer className={`w-5 h-5 ${timelockAddress ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            <div>
              <p className="text-sm text-surface-400">Timelock</p>
              <p className="font-semibold">{timelockAddress ? 'Configured' : 'Not Set'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as Tab)}
      />

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'admins' && (
          <motion.div
            key="admins"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-500" />
                    System Administrators
                  </h3>
                  <p className="text-sm text-surface-400 mt-1">
                    Admins have full access to all system functions. Only the owner can add or remove admins.
                  </p>
                </div>
                {isOwner && (
                  <Button
                    onClick={() => setShowAddAdminModal(true)}
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    Add Admin
                  </Button>
                )}
              </div>

              {admins.length === 0 ? (
                <div className="p-8 border border-dashed border-white/10 rounded-xl text-center">
                  <Shield className="w-10 h-10 text-surface-500 mx-auto mb-3" />
                  <p className="text-surface-400 font-medium">No admins configured</p>
                  <p className="text-sm text-surface-500 mt-1">Only the owner has admin privileges</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {admins.map((admin, index) => (
                    <div key={admin} className="flex items-center justify-between p-4 bg-surface-800/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-mono text-sm">{admin}</p>
                          <p className="text-xs text-surface-500">Admin #{index + 1}</p>
                        </div>
                      </div>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAdmin(admin)}
                          className="text-red-400 hover:text-red-300"
                          isLoading={governanceLoading}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Admin Permissions Explanation */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Admin Permissions</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-surface-800/50 rounded-lg">
                  <p className="font-medium text-green-400 mb-2">✓ Can Do</p>
                  <ul className="text-sm text-surface-400 space-y-1">
                    <li>• Approve/reject borrower applications</li>
                    <li>• Add/remove approved borrowers</li>
                    <li>• Manage governors</li>
                    <li>• Update protocol parameters</li>
                    <li>• Process redemptions</li>
                  </ul>
                </div>
                <div className="p-4 bg-surface-800/50 rounded-lg">
                  <p className="font-medium text-red-400 mb-2">✗ Cannot Do</p>
                  <ul className="text-sm text-surface-400 space-y-1">
                    <li>• Add/remove other admins (owner only)</li>
                    <li>• Transfer contract ownership</li>
                    <li>• Upgrade contracts</li>
                  </ul>
                </div>
              </div>
            </Card>

            {!isOwner && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  <p className="text-yellow-400">Only the contract owner can add or remove admins.</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'governors' && (
          <motion.div
            key="governors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Initialize Governor (Owner only, when no governors exist) */}
            {isOwner && governorCount === 0 && (
              <Card className="p-6 border-2 border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">Initialize First Governor</h3>
                    <p className="text-surface-400 mt-1 mb-4">
                      No governors have been initialized yet. As the contract owner, you need to initialize the first governor to enable the governance system.
                    </p>
                    <div className="flex gap-3">
                      <Input
                        placeholder="Governor address (0x...)"
                        value={newGovernorAddress}
                        onChange={(e) => setNewGovernorAddress(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleInitializeGovernor}
                        isLoading={governanceLoading}
                        leftIcon={<UserPlus className="w-4 h-4" />}
                      >
                        Initialize Governor
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Add Governor (Governor or Owner) */}
            {(isGovernor || isOwner) && governorCount > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Add New Governor</h3>
                    <p className="text-sm text-surface-400">
                      {isGovernor 
                        ? 'As a governor, you can add new governors to the system'
                        : 'As owner, you can add governors (requires governor role or will initialize if none exist)'
                      }
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowAddGovernorModal(true)}
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    Add Governor
                  </Button>
                </div>
              </Card>
            )}

            {/* Governor List */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-vault" />
                Current Governors ({governorCount})
              </h3>
              
              {governors.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-12 h-12" />}
                  title="No Governors"
                  description="No governors have been initialized yet. The contract owner must initialize the first governor."
                />
              ) : (
                <div className="space-y-3">
                  {governors.map((governor, index) => (
                    <div
                      key={governor}
                      className="flex items-center justify-between p-4 bg-surface-800/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-vault to-governance flex items-center justify-center">
                          <span className="text-white font-bold">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-mono text-sm">{governor}</p>
                          <p className="text-xs text-surface-400">
                            {governor.toLowerCase() === user?.address?.toLowerCase() ? 'You' : 'Governor'}
                          </p>
                        </div>
                      </div>
                      {isGovernor && governor.toLowerCase() !== user?.address?.toLowerCase() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveGovernor(governor)}
                          isLoading={governanceLoading}
                          className="text-red-400 hover:text-red-300"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Governor Requirements Info */}
            <Card className="p-4 bg-surface-800/30">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-surface-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-surface-400">
                  <p>Governors are responsible for:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Proposing new borrowers for approval</li>
                    <li>Voting on borrower proposals (2 approvals required)</li>
                    <li>Adding or removing other governors</li>
                  </ul>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'partners' && (
          <motion.div
            key="partners"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Add Partner (Owner only) */}
            {isOwner ? (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">Add Approved Borrower</h3>
                    <p className="text-sm text-surface-400">As owner, you can directly approve borrower companies</p>
                  </div>
                  <Button
                    onClick={() => setShowAddPartnerModal(true)}
                    leftIcon={<UserPlus className="w-4 h-4" />}
                  >
                    Add Partner
                  </Button>
                </div>
                
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-400 mb-1">Owner Direct Approval</p>
                      <p className="text-surface-400">
                        This bypasses the governance voting process. In production, use the Proposals tab 
                        where governors vote and approvals go through timelock. Use direct approval only 
                        for development, testing, or emergency situations.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6">
                <EmptyState
                  icon={<Lock className="w-12 h-12" />}
                  title="Owner Access Required"
                  description="Only the contract owner can directly add partner companies. Governors can propose partners through the Proposals tab."
                />
              </Card>
            )}

            {/* Partner List */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-vault" />
                Approved Partners ({partners.length})
              </h3>
              
              {partners.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="w-12 h-12" />}
                  title="No Partners Yet"
                  description="No partner companies have been added. Use the Add Partner button above to approve partners."
                />
              ) : (
                <div className="space-y-3">
                  {partners.map((partner) => (
                    <div
                      key={partner.address}
                      className="flex items-center justify-between p-4 bg-surface-800/50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-vault to-governance flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-lg">{partner.name}</p>
                          <p className="font-mono text-sm text-surface-400">{partner.address}</p>
                          <div className="flex gap-4 mt-1 text-xs text-surface-500">
                            <span>Limit: ${Number(partner.borrowLimit).toLocaleString()}</span>
                            <span>LP Yield: {partner.lpYieldRate / 100}%</span>
                            <span>Fee: {partner.protocolFeeRate / 100}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="success">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                        {isOwner && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemovePartner(partner.address)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Lookup */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-vault" />
                Verify Partner On-Chain
              </h3>
              <p className="text-sm text-surface-400 mb-4">
                Check if an address is approved as a borrower directly on the contract.
              </p>
              <div className="flex gap-3">
                <Input
                  placeholder="Partner address (0x...)"
                  value={lookupAddress}
                  onChange={(e) => setLookupAddress(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleLookupBorrower} isLoading={borrowerLoading}>
                  Check Status
                </Button>
              </div>
              
              {lookupResult && (
                <div className="mt-4 p-4 bg-surface-800/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Status</span>
                    <Badge variant={lookupResult.approved ? 'success' : 'warning'}>
                      {lookupResult.approved ? 'Approved Partner' : 'Not Approved'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Borrow Limit</span>
                    <span className="font-semibold">${formatUSDC(lookupResult.borrowLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Current Debt</span>
                    <span className="font-semibold">${formatUSDC(lookupResult.currentDebt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">LP Yield Rate</span>
                    <span className="font-semibold">{Number(lookupResult.lpYieldRate) / 100}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Protocol Fee</span>
                    <span className="font-semibold">{Number(lookupResult.protocolFeeRate) / 100}%</span>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {activeTab === 'applications' && (
          <motion.div
            key="applications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-governance" />
                    Pending Borrower Applications
                  </h3>
                  <p className="text-sm text-surface-400 mt-1">
                    Review applications from companies wanting to become borrowers
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchApplications()}
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                >
                  Refresh
                </Button>
              </div>

              {applicationsLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-surface-500 mx-auto mb-3" />
                  <p className="text-surface-400">Loading applications...</p>
                </div>
              ) : pendingApplications.length === 0 ? (
                <div className="p-8 border border-dashed border-white/10 rounded-xl text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="text-surface-400 font-medium">No pending applications</p>
                  <p className="text-sm text-surface-500 mt-1">
                    New applications will appear here for review
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApplications.map((app) => (
                    <div key={app.id} className="p-4 bg-surface-800/50 rounded-xl border border-white/5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-lg">{app.companyName}</h4>
                          <p className="text-sm text-surface-400 font-mono">{app.applicantAddress}</p>
                        </div>
                        <Badge variant="warning">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending Review
                        </Badge>
                      </div>

                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div className="p-3 bg-surface-900/50 rounded-lg">
                          <p className="text-xs text-surface-500">Requested Limit</p>
                          <p className="font-semibold">${parseInt(app.requestedLimit).toLocaleString()}</p>
                        </div>
                        <div className="p-3 bg-surface-900/50 rounded-lg">
                          <p className="text-xs text-surface-500">Contact</p>
                          <p className="font-medium text-sm truncate">{app.contactEmail}</p>
                        </div>
                        <div className="p-3 bg-surface-900/50 rounded-lg">
                          <p className="text-xs text-surface-500">Applied</p>
                          <p className="font-medium text-sm">{new Date(app.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {app.website && (
                        <p className="text-sm text-surface-400 mb-3">
                          <span className="text-surface-500">Website:</span> {app.website}
                        </p>
                      )}

                      <div className="p-3 bg-surface-900/50 rounded-lg mb-4">
                        <p className="text-xs text-surface-500 mb-1">Business Description</p>
                        <p className="text-sm text-surface-300">{app.description}</p>
                      </div>

                      {(isOwner || isAdmin) && (
                        <div className="flex gap-3">
                          <Button
                            className="flex-1"
                            onClick={() => handleApproveApplication(app)}
                            isLoading={borrowerLoading || partnersLoading}
                            leftIcon={<CheckCircle className="w-4 h-4" />}
                          >
                            Approve & Add Partner
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleRejectApplication(app, 'Does not meet requirements')}
                            isLoading={applicationsLoading}
                            leftIcon={<XCircle className="w-4 h-4" />}
                          >
                            Reject
                          </Button>
                        </div>
                      )}

                      {isGovernor && !isOwner && !isAdmin && (
                        <div className="p-3 bg-appex-500/10 border border-appex-500/30 rounded-lg">
                          <p className="text-sm text-appex-400">
                            <strong>Governor:</strong> Use the Governance section below to propose this borrower. 
                            Direct approval requires admin privileges.
                          </p>
                        </div>
                      )}

                      {!isOwner && !isAdmin && !isGovernor && (
                        <p className="text-sm text-surface-500 italic">
                          Only governors can approve or reject applications
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Past Applications */}
            {applications.filter(a => a.status !== 'pending').length > 0 && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Past Applications</h3>
                <div className="space-y-3">
                  {applications.filter(a => a.status !== 'pending').map((app) => (
                    <div key={app.id} className="p-3 bg-surface-800/50 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-medium">{app.companyName}</p>
                        <p className="text-xs text-surface-500 font-mono">{app.applicantAddress}</p>
                      </div>
                      <Badge variant={app.status === 'approved' ? 'success' : 'error'}>
                        {app.status === 'approved' ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Approved</>
                        ) : (
                          <><XCircle className="w-3 h-3 mr-1" /> Rejected</>
                        )}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {activeTab === 'borrowers' && (
          <motion.div
            key="borrowers"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Borrower Lookup */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-vault" />
                Lookup Borrower Status
              </h3>
              <div className="flex gap-3 mb-4">
                <Input
                  placeholder="Borrower address (0x...)"
                  value={lookupAddress}
                  onChange={(e) => setLookupAddress(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleLookupBorrower} isLoading={borrowerLoading}>
                  Lookup
                </Button>
              </div>

              {lookupResult && (
                <div className="p-4 bg-surface-800/50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Status</span>
                    <Badge variant={lookupResult.approved ? 'success' : 'warning'}>
                      {lookupResult.approved ? 'Approved Borrower' : 'Not Approved'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Borrow Limit</span>
                    <span className="font-semibold">${formatUSDC(lookupResult.borrowLimit)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Current Debt</span>
                    <span className="font-semibold">${formatUSDC(lookupResult.currentDebt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">LP Yield Rate</span>
                    <span className="font-semibold">{Number(lookupResult.lpYieldRate) / 100}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400">Protocol Fee Rate</span>
                    <span className="font-semibold">{Number(lookupResult.protocolFeeRate) / 100}%</span>
                  </div>
                </div>
              )}

              {!lookupResult && (
                <EmptyState
                  icon={<Building2 className="w-12 h-12" />}
                  title="Lookup Borrower"
                  description="Enter an address above to check if they are an approved borrower"
                />
              )}
            </Card>
          </motion.div>
        )}

        {activeTab === 'proposals' && (
          <motion.div
            key="proposals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Timelock Configuration (Owner only when not set) */}
            {!timelockAddress && isOwner && (
              <Card className="p-6 border-2 border-yellow-500/30 bg-yellow-500/5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <Timer className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">Configure Timelock</h3>
                    <p className="text-surface-400 mt-1 mb-4">
                      As the contract owner, you must set the timelock controller address before governance proposals can be executed.
                      Deploy a TimelockController contract first, then enter its address below.
                    </p>
                    <div className="flex gap-3">
                      <Input
                        placeholder="Timelock contract address (0x...)"
                        value={newTimelockAddress}
                        onChange={(e) => setNewTimelockAddress(e.target.value)}
                        className="flex-1 font-mono"
                      />
                      <Button
                        onClick={handleSetTimelock}
                        isLoading={isSettingTimelock}
                        leftIcon={<Timer className="w-4 h-4" />}
                        disabled={!newTimelockAddress}
                      >
                        Set Timelock
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Timelock Warning for non-owners */}
            {!timelockAddress && !isOwner && (
              <Card className="p-4 border-2 border-red-500/30 bg-red-500/5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-red-400 mb-1">Timelock Not Configured</p>
                    <p className="text-surface-400">
                      The timelock contract has not been set. Proposals cannot be executed until a timelock is configured by the contract owner.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Timelock Configured Success */}
            {timelockAddress && (
              <Card className="p-4 border border-green-500/30 bg-green-500/5">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-green-400 mb-1">Timelock Configured</p>
                    <p className="text-surface-400 font-mono text-xs break-all">
                      {timelockAddress}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Propose Borrower (Governor only) */}
            {isGovernor ? (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Propose New Borrower</h3>
                    <p className="text-sm text-surface-400">Create a proposal that requires 2 governor approvals + timelock</p>
                  </div>
                  <Button
                    onClick={() => setShowProposeBorrowerModal(true)}
                    leftIcon={<Building2 className="w-4 h-4" />}
                  >
                    Propose Borrower
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-4 bg-surface-800/30">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-surface-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-surface-400">
                    <p className="font-semibold text-white mb-1">Governor Required</p>
                    <p>Only governors can propose new borrowers. Contact an existing governor to submit a proposal.</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Approve Proposal (Governor only) */}
            {isGovernor && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Approve Existing Proposal</h3>
                    <p className="text-sm text-surface-400">Vote to approve a pending borrower proposal by ID</p>
                  </div>
                  <Button
                    onClick={() => setShowApproveProposalModal(true)}
                    variant="secondary"
                    leftIcon={<CheckCircle className="w-4 h-4" />}
                  >
                    Approve Proposal
                  </Button>
                </div>
              </Card>
            )}

            {/* Execute Proposal (Anyone can call after timelock) */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Execute Approved Proposal</h3>
                  <p className="text-sm text-surface-400">Execute a proposal after 2-day timelock has passed</p>
                </div>
                <Button
                  onClick={() => setShowExecuteProposalModal(true)}
                  variant="secondary"
                  leftIcon={<Clock className="w-4 h-4" />}
                >
                  Execute Proposal
                </Button>
              </div>
            </Card>

            {/* Governance Flow Explanation */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-vault" />
                Borrower Approval Process
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-appex-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-appex-400 font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Governor Proposes Borrower</p>
                    <p className="text-sm text-surface-400">A governor submits a proposal with borrower address, limit, and fee rates</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-appex-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-appex-400 font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Governors Vote</p>
                    <p className="text-sm text-surface-400">Minimum 2 governors must approve the proposal</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-appex-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-appex-400 font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Timelock Delay</p>
                    <p className="text-sm text-surface-400">Once threshold is met, proposal enters timelock queue (delay period)</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 font-bold">4</span>
                  </div>
                  <div>
                    <p className="font-medium">Execution</p>
                    <p className="text-sm text-surface-400">After timelock delay (2 days), anyone can click "Execute Proposal" to finalize the approval</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Proposal Tracking Note */}
            <Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-400 mb-1">Tracking Proposals</p>
                  <p className="text-surface-400">
                    Proposal IDs are emitted in the <code className="text-yellow-400">BorrowerProposed</code> and{' '}
                    <code className="text-yellow-400">BorrowerProposalScheduled</code> events. 
                    Use "Execute Proposal" button to check status and execute after timelock expires.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'parameters' && (
          <motion.div
            key="parameters"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-vault" />
                Protocol Parameters
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-surface-800/50 rounded-xl">
                  <p className="text-sm text-surface-400 mb-1">Governor Threshold</p>
                  <p className="text-2xl font-bold">2</p>
                  <p className="text-xs text-surface-500">approvals required for proposals</p>
                </div>
                <div className="p-4 bg-surface-800/50 rounded-xl">
                  <p className="text-sm text-surface-400 mb-1">Timelock Status</p>
                  <p className="text-2xl font-bold">{timelockAddress ? 'Active' : 'Not Set'}</p>
                  <p className="text-xs text-surface-500 font-mono truncate">
                    {timelockAddress ? timelockAddress.slice(0, 20) + '...' : 'Required for governance'}
                  </p>
                </div>
                <div className="p-4 bg-surface-800/50 rounded-xl">
                  <p className="text-sm text-surface-400 mb-1">Daily Redemption Cap</p>
                  <p className="text-2xl font-bold">5%</p>
                  <p className="text-xs text-surface-500">of total LP tokens per day</p>
                </div>
                <div className="p-4 bg-surface-800/50 rounded-xl">
                  <p className="text-sm text-surface-400 mb-1">Liquidity Buffer</p>
                  <p className="text-2xl font-bold">15%</p>
                  <p className="text-xs text-surface-500">minimum reserve ratio</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-400 mb-1">Parameter Changes</p>
                  <p className="text-surface-400">
                    Protocol parameters can only be modified through the smart contract by the owner or through governance proposals with timelock. 
                    This ensures protocol stability and security.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Governor Modal */}
      <Modal
        isOpen={showAddGovernorModal}
        onClose={() => setShowAddGovernorModal(false)}
        title="Add New Governor"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-surface-400 mb-2">Governor Address</label>
            <Input
              placeholder="0x..."
              value={newGovernorAddress}
              onChange={(e) => setNewGovernorAddress(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowAddGovernorModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddGovernor}
              isLoading={governanceLoading}
              disabled={!newGovernorAddress}
            >
              Add Governor
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Admin Modal */}
      <Modal
        isOpen={showAddAdminModal}
        onClose={() => setShowAddAdminModal(false)}
        title="Add New Admin"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
            <p className="text-red-400">
              <strong>Warning:</strong> Admins have full access to most system functions. Only add trusted addresses.
            </p>
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Admin Address</label>
            <Input
              placeholder="0x..."
              value={newAdminAddress}
              onChange={(e) => setNewAdminAddress(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowAddAdminModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddAdmin}
              isLoading={governanceLoading}
              disabled={!newAdminAddress}
            >
              Add Admin
            </Button>
          </div>
        </div>
      </Modal>

      {/* Propose Borrower Modal */}
      <Modal
        isOpen={showProposeBorrowerModal}
        onClose={() => setShowProposeBorrowerModal(false)}
        title="Propose New Borrower"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
            <p className="text-blue-400">
              This creates a proposal that requires <strong>2 governor approvals</strong> and goes through the <strong>timelock</strong> before the borrower is approved.
            </p>
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Borrower Address</label>
            <Input
              placeholder="0x..."
              value={newBorrowerAddress}
              onChange={(e) => setNewBorrowerAddress(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Borrowing Limit (USDC)</label>
            <Input
              type="number"
              placeholder="100000"
              value={newBorrowerLimit}
              onChange={(e) => setNewBorrowerLimit(e.target.value)}
              leftElement={<DollarSign className="w-4 h-4" />}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-surface-400 mb-2">LP Yield Rate (bps)</label>
              <Input
                type="number"
                placeholder="500"
                value={newBorrowerLpYield}
                onChange={(e) => setNewBorrowerLpYield(e.target.value)}
              />
              <p className="text-xs text-surface-500 mt-1">{parseInt(newBorrowerLpYield || '0') / 100}%</p>
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-2">Protocol Fee (bps)</label>
              <Input
                type="number"
                placeholder="200"
                value={newBorrowerProtocolFee}
                onChange={(e) => setNewBorrowerProtocolFee(e.target.value)}
              />
              <p className="text-xs text-surface-500 mt-1">{parseInt(newBorrowerProtocolFee || '0') / 100}%</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowProposeBorrowerModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleProposeBorrower}
              isLoading={borrowerLoading}
              disabled={!newBorrowerAddress || !newBorrowerLimit}
            >
              Submit Proposal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Proposal Modal */}
      <Modal
        isOpen={showApproveProposalModal}
        onClose={() => setShowApproveProposalModal(false)}
        title="Approve Borrower Proposal"
      >
        <div className="space-y-4">
          <div className="p-3 bg-surface-800/50 rounded-lg text-sm">
            <p className="text-surface-400">
              Enter the proposal ID from the <code className="text-appex-400">BorrowerProposed</code> event. 
              When enough governors approve, the proposal will be scheduled through the timelock.
            </p>
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Proposal ID (bytes32)</label>
            <Input
              placeholder="0x..."
              value={proposalIdToApprove}
              onChange={(e) => setProposalIdToApprove(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowApproveProposalModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleApproveProposal}
              isLoading={borrowerLoading}
              disabled={!proposalIdToApprove}
            >
              Approve Proposal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Execute Proposal Modal */}
      <Modal
        isOpen={showExecuteProposalModal}
        onClose={() => {
          setShowExecuteProposalModal(false);
          setProposalStatus(null);
          setProposalIdToExecute('');
        }}
        title="Execute Borrower Proposal"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
            <p className="text-blue-400">
              <strong>Timelock Execution:</strong> After 2 governors approve and the 2-day timelock expires, 
              anyone can execute the proposal to finalize the borrower approval.
            </p>
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Proposal ID (bytes32)</label>
            <Input
              placeholder="0x..."
              value={proposalIdToExecute}
              onChange={(e) => {
                setProposalIdToExecute(e.target.value);
                setProposalStatus(null);
              }}
              className="font-mono"
            />
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleCheckProposalStatus}
            disabled={!proposalIdToExecute}
          >
            Check Status
          </Button>
          
          {proposalStatus && (
            <div className="p-4 rounded-lg bg-surface-800/50 space-y-2">
              <div className="flex justify-between">
                <span className="text-surface-400">Approvals:</span>
                <span className="font-medium">{proposalStatus.approvals} / 2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-400">Status:</span>
                <span className={`font-medium ${
                  proposalStatus.executed ? 'text-green-400' : 
                  proposalStatus.ready ? 'text-appex-400' : 
                  proposalStatus.executeAfter > 0 ? 'text-yellow-400' : 'text-surface-400'
                }`}>
                  {proposalStatus.executed ? 'Executed' : 
                   proposalStatus.ready ? 'Ready to Execute' : 
                   proposalStatus.executeAfter > 0 ? 'Pending Timelock' : 'Awaiting Approvals'}
                </span>
              </div>
              {proposalStatus.executeAfter > 0 && !proposalStatus.executed && (
                <div className="flex justify-between">
                  <span className="text-surface-400">Execute After:</span>
                  <span className="font-medium">
                    {new Date(proposalStatus.executeAfter * 1000).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowExecuteProposalModal(false);
                setProposalStatus(null);
                setProposalIdToExecute('');
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleExecuteProposal}
              isLoading={borrowerLoading}
              disabled={!proposalIdToExecute || !proposalStatus?.ready}
            >
              Execute Proposal
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Partner Modal */}
      <Modal
        isOpen={showAddPartnerModal}
        onClose={() => setShowAddPartnerModal(false)}
        title="Add Partner Company"
      >
        <div className="space-y-4">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
            <p className="text-yellow-400">
              <strong>Direct Approval:</strong> This bypasses governance voting. Use only for development/testing.
            </p>
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Company Name</label>
            <Input
              placeholder="Acme Ad Network"
              value={newPartnerName}
              onChange={(e) => setNewPartnerName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Partner Address</label>
            <Input
              placeholder="0x..."
              value={newBorrowerAddress}
              onChange={(e) => setNewBorrowerAddress(e.target.value)}
              className="font-mono"
            />
          </div>
          <div>
            <label className="block text-sm text-surface-400 mb-2">Borrowing Limit (USDC)</label>
            <Input
              type="number"
              placeholder="100000"
              value={newBorrowerLimit}
              onChange={(e) => setNewBorrowerLimit(e.target.value)}
              leftElement={<DollarSign className="w-4 h-4" />}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-surface-400 mb-2">LP Yield Rate (bps)</label>
              <Input
                type="number"
                placeholder="500"
                value={newBorrowerLpYield}
                onChange={(e) => setNewBorrowerLpYield(e.target.value)}
              />
              <p className="text-xs text-surface-500 mt-1">{parseInt(newBorrowerLpYield || '0') / 100}%</p>
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-2">Protocol Fee (bps)</label>
              <Input
                type="number"
                placeholder="200"
                value={newBorrowerProtocolFee}
                onChange={(e) => setNewBorrowerProtocolFee(e.target.value)}
              />
              <p className="text-xs text-surface-500 mt-1">{parseInt(newBorrowerProtocolFee || '0') / 100}%</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowAddPartnerModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddPartner}
              isLoading={borrowerLoading}
              disabled={!newPartnerName || !newBorrowerAddress || !newBorrowerLimit}
            >
              Add Partner
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPanel;
