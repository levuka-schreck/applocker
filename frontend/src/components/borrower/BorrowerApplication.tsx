'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Mail,
  Globe,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { Card, Button, Input, Badge } from '@/components/ui';
import { useAppStore } from '@/lib/store';
import { useBorrowerApplicationsApi, BorrowerApplicationData } from '@/hooks/useApi';

export const BorrowerApplication = () => {
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [requestedLimit, setRequestedLimit] = useState('');
  const [myApplication, setMyApplication] = useState<BorrowerApplicationData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAppStore();
  const addNotification = useAppStore((state) => state.addNotification);
  const { checkMyApplication, submitApplication, isLoading } = useBorrowerApplicationsApi();

  // Check if user already has an application
  useEffect(() => {
    const checkExisting = async () => {
      if (user?.address) {
        const existing = await checkMyApplication(user.address);
        setMyApplication(existing);
      }
    };
    checkExisting();
  }, [user?.address, checkMyApplication]);

  const handleSubmit = async () => {
    if (!user?.address) {
      addNotification({ type: 'error', title: 'Not Connected', message: 'Please connect your wallet first' });
      return;
    }

    if (!companyName || !contactEmail || !description || !requestedLimit) {
      addNotification({ type: 'error', title: 'Missing Fields', message: 'Please fill in all required fields' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      addNotification({ type: 'error', title: 'Invalid Email', message: 'Please enter a valid email address' });
      return;
    }

    setIsSubmitting(true);
    const result = await submitApplication({
      applicantAddress: user.address,
      companyName,
      contactEmail,
      website: website || undefined,
      description,
      requestedLimit,
    });

    if (result) {
      setMyApplication(result);
      addNotification({
        type: 'success',
        title: 'Application Submitted',
        message: 'Your application has been submitted for review by the governance council.'
      });
      // Clear form
      setCompanyName('');
      setContactEmail('');
      setWebsite('');
      setDescription('');
      setRequestedLimit('');
    }
    setIsSubmitting(false);
  };

  // Show existing application status
  if (myApplication) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-governance/20 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-governance" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Borrower Application</h2>
            <p className="text-surface-400">Your application status</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold">{myApplication.companyName}</h3>
              <p className="text-sm text-surface-400 font-mono mt-1">{myApplication.applicantAddress}</p>
            </div>
            <Badge 
              variant={
                myApplication.status === 'approved' ? 'success' : 
                myApplication.status === 'rejected' ? 'error' : 
                'warning'
              }
            >
              {myApplication.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
              {myApplication.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
              {myApplication.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
              {myApplication.status.charAt(0).toUpperCase() + myApplication.status.slice(1)}
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-surface-800/50 rounded-lg">
              <p className="text-sm text-surface-400 mb-1">Requested Credit Limit</p>
              <p className="text-lg font-semibold">${parseInt(myApplication.requestedLimit).toLocaleString()}</p>
            </div>
            <div className="p-4 bg-surface-800/50 rounded-lg">
              <p className="text-sm text-surface-400 mb-1">Submitted</p>
              <p className="text-lg font-semibold">{new Date(myApplication.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="p-4 bg-surface-800/50 rounded-lg mb-6">
            <p className="text-sm text-surface-400 mb-2">Business Description</p>
            <p className="text-surface-300">{myApplication.description}</p>
          </div>

          {myApplication.status === 'pending' && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-400">Application Under Review</p>
                  <p className="text-sm text-surface-400 mt-1">
                    The governance council is reviewing your application. You will be notified once a decision is made.
                  </p>
                </div>
              </div>
            </div>
          )}

          {myApplication.status === 'approved' && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-400">Application Approved!</p>
                  <p className="text-sm text-surface-400 mt-1">
                    Your borrower account has been set up. Go to the Borrower Portal to start using your credit line.
                  </p>
                </div>
              </div>
            </div>
          )}

          {myApplication.status === 'rejected' && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-400">Application Not Approved</p>
                  {myApplication.rejectionReason && (
                    <p className="text-sm text-surface-400 mt-1">Reason: {myApplication.rejectionReason}</p>
                  )}
                  <p className="text-sm text-surface-400 mt-1">
                    You may submit a new application after addressing the concerns.
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Show application form
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-governance/20 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-governance" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Apply to Become a Borrower</h2>
          <p className="text-surface-400">Submit your application to access the AppEx credit facility</p>
        </div>
      </div>

      {/* Benefits */}
      <Card className="p-6 bg-gradient-to-r from-governance/10 to-transparent border-governance/20">
        <h3 className="font-semibold mb-4">Why Become an AppEx Borrower?</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-governance/20 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 text-governance" />
            </div>
            <div>
              <p className="font-medium">Instant Publisher Payments</p>
              <p className="text-sm text-surface-400">Pay publishers instantly instead of Net-90 terms</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-governance/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-governance" />
            </div>
            <div>
              <p className="font-medium">Flexible Credit Lines</p>
              <p className="text-sm text-surface-400">Borrow against your AR at competitive rates</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-governance/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-governance" />
            </div>
            <div>
              <p className="font-medium">Simple Process</p>
              <p className="text-sm text-surface-400">No complex paperwork, decentralized approval</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Application Form */}
      <Card className="p-6">
        <h3 className="font-semibold mb-6">Application Details</h3>
        
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Company Name *
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corporation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Contact Email *
              </label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="finance@acme.com"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                Website (optional)
              </label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acme.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">
                <DollarSign className="w-4 h-4 inline mr-2" />
                Requested Credit Limit (USDC) *
              </label>
              <Input
                type="number"
                value={requestedLimit}
                onChange={(e) => setRequestedLimit(e.target.value)}
                placeholder="100000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Business Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your business, your relationship with publishers, typical payment volumes, and why you need access to the AppEx protocol..."
              className="w-full h-32 px-4 py-3 bg-surface-800 border border-white/10 rounded-xl text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-governance/50 resize-none"
            />
            <p className="text-xs text-surface-500 mt-1">Minimum 50 characters</p>
          </div>

          <div className="p-4 bg-surface-800/50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-surface-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-surface-400">
                <p className="font-medium text-surface-300 mb-1">Review Process</p>
                <p>
                  Your application will be reviewed by the AppEx governance council. 
                  Approved borrowers will have their wallet address added to the protocol 
                  with the agreed credit limit. This typically takes 3-5 business days.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting || isLoading}
              disabled={!user?.address || !companyName || !contactEmail || !description || !requestedLimit}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit Application
            </Button>
          </div>
        </div>
      </Card>

      {!user?.address && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <p className="text-yellow-400">Please connect your wallet to submit an application.</p>
          </div>
        </div>
      )}
    </div>
  );
};
