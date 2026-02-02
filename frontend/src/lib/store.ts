import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ethers } from 'ethers';
import { 
  User, 
  UserRole, 
  VaultStats, 
  LPPosition, 
  Borrower, 
  BorrowerApplication,
  Notification,
  Transaction,
  GovernanceProposal 
} from '@/types';

// Partner company with local metadata
export interface PartnerCompany {
  address: string;
  name: string;
  borrowLimit: string; // Stored as string for serialization
  lpYieldRate: number; // basis points
  protocolFeeRate: number; // basis points
  addedAt: number; // timestamp
  approved: boolean;
}

// Payment request from publisher to borrower
export interface PaymentRequest {
  id: string;
  publisherAddress: string;
  publisherName?: string;
  borrowerAddress: string; // The partner company address
  amount: string; // USDC amount as string
  appexPercentage: number; // 0-100
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  createdAt: number;
  processedAt?: number;
  loanId?: number; // Set when paid
  note?: string;
}

interface AppState {
  // Authentication
  user: User | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  isConnecting: boolean;
  isConnected: boolean;
  
  // Vault data
  vaultStats: VaultStats | null;
  lpPosition: LPPosition | null;
  
  // Borrower data
  borrowerInfo: Borrower | null;
  borrowerApplications: BorrowerApplication[];
  
  // Partner companies (stored in SQLite)
  partners: PartnerCompany[];
  
  // Payment requests (stored in SQLite)
  paymentRequests: PaymentRequest[];
  
  // Governance
  proposals: GovernanceProposal[];
  
  // UI state
  activeTab: string;
  selectedRole: UserRole;
  notifications: Notification[];
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  
  // Theme
  theme: 'dark' | 'light';
  
  // Actions
  setUser: (user: User | null) => void;
  setProvider: (provider: ethers.BrowserProvider | null) => void;
  setSigner: (signer: ethers.JsonRpcSigner | null) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setIsConnected: (isConnected: boolean) => void;
  setVaultStats: (stats: VaultStats | null) => void;
  setLPPosition: (position: LPPosition | null) => void;
  setBorrowerInfo: (info: Borrower | null) => void;
  setBorrowerApplications: (apps: BorrowerApplication[]) => void;
  // Partners - now backed by API/SQLite
  setPartners: (partners: PartnerCompany[]) => void;
  addPartner: (partner: Omit<PartnerCompany, 'addedAt'>) => void;
  updatePartner: (address: string, updates: Partial<PartnerCompany>) => void;
  removePartner: (address: string) => void;
  // Payment requests - now backed by API/SQLite
  setPaymentRequests: (requests: PaymentRequest[]) => void;
  addPaymentRequest: (request: Omit<PaymentRequest, 'id' | 'createdAt' | 'status'>) => void;
  updatePaymentRequest: (id: string, updates: Partial<PaymentRequest>) => void;
  getPaymentRequestsForBorrower: (borrowerAddress: string) => PaymentRequest[];
  getPaymentRequestsForPublisher: (publisherAddress: string) => PaymentRequest[];
  setProposals: (proposals: GovernanceProposal[]) => void;
  setActiveTab: (tab: string) => void;
  setSelectedRole: (role: UserRole) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  addTransaction: (tx: Omit<Transaction, 'timestamp'>) => void;
  updateTransaction: (hash: string, updates: Partial<Transaction>) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  toggleTheme: () => void;
  disconnect: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      provider: null,
      signer: null,
      isConnecting: false,
      isConnected: false,
      vaultStats: null,
      lpPosition: null,
      borrowerInfo: null,
      borrowerApplications: [],
      partners: [],
      paymentRequests: [],
      proposals: [],
      activeTab: 'dashboard',
      selectedRole: 'guest',
      notifications: [],
      transactions: [],
      isLoading: false,
      error: null,
      theme: 'dark',

      // Actions
      setUser: (user) => set({ user }),
      setProvider: (provider) => set({ provider }),
      setSigner: (signer) => set({ signer }),
      setIsConnecting: (isConnecting) => set({ isConnecting }),
      setIsConnected: (isConnected) => set({ isConnected }),
      setVaultStats: (vaultStats) => set({ vaultStats }),
      setLPPosition: (lpPosition) => set({ lpPosition }),
      setBorrowerInfo: (borrowerInfo) => set({ borrowerInfo }),
      setBorrowerApplications: (borrowerApplications) => set({ borrowerApplications }),
      
      // Partner management (local state, synced with API)
      setPartners: (partners) => set({ partners }),
      
      addPartner: (partner) => {
        set((state) => ({
          partners: [
            ...state.partners.filter(p => p.address.toLowerCase() !== partner.address.toLowerCase()),
            { ...partner, addedAt: Date.now() }
          ]
        }));
      },
      
      updatePartner: (address, updates) => {
        set((state) => ({
          partners: state.partners.map(p => 
            p.address.toLowerCase() === address.toLowerCase() 
              ? { ...p, ...updates }
              : p
          )
        }));
      },
      
      removePartner: (address) => {
        set((state) => ({
          partners: state.partners.filter(p => p.address.toLowerCase() !== address.toLowerCase())
        }));
      },
      
      // Payment request management (local state, synced with API)
      setPaymentRequests: (paymentRequests) => set({ paymentRequests }),
      
      addPaymentRequest: (request) => {
        const newRequest: PaymentRequest = {
          ...request,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          status: 'pending',
        };
        set((state) => ({
          paymentRequests: [newRequest, ...state.paymentRequests]
        }));
      },
      
      updatePaymentRequest: (id, updates) => {
        set((state) => ({
          paymentRequests: state.paymentRequests.map(r =>
            r.id === id ? { ...r, ...updates } : r
          )
        }));
      },
      
      getPaymentRequestsForBorrower: (borrowerAddress) => {
        return get().paymentRequests.filter(
          r => r.borrowerAddress.toLowerCase() === borrowerAddress.toLowerCase()
        );
      },
      
      getPaymentRequestsForPublisher: (publisherAddress) => {
        return get().paymentRequests.filter(
          r => r.publisherAddress.toLowerCase() === publisherAddress.toLowerCase()
        );
      },
      
      setProposals: (proposals) => set({ proposals }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setSelectedRole: (selectedRole) => set({ selectedRole }),
      
      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          read: false,
        };
        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50),
        }));
      },
      
      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },
      
      clearNotifications: () => set({ notifications: [] }),
      
      addTransaction: (tx) => {
        const newTx: Transaction = {
          ...tx,
          timestamp: Date.now(),
        };
        set((state) => ({
          transactions: [newTx, ...state.transactions].slice(0, 100),
        }));
      },
      
      updateTransaction: (hash, updates) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.hash === hash ? { ...tx, ...updates } : tx
          ),
        }));
      },
      
      setIsLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      
      disconnect: () => set({
        user: null,
        provider: null,
        signer: null,
        isConnected: false,
        lpPosition: null,
        borrowerInfo: null,
        selectedRole: 'guest',
      }),
    }),
    {
      name: 'appex-storage',
      partialize: (state) => ({
        theme: state.theme,
        activeTab: state.activeTab,
      }),
    }
  )
);

// Utility selector hooks
export const useUser = () => useAppStore((state) => state.user);
export const useIsConnected = () => useAppStore((state) => state.isConnected);
export const useVaultStats = () => useAppStore((state) => state.vaultStats);
export const useLPPosition = () => useAppStore((state) => state.lpPosition);
export const useBorrowerInfo = () => useAppStore((state) => state.borrowerInfo);
export const useNotifications = () => useAppStore((state) => state.notifications);
export const useTransactions = () => useAppStore((state) => state.transactions);
