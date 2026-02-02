import { useState, useCallback, useEffect } from 'react';
import { useAppStore, PartnerCompany, PaymentRequest } from '@/lib/store';

const API_BASE = '/api';

// Partners API hooks - fetches from SQLite via API
export function usePartnersApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partners = useAppStore((state) => state.partners);
  const setPartners = useAppStore((state) => state.setPartners);

  const fetchPartners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/partners`);
      if (!res.ok) throw new Error('Failed to fetch partners');
      const data = await res.json();
      setPartners(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      console.error('Fetch partners error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [setPartners]);

  const addPartner = useCallback(async (partner: Omit<PartnerCompany, 'addedAt'>) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/partners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partner),
      });
      if (!res.ok) throw new Error('Failed to add partner');
      const newPartner = await res.json();
      // Refetch to get updated list
      await fetchPartners();
      return newPartner;
    } catch (err: any) {
      setError(err.message);
      console.error('Add partner error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPartners]);

  const removePartner = useCallback(async (address: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/partners?address=${encodeURIComponent(address)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove partner');
      // Refetch to get updated list
      await fetchPartners();
      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('Remove partner error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPartners]);

  const updatePartner = useCallback(async (address: string, updates: Partial<PartnerCompany>) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/partners`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update partner');
      // Refetch to get updated list
      await fetchPartners();
      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('Update partner error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPartners]);

  return {
    partners,
    isLoading,
    error,
    fetchPartners,
    addPartner,
    removePartner,
    updatePartner,
  };
}

// Payment Requests API hooks - fetches from SQLite via API
export function usePaymentRequestsApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentRequests = useAppStore((state) => state.paymentRequests);
  const setPaymentRequests = useAppStore((state) => state.setPaymentRequests);

  const fetchPaymentRequests = useCallback(async (filter?: { borrower?: string; publisher?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/payment-requests`;
      if (filter?.borrower) {
        url += `?borrower=${encodeURIComponent(filter.borrower)}`;
      } else if (filter?.publisher) {
        url += `?publisher=${encodeURIComponent(filter.publisher)}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch payment requests');
      const data = await res.json();
      setPaymentRequests(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      console.error('Fetch payment requests error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [setPaymentRequests]);

  const addPaymentRequest = useCallback(async (request: {
    publisherAddress: string;
    publisherName?: string;
    borrowerAddress: string;
    amount: string;
    appexPercentage: number;
    note?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/payment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error('Failed to create payment request');
      const newRequest = await res.json();
      // Refetch to get updated list
      await fetchPaymentRequests();
      return newRequest;
    } catch (err: any) {
      setError(err.message);
      console.error('Add payment request error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPaymentRequests]);

  const updatePaymentRequest = useCallback(async (id: string, updates: Partial<PaymentRequest>) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/payment-requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update payment request');
      // Refetch to get updated list
      await fetchPaymentRequests();
      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('Update payment request error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchPaymentRequests]);

  // Helper to get requests for a specific borrower
  const getRequestsForBorrower = useCallback((borrowerAddress: string) => {
    return paymentRequests.filter(
      r => r.borrowerAddress.toLowerCase() === borrowerAddress.toLowerCase()
    );
  }, [paymentRequests]);

  // Helper to get requests for a specific publisher
  const getRequestsForPublisher = useCallback((publisherAddress: string) => {
    return paymentRequests.filter(
      r => r.publisherAddress.toLowerCase() === publisherAddress.toLowerCase()
    );
  }, [paymentRequests]);

  return {
    paymentRequests,
    isLoading,
    error,
    fetchPaymentRequests,
    addPaymentRequest,
    updatePaymentRequest,
    getRequestsForBorrower,
    getRequestsForPublisher,
  };
}

// Hook to initialize data on app load
export function useInitializeData() {
  const { fetchPartners } = usePartnersApi();
  const { fetchPaymentRequests } = usePaymentRequestsApi();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!initialized) {
        await Promise.all([fetchPartners(), fetchPaymentRequests()]);
        setInitialized(true);
      }
    };
    init();
  }, []); // Only run once on mount

  return initialized;
}

// Borrower Application interface (matches db)
export interface BorrowerApplicationData {
  id: string;
  applicantAddress: string;
  companyName: string;
  contactEmail: string;
  website?: string;
  description: string;
  requestedLimit: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  processedAt?: number;
  processedBy?: string;
  rejectionReason?: string;
  // Governor approval tracking
  governorApprovals?: string[]; // Array of governor addresses who approved
  lpYieldRate?: number;
  protocolFeeRate?: number;
}

// Borrower Applications API hooks
export function useBorrowerApplicationsApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<BorrowerApplicationData[]>([]);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/borrower-applications`);
      if (!res.ok) throw new Error('Failed to fetch applications');
      const data = await res.json();
      setApplications(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      console.error('Fetch applications error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkMyApplication = useCallback(async (address: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/borrower-applications?address=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error('Failed to check application');
      const data = await res.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      console.error('Check application error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitApplication = useCallback(async (application: {
    applicantAddress: string;
    companyName: string;
    contactEmail: string;
    website?: string;
    description: string;
    requestedLimit: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/borrower-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(application),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit application');
      }
      const newApp = await res.json();
      await fetchApplications();
      return newApp;
    } catch (err: any) {
      setError(err.message);
      console.error('Submit application error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchApplications]);

  const updateApplication = useCallback(async (id: string, updates: Partial<BorrowerApplicationData>) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/borrower-applications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to update application');
      await fetchApplications();
      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('Update application error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchApplications]);

  return {
    applications,
    isLoading,
    error,
    fetchApplications,
    checkMyApplication,
    submitApplication,
    updateApplication,
  };
}
