'use client';

import './globals.css';
import { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { Toast } from '@/components/ui';

interface RootLayoutProps {
  children: ReactNode;
}

// Toast Container Component
const ToastContainer = () => {
  const notifications = useAppStore((state) => state.notifications);
  const [visibleToasts, setVisibleToasts] = useState<string[]>([]);

  useEffect(() => {
    const newToasts = notifications
      .filter((n) => !n.read)
      .slice(0, 3)
      .map((n) => n.id);
    setVisibleToasts(newToasts);

    // Auto-remove toasts after 5 seconds
    const timers = newToasts.map((id) =>
      setTimeout(() => {
        handleClose(id);
      }, 5000)
    );

    return () => timers.forEach(clearTimeout);
  }, [notifications]);

  const handleClose = (id: string) => {
    useAppStore.getState().markNotificationRead(id);
    setVisibleToasts((prev) => prev.filter((t) => t !== id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {notifications
          .filter((n) => visibleToasts.includes(n.id))
          .map((notification) => (
            <Toast
              key={notification.id}
              id={notification.id}
              type={notification.type}
              title={notification.title}
              message={notification.message}
              onClose={handleClose}
            />
          ))}
      </AnimatePresence>
    </div>
  );
};

export default function RootLayout({ children }: RootLayoutProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <html lang="en">
        <head>
          <title>AppEx Payments Protocol</title>
          <meta name="description" content="Instant Payment Infrastructure for Publishers - Liquidity Vaults Powering Near-Instant Payments" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </head>
        <body className="min-h-screen mesh-bg">
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-4 border-appex-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>AppEx Payments Protocol</title>
        <meta name="description" content="Instant Payment Infrastructure for Publishers - Liquidity Vaults Powering Near-Instant Payments" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen">
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}
