'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';

export function DataInitializer({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPartners = useAppStore((state) => state.setPartners);
  const setPaymentRequests = useAppStore((state) => state.setPaymentRequests);

  useEffect(() => {
    const init = async () => {
      try {
        // Fetch partners from API
        const partnersRes = await fetch('/api/partners');
        if (partnersRes.ok) {
          const partners = await partnersRes.json();
          setPartners(partners);
        }

        // Fetch payment requests from API
        const requestsRes = await fetch('/api/payment-requests');
        if (requestsRes.ok) {
          const requests = await requestsRes.json();
          setPaymentRequests(requests);
        }

        setInitialized(true);
      } catch (err: any) {
        console.error('Failed to initialize data:', err);
        setError(err.message);
        setInitialized(true); // Still allow app to render
      }
    };

    init();
  }, [setPartners, setPaymentRequests]);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-appex-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-400">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.warn('Data initialization had errors, but app will continue:', error);
  }

  return <>{children}</>;
}
