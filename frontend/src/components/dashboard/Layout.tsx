'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Landmark,
  Coins,
  Users,
  Vote,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
  Menu,
  X,
  Wallet,
  TrendingUp,
  CreditCard,
  Shield,
  FileText,
  Key,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, Badge, Button } from '@/components/ui';
import { formatAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  roles: UserRole[];
  href?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['lp', 'borrower', 'publisher', 'admin'] },
  { id: 'vault', label: 'Payments Vault', icon: <Landmark className="w-5 h-5" />, roles: ['lp', 'admin'] },
  { id: 'staking', label: 'Staking', icon: <Coins className="w-5 h-5" />, roles: ['lp', 'admin'] },
  { id: 'borrower', label: 'Borrower Portal', icon: <CreditCard className="w-5 h-5" />, roles: ['borrower', 'admin'] },
  { id: 'publisher', label: 'Publisher Portal', icon: <TrendingUp className="w-5 h-5" />, roles: ['publisher', 'admin'] },
  { id: 'apply', label: 'Apply as Borrower', icon: <FileText className="w-5 h-5" />, roles: ['lp', 'borrower', 'publisher', 'admin', 'guest'] },
  { id: 'governance', label: 'Governance', icon: <Vote className="w-5 h-5" />, roles: ['lp', 'admin'] },
  { id: 'admin', label: 'Admin Panel', icon: <Shield className="w-5 h-5" />, roles: ['lp', 'borrower', 'publisher', 'admin'] },
  { id: 'history', label: 'Transaction History', icon: <History className="w-5 h-5" />, roles: ['lp', 'borrower', 'publisher', 'admin'] },
  { id: 'settings', label: 'Account Settings', icon: <Key className="w-5 h-5" />, roles: ['lp', 'borrower', 'publisher', 'admin', 'guest'] },
];

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user, activeTab, setActiveTab, selectedRole, setSelectedRole, notifications } = useAppStore();
  const { disconnect } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNavItems = navItems.filter((item) => 
    item.roles.some((role) => user?.roles.includes(role) || role === 'guest')
  );

  const handleNavClick = (itemId: string) => {
    setActiveTab(itemId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen mesh-bg">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-surface-700/50"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-appex-500 to-vault flex items-center justify-center">
              <span className="text-sm font-bold">A</span>
            </div>
            <span className="font-bold text-gradient">AppEx</span>
          </div>

          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg hover:bg-surface-700/50 relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error rounded-full text-xs flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-40 glass border-r border-white/5 flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'w-20' : 'w-64',
          'hidden lg:flex',
        )}
      >
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-appex-500 to-vault flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold">A</span>
          </div>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <span className="text-xl font-bold text-gradient">AppEx</span>
              <p className="text-xs text-surface-400">Payments Protocol</p>
            </motion.div>
          )}
        </div>

        {/* Role Selector */}
        {!sidebarCollapsed && user && user.roles.length > 1 && (
          <div className="px-4 mb-4">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 bg-surface-800/50 border border-white/10 rounded-lg text-sm"
            >
              {user.roles.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                'w-full nav-item',
                activeTab === item.id && 'nav-item-active',
                sidebarCollapsed && 'justify-center'
              )}
            >
              {item.icon}
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/5">
          {user && (
            <div className={cn(
              'flex items-center gap-3',
              sidebarCollapsed && 'justify-center'
            )}>
              <Avatar name={user.name || user.address} size="md" />
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.name || 'User'}</p>
                  <p className="text-xs text-surface-400 truncate">
                    {formatAddress(user.address)}
                  </p>
                </div>
              )}
              {!sidebarCollapsed && (
                <button
                  onClick={disconnect}
                  className="p-2 rounded-lg hover:bg-surface-700/50 text-surface-400 hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-700 border border-white/10 flex items-center justify-center hover:bg-surface-600 transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="lg:hidden fixed top-0 left-0 bottom-0 w-72 z-40 glass border-r border-white/5 flex flex-col pt-16"
          >
            {/* Role Selector */}
            {user && user.roles.length > 1 && (
              <div className="px-4 py-4">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-surface-800/50 border border-white/10 rounded-lg text-sm"
                >
                  {user.roles.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
              {filteredNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    'w-full nav-item',
                    activeTab === item.id && 'nav-item-active'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-white/5">
              {user && (
                <div className="flex items-center gap-3">
                  <Avatar name={user.name || user.address} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name || 'User'}</p>
                    <p className="text-xs text-surface-400 truncate">
                      {formatAddress(user.address)}
                    </p>
                  </div>
                  <button
                    onClick={disconnect}
                    className="p-2 rounded-lg hover:bg-surface-700/50 text-surface-400 hover:text-white"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        className={cn(
          'transition-all duration-300 min-h-screen',
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64',
          'pt-16 lg:pt-0'
        )}
      >
        {/* Desktop Header */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-white/5">
          <div>
            <h1 className="text-2xl font-bold capitalize">{activeTab}</h1>
            <p className="text-surface-400 text-sm">
              {getTabDescription(activeTab)}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-lg hover:bg-surface-700/50 relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-error rounded-full text-xs flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {user && (
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="text-right">
                  <p className="font-medium">{user.name || 'User'}</p>
                  <p className="text-xs text-surface-400">
                    {formatAddress(user.address)}
                  </p>
                </div>
                <Avatar name={user.name || user.address} size="md" />
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>

      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="fixed top-16 lg:top-4 right-4 w-80 max-h-[calc(100vh-6rem)] glass-card z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold">Notifications</h3>
                <Badge variant="info">{unreadCount} new</Badge>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-surface-400">
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'p-4 border-b border-white/5 hover:bg-surface-700/30 cursor-pointer',
                        !notification.read && 'bg-surface-800/50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                            notification.type === 'success' && 'bg-success',
                            notification.type === 'error' && 'bg-error',
                            notification.type === 'warning' && 'bg-warning',
                            notification.type === 'info' && 'bg-vault'
                          )}
                        />
                        <div>
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-surface-400">{notification.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

function getTabDescription(tab: string): string {
  const descriptions: Record<string, string> = {
    dashboard: 'Overview of your protocol activity',
    vault: 'Manage your liquidity deposits and LP tokens',
    staking: 'Stake $APPEX to earn protocol fee distributions',
    borrower: 'Manage loans and publisher payments',
    publisher: 'Request instant payments and manage payouts',
    governance: 'Vote on proposals and borrower approvals',
    admin: 'Manage protocol settings and borrower applications',
    history: 'View your transaction history',
  };
  return descriptions[tab] || '';
}
