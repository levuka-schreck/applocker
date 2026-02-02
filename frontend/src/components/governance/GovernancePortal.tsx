'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Vote,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  FileText,
  Shield,
  AlertTriangle,
  ChevronRight,
  Plus,
  Search,
  Filter,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { 
  Card, 
  Button, 
  Badge, 
  Input, 
  Modal, 
  Tabs, 
  StatDisplay, 
  ProgressBar, 
  EmptyState,
  Skeleton
} from '@/components/ui';
import { useAppStore } from '@/lib/store';
import { formatAddress, formatUSDC, formatToken } from '@/lib/utils';
import { BorrowerApplication, GovernanceProposal } from '@/types';
import { useBorrowerApplicationsApi, BorrowerApplicationData } from '@/hooks/useApi';
import { useGovernance, useBorrowerManagement } from '@/hooks/useContracts';
import { usePartnersApi } from '@/hooks/useApi';

// Governance proposals would come from contract in production
const governanceProposals: GovernanceProposal[] = [];

// Borrower Application Card Component
const BorrowerApplicationCard = ({ 
  application, 
  onVote 
}: { 
  application: BorrowerApplication;
  onVote: (id: string, vote: 'for' | 'against' | 'abstain') => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const totalVotes = application.votes.for + application.votes.against + application.votes.abstain;
  const forPercentage = totalVotes > BigInt(0) 
    ? Number((application.votes.for * BigInt(100)) / totalVotes) 
    : 0;
  const againstPercentage = totalVotes > BigInt(0) 
    ? Number((application.votes.against * BigInt(100)) / totalVotes) 
    : 0;
  
  const timeRemaining = application.votingDeadline - Date.now();
  const daysRemaining = Math.ceil(timeRemaining / 86400000);
  const isExpired = timeRemaining <= 0;
  const isPassing = application.votes.for > application.votes.against;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="hover:border-appex-500/20 transition-all duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Company Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-vault/20 to-governance/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-vault" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold">{application.companyName}</h3>
                  <Badge variant={isPassing ? 'success' : 'warning'}>
                    {isPassing ? 'Likely to Pass' : 'Contested'}
                  </Badge>
                </div>
                <p className="text-sm text-surface-400 mt-1 truncate">
                  {formatAddress(application.address)}
                </p>
              </div>
            </div>

            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-white/5"
              >
                <p className="text-surface-300 text-sm mb-4">{application.description}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-surface-400">Requested Limit</p>
                    <p className="font-semibold">{formatUSDC(application.proposedLimit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Payment Velocity</p>
                    <p className="font-semibold">Net-{application.paymentVelocity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Credit Score</p>
                    <p className="font-semibold">{application.creditScore}</p>
                  </div>
                  <div>
                    <p className="text-xs text-surface-400">Documents</p>
                    <p className="font-semibold">{application.documents.length} files</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Voting Stats */}
          <div className="lg:w-64 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-400">Voting Progress</span>
              <span className={isExpired ? 'text-error' : 'text-appex-400'}>
                {isExpired ? 'Ended' : `${daysRemaining}d remaining`}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success rounded-full"
                    style={{ width: `${forPercentage}%` }}
                  />
                </div>
                <span className="text-xs text-success w-12 text-right">{forPercentage.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-error rounded-full"
                    style={{ width: `${againstPercentage}%` }}
                  />
                </div>
                <span className="text-xs text-error w-12 text-right">{againstPercentage.toFixed(0)}%</span>
              </div>
            </div>
            <p className="text-xs text-surface-500">
              {formatToken(totalVotes)} $APPEX voted
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!isExpired && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onVote(application.id, 'for')}
                  className="text-success hover:bg-success/10"
                  leftIcon={<ThumbsUp className="w-4 h-4" />}
                >
                  For
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onVote(application.id, 'against')}
                  className="text-error hover:bg-error/10"
                  leftIcon={<ThumbsDown className="w-4 h-4" />}
                >
                  Against
                </Button>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              rightIcon={<ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />}
            >
              {expanded ? 'Less' : 'Details'}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

// Proposal Card Component
const ProposalCard = ({ 
  proposal, 
  onVote 
}: { 
  proposal: GovernanceProposal;
  onVote: (id: string, vote: 'for' | 'against' | 'abstain') => void;
}) => {
  const totalVotes = proposal.votes.for + proposal.votes.against + proposal.votes.abstain;
  const forPercentage = totalVotes > BigInt(0) 
    ? Number((proposal.votes.for * BigInt(100)) / totalVotes) 
    : 0;
  
  const timeRemaining = proposal.votingDeadline - Date.now();
  const isExpired = timeRemaining <= 0;
  const isPassed = proposal.votes.for > proposal.votes.against;

  const typeColors = {
    parameter_change: 'text-vault',
    borrower_approval: 'text-appex-400',
    fee_adjustment: 'text-staking',
    other: 'text-surface-400'
  };

  const typeIcons = {
    parameter_change: <Shield className="w-5 h-5" />,
    borrower_approval: <Users className="w-5 h-5" />,
    fee_adjustment: <TrendingUp className="w-5 h-5" />,
    other: <FileText className="w-5 h-5" />
  };

  return (
    <Card className="hover:border-appex-500/20 transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg bg-surface-700/50 flex items-center justify-center ${typeColors[proposal.type]}`}>
          {typeIcons[proposal.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold">{proposal.title}</h3>
            {proposal.executed && (
              <Badge variant="success">Executed</Badge>
            )}
            {isExpired && !proposal.executed && (
              <Badge variant={isPassed ? 'success' : 'error'}>
                {isPassed ? 'Passed' : 'Failed'}
              </Badge>
            )}
            {!isExpired && (
              <Badge variant="info">Active</Badge>
            )}
          </div>
          <p className="text-sm text-surface-400 mb-4">{proposal.description}</p>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-full max-w-32 h-2 bg-surface-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-success to-appex-500 rounded-full"
                  style={{ width: `${forPercentage}%` }}
                />
              </div>
              <span className="text-surface-400">{forPercentage.toFixed(0)}% For</span>
            </div>
            <span className="text-surface-500">
              {formatToken(totalVotes)} votes
            </span>
          </div>
        </div>
        
        {!isExpired && !proposal.executed && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onVote(proposal.id, 'for')}
              className="bg-success/20 text-success border-success/30 hover:bg-success/30"
            >
              Vote For
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onVote(proposal.id, 'against')}
              className="text-error hover:bg-error/10"
            >
              Against
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

// Create Proposal Modal
const CreateProposalModal = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GovernanceProposal['type']>('parameter_change');

  const handleSubmit = () => {
    // Submit proposal logic
    console.log({ title, description, type });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Proposal" size="lg">
      <div className="space-y-4">
        <Input
          label="Proposal Title"
          placeholder="Enter a clear, descriptive title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-surface-200">Proposal Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as GovernanceProposal['type'])}
            className="input-base"
          >
            <option value="parameter_change">Parameter Change</option>
            <option value="fee_adjustment">Fee Adjustment</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-surface-200">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your proposal in detail..."
            rows={4}
            className="input-base resize-none"
          />
        </div>

        <div className="flex gap-4 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={!title || !description}>
            Submit Proposal
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Main Governance Portal Component
export const GovernancePortal = () => {
  const { user, addNotification } = useAppStore();
  const [activeTab, setActiveTab] = useState('borrowers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<BorrowerApplicationData | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [lpYieldRate, setLpYieldRate] = useState('500');
  const [protocolFeeRate, setProtocolFeeRate] = useState('200');

  // Fetch borrower applications from API
  const {
    applications: borrowerApplications,
    fetchApplications,
    updateApplication,
    isLoading,
  } = useBorrowerApplicationsApi();

  // Governance hooks
  const {
    isGovernor,
    isAdmin,
    isOwner,
  } = useGovernance();

  const {
    approveBorrowerDirect,
    isLoading: borrowerLoading,
  } = useBorrowerManagement();

  const {
    addPartner: addPartnerApi,
  } = usePartnersApi();

  // Can user approve applications? (admin, owner, or governor)
  const canApprove = isAdmin || isOwner || isGovernor;
  
  // Is user admin/owner (can direct approve) vs just governor (needs 2 approvals)
  const canDirectApprove = isAdmin || isOwner;

  useEffect(() => {
    fetchApplications();
    // In production, also fetch governance proposals from contracts
    setProposals(governanceProposals);
  }, [fetchApplications]);

  const handleApproveApplication = async () => {
    if (!selectedApplication || !user?.address) return;

    // Admin/Owner can directly approve
    if (canDirectApprove) {
      const success = await approveBorrowerDirect(
        selectedApplication.applicantAddress,
        selectedApplication.requestedLimit,
        parseInt(lpYieldRate),
        parseInt(protocolFeeRate)
      );

      if (success) {
        // Store partner with name via API
        await addPartnerApi({
          address: selectedApplication.applicantAddress,
          name: selectedApplication.companyName,
          borrowLimit: selectedApplication.requestedLimit,
          lpYieldRate: parseInt(lpYieldRate),
          protocolFeeRate: parseInt(protocolFeeRate),
          approved: true,
        });

        // Update application status
        await updateApplication(selectedApplication.id, {
          status: 'approved',
          processedAt: Date.now(),
          processedBy: user?.address,
          lpYieldRate: parseInt(lpYieldRate),
          protocolFeeRate: parseInt(protocolFeeRate),
        });

        addNotification({
          type: 'success',
          title: 'Application Approved',
          message: `${selectedApplication.companyName} has been approved as a borrower`
        });

        setShowApproveModal(false);
        setSelectedApplication(null);
        fetchApplications();
      }
    } else {
      // Governor voting - need 2 approvals before an admin can execute
      const currentApprovals = selectedApplication.governorApprovals || [];
      
      // Check if this governor already approved
      if (currentApprovals.includes(user.address.toLowerCase())) {
        addNotification({
          type: 'warning',
          title: 'Already Voted',
          message: 'You have already voted to approve this application'
        });
        return;
      }

      // Add this governor's approval vote
      const newApprovals = [...currentApprovals, user.address.toLowerCase()];
      
      // Just record the vote - don't call contract
      await updateApplication(selectedApplication.id, {
        governorApprovals: newApprovals,
        lpYieldRate: parseInt(lpYieldRate),
        protocolFeeRate: parseInt(protocolFeeRate),
      });

      if (newApprovals.length >= 2) {
        addNotification({
          type: 'success',
          title: 'Threshold Reached!',
          message: `${newApprovals.length} governors have approved. An admin can now execute the on-chain approval.`
        });
      } else {
        addNotification({
          type: 'success',
          title: 'Vote Recorded',
          message: `Your approval vote has been recorded (${newApprovals.length}/2 required). Need ${2 - newApprovals.length} more governor vote(s).`
        });
      }

      setShowApproveModal(false);
      setSelectedApplication(null);
      fetchApplications();
    }
  };

  const handleRejectApplication = async () => {
    if (!selectedApplication) return;

    await updateApplication(selectedApplication.id, {
      status: 'rejected',
      processedAt: Date.now(),
      processedBy: user?.address,
      rejectionReason: rejectionReason,
    });

    addNotification({
      type: 'info',
      title: 'Application Rejected',
      message: `${selectedApplication.companyName}'s application has been rejected`
    });

    setShowRejectModal(false);
    setSelectedApplication(null);
    setRejectionReason('');
    fetchApplications();
  };

  const handleVote = (id: string, vote: 'for' | 'against' | 'abstain') => {
    addNotification({
      type: 'success',
      title: 'Vote Submitted',
      message: `Your ${vote} vote has been recorded successfully.`
    });
  };

  const tabs = [
    { id: 'borrowers', label: 'Borrower Approvals', icon: <Users className="w-4 h-4" /> },
    { id: 'proposals', label: 'Proposals', icon: <Vote className="w-4 h-4" /> }
  ];

  const pendingApplications = borrowerApplications.filter(a => a.status === 'pending');
  const approvedApplications = borrowerApplications.filter(a => a.status === 'approved');
  const activeProposals = proposals.filter(p => p.votingDeadline > Date.now() && !p.executed);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatDisplay
          label="Pending Applications"
          value={pendingApplications.length}
          icon={<Clock className="w-5 h-5 text-yellow-500" />}
        />
        <StatDisplay
          label="Approved Borrowers"
          value={approvedApplications.length}
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
        />
        <StatDisplay
          label="Active Proposals"
          value={activeProposals.length}
          icon={<Vote className="w-5 h-5 text-governance" />}
        />
        <StatDisplay
          label="Total Applications"
          value={borrowerApplications.length}
          icon={<Users className="w-5 h-5 text-vault" />}
        />
      </div>

      {/* Role Banner */}
      {canDirectApprove ? (
        <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-400" />
            <div>
              <p className="font-medium text-green-400">
                {isOwner ? 'Owner' : 'Admin'} Access
              </p>
              <p className="text-sm text-surface-400">
                You can directly approve or reject borrower applications on-chain.
              </p>
            </div>
          </div>
        </div>
      ) : isGovernor ? (
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <Vote className="w-5 h-5 text-blue-400" />
            <div>
              <p className="font-medium text-blue-400">Governor Access</p>
              <p className="text-sm text-surface-400">
                You can vote on borrower applications. <strong>2 governor votes</strong> are required before an admin can execute the on-chain approval.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-surface-800/50 border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="font-medium text-surface-300">View Only</p>
              <p className="text-sm text-surface-400">
                Only governors, admins, and the owner can participate in the approval process.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-10 w-48"
            />
          </div>
          {activeTab === 'proposals' && (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Proposal
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-32">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="w-24 h-10" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'borrowers' ? (
            <motion.div
              key="borrowers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {borrowerApplications.length === 0 ? (
                <EmptyState
                  icon={<Users className="w-12 h-12 text-surface-400" />}
                  title="No Borrower Applications"
                  description="There are no borrower applications at this time. Companies can apply through the Borrower Portal."
                />
              ) : (
                <>
                  {/* Pending Applications */}
                  {pendingApplications.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-500" />
                        Pending Review ({pendingApplications.length})
                      </h3>
                      {pendingApplications
                        .filter(a => 
                          a.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.applicantAddress.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((application) => (
                          <Card key={application.id} className="p-4 hover:border-appex-500/20 transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                                  <Clock className="w-6 h-6 text-yellow-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold">{application.companyName}</h4>
                                    <Badge variant="warning">Pending</Badge>
                                  </div>
                                  <p className="text-sm text-surface-400 font-mono truncate">
                                    {formatAddress(application.applicantAddress)}
                                  </p>
                                  <p className="text-sm text-surface-400 mt-1 line-clamp-2">
                                    {application.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className="text-right">
                                  <p className="text-xs text-surface-400">Requested Limit</p>
                                  <p className="font-semibold text-lg">${parseInt(application.requestedLimit).toLocaleString()}</p>
                                </div>
                                <p className="text-xs text-surface-500">
                                  Applied {new Date(application.createdAt).toLocaleDateString()}
                                </p>
                                {/* Governor vote count */}
                                {(application.governorApprovals?.length || 0) > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Vote className="w-3 h-3 text-governance" />
                                    <span className={`text-xs font-medium ${
                                      (application.governorApprovals?.length || 0) >= 2 
                                        ? 'text-green-400' 
                                        : 'text-yellow-400'
                                    }`}>
                                      {application.governorApprovals?.length || 0}/2 governor votes
                                    </span>
                                  </div>
                                )}
                              </div>
                              {/* Action Buttons */}
                              {canApprove && (
                                <div className="flex flex-col gap-2 lg:ml-4">
                                  {/* Admin/Owner: Direct approve or Execute (if threshold met) */}
                                  {canDirectApprove ? (
                                    <Button
                                      size="sm"
                                      className={`${
                                        (application.governorApprovals?.length || 0) >= 2
                                          ? 'bg-green-600 hover:bg-green-700'
                                          : ''
                                      }`}
                                      onClick={() => {
                                        setSelectedApplication(application);
                                        setShowApproveModal(true);
                                      }}
                                      leftIcon={<CheckCircle className="w-4 h-4" />}
                                    >
                                      {(application.governorApprovals?.length || 0) >= 2
                                        ? 'Execute Approval'
                                        : 'Direct Approve'}
                                    </Button>
                                  ) : (
                                    /* Governor: Vote to approve */
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-green-400 hover:bg-green-500/10"
                                      onClick={() => {
                                        setSelectedApplication(application);
                                        setShowApproveModal(true);
                                      }}
                                      leftIcon={<ThumbsUp className="w-4 h-4" />}
                                      disabled={application.governorApprovals?.includes(user?.address?.toLowerCase() || '')}
                                    >
                                      {application.governorApprovals?.includes(user?.address?.toLowerCase() || '')
                                        ? 'Voted'
                                        : 'Vote to Approve'}
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-400 hover:bg-red-500/10"
                                    onClick={() => {
                                      setSelectedApplication(application);
                                      setShowRejectModal(true);
                                    }}
                                    leftIcon={<ThumbsDown className="w-4 h-4" />}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                    </div>
                  )}

                  {/* Approved Applications */}
                  {approvedApplications.length > 0 && (
                    <div className="space-y-3 mt-6">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Approved ({approvedApplications.length})
                      </h3>
                      {approvedApplications
                        .filter(a => 
                          a.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.applicantAddress.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((application) => (
                          <Card key={application.id} className="p-4 opacity-75">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                  <CheckCircle className="w-6 h-6 text-green-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold">{application.companyName}</h4>
                                    <Badge variant="success">Approved</Badge>
                                  </div>
                                  <p className="text-sm text-surface-400 font-mono truncate">
                                    {formatAddress(application.applicantAddress)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-surface-400">Credit Limit</p>
                                <p className="font-semibold">${parseInt(application.requestedLimit).toLocaleString()}</p>
                              </div>
                            </div>
                          </Card>
                        ))}
                    </div>
                  )}

                  {pendingApplications.length === 0 && approvedApplications.length === 0 && searchQuery && (
                    <EmptyState
                      icon={<Search className="w-12 h-12 text-surface-400" />}
                      title="No Results"
                      description={`No applications matching "${searchQuery}"`}
                    />
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="proposals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {proposals.length === 0 ? (
                <EmptyState
                  icon={<Vote className="w-12 h-12 text-surface-400" />}
                  title="No Active Proposals"
                  description="There are no governance proposals at this time. Create one to get started."
                  action={
                    <Button onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
                      Create Proposal
                    </Button>
                  }
                />
              ) : (
                proposals
                  .filter(p => 
                    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.description.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onVote={handleVote}
                    />
                  ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Create Proposal Modal */}
      <CreateProposalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Approve Application Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false);
          setSelectedApplication(null);
        }}
        title={canDirectApprove ? "Approve Borrower Application" : "Vote to Approve Application"}
      >
        {selectedApplication && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-800/50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-vault/20 to-governance/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-vault" />
                </div>
                <div>
                  <p className="font-semibold">{selectedApplication.companyName}</p>
                  <p className="text-sm text-surface-400 font-mono">
                    {formatAddress(selectedApplication.applicantAddress)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-surface-400">Requested Limit</p>
                  <p className="font-semibold">${parseInt(selectedApplication.requestedLimit).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-surface-400">Contact</p>
                  <p className="font-semibold">{selectedApplication.contactEmail}</p>
                </div>
              </div>
              {/* Show current governor votes */}
              {(selectedApplication.governorApprovals?.length || 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-sm text-surface-400">
                    Governor Approvals: <span className={`font-semibold ${
                      (selectedApplication.governorApprovals?.length || 0) >= 2 
                        ? 'text-green-400' 
                        : 'text-yellow-400'
                    }`}>
                      {selectedApplication.governorApprovals?.length || 0}/2
                    </span>
                  </p>
                </div>
              )}
            </div>

            {canDirectApprove && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-surface-400 mb-2">LP Yield Rate (bps)</label>
                  <Input
                    type="number"
                    placeholder="500"
                    value={lpYieldRate}
                    onChange={(e) => setLpYieldRate(e.target.value)}
                  />
                  <p className="text-xs text-surface-500 mt-1">{parseInt(lpYieldRate || '0') / 100}%</p>
                </div>
                <div>
                  <label className="block text-sm text-surface-400 mb-2">Protocol Fee (bps)</label>
                  <Input
                    type="number"
                    placeholder="200"
                    value={protocolFeeRate}
                    onChange={(e) => setProtocolFeeRate(e.target.value)}
                  />
                  <p className="text-xs text-surface-500 mt-1">{parseInt(protocolFeeRate || '0') / 100}%</p>
                </div>
              </div>
            )}

            {canDirectApprove ? (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm">
                <p className="text-green-400">
                  <strong>{(selectedApplication.governorApprovals?.length || 0) >= 2 ? 'Execute:' : 'Direct Approval:'}</strong> This will add {selectedApplication.companyName} as an approved borrower 
                  with a credit limit of ${parseInt(selectedApplication.requestedLimit).toLocaleString()}.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                <p className="text-blue-400">
                  <strong>Governor Vote:</strong> Your vote will be recorded. The application requires 2 governor approvals before an admin can execute the on-chain approval.
                  {(selectedApplication.governorApprovals?.length || 0) === 1 && (
                    <span className="block mt-1 text-yellow-400">1 more vote needed after yours!</span>
                  )}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedApplication(null);
                }}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 ${canDirectApprove ? 'bg-green-600 hover:bg-green-700' : ''}`}
                onClick={handleApproveApplication}
                isLoading={borrowerLoading}
                leftIcon={canDirectApprove ? <CheckCircle className="w-4 h-4" /> : <ThumbsUp className="w-4 h-4" />}
              >
                {canDirectApprove 
                  ? ((selectedApplication.governorApprovals?.length || 0) >= 2 ? 'Execute Approval' : 'Approve Borrower')
                  : 'Submit Vote'
                }
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Application Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedApplication(null);
          setRejectionReason('');
        }}
        title="Reject Borrower Application"
      >
        {selectedApplication && (
          <div className="space-y-4">
            <div className="p-4 bg-surface-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold">{selectedApplication.companyName}</p>
                  <p className="text-sm text-surface-400 font-mono">
                    {formatAddress(selectedApplication.applicantAddress)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-surface-400 mb-2">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={3}
                className="input-base w-full resize-none"
              />
            </div>

            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
              <p className="text-red-400">
                <strong>Warning:</strong> This will reject the application from {selectedApplication.companyName}. 
                They will be notified of the rejection.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedApplication(null);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleRejectApplication}
                disabled={!rejectionReason}
                leftIcon={<XCircle className="w-4 h-4" />}
              >
                Reject Application
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
