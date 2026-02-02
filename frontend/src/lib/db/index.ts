import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const PARTNERS_FILE = join(DATA_DIR, 'partners.json');
const REQUESTS_FILE = join(DATA_DIR, 'payment-requests.json');
const APPLICATIONS_FILE = join(DATA_DIR, 'borrower-applications.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Read JSON file safely
function readJsonFile<T>(filepath: string, defaultValue: T): T {
  try {
    ensureDataDir();
    if (existsSync(filepath)) {
      const data = readFileSync(filepath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filepath}:`, error);
  }
  return defaultValue;
}

// Write JSON file safely
function writeJsonFile<T>(filepath: string, data: T): void {
  try {
    ensureDataDir();
    writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${filepath}:`, error);
  }
}

// Partner operations
export interface Partner {
  address: string;
  name: string;
  borrowLimit: string;
  lpYieldRate: number;
  protocolFeeRate: number;
  approved: boolean;
  addedAt: number;
}

export async function getAllPartners(): Promise<Partner[]> {
  return readJsonFile<Partner[]>(PARTNERS_FILE, []);
}

export async function addPartner(partner: Omit<Partner, 'addedAt'>): Promise<Partner> {
  const partners = await getAllPartners();
  const newPartner: Partner = {
    ...partner,
    address: partner.address.toLowerCase(),
    addedAt: Date.now(),
  };
  
  // Remove existing partner with same address if exists
  const filtered = partners.filter(p => p.address.toLowerCase() !== partner.address.toLowerCase());
  filtered.unshift(newPartner);
  
  writeJsonFile(PARTNERS_FILE, filtered);
  return newPartner;
}

export async function removePartner(address: string): Promise<void> {
  const partners = await getAllPartners();
  const filtered = partners.filter(p => p.address.toLowerCase() !== address.toLowerCase());
  writeJsonFile(PARTNERS_FILE, filtered);
}

export async function updatePartner(address: string, updates: Partial<Partner>): Promise<void> {
  const partners = await getAllPartners();
  const updated = partners.map(p => 
    p.address.toLowerCase() === address.toLowerCase() 
      ? { ...p, ...updates }
      : p
  );
  writeJsonFile(PARTNERS_FILE, updated);
}

// Payment Request operations
export interface PaymentRequest {
  id: string;
  publisherAddress: string;
  publisherName?: string;
  borrowerAddress: string;
  amount: string;
  appexPercentage: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  createdAt: number;
  processedAt?: number;
  loanId?: number;
  note?: string;
}

export async function getAllPaymentRequests(): Promise<PaymentRequest[]> {
  return readJsonFile<PaymentRequest[]>(REQUESTS_FILE, []);
}

export async function getPaymentRequestsForBorrower(borrowerAddress: string): Promise<PaymentRequest[]> {
  const requests = await getAllPaymentRequests();
  return requests.filter(r => r.borrowerAddress.toLowerCase() === borrowerAddress.toLowerCase());
}

export async function getPaymentRequestsForPublisher(publisherAddress: string): Promise<PaymentRequest[]> {
  const requests = await getAllPaymentRequests();
  return requests.filter(r => r.publisherAddress.toLowerCase() === publisherAddress.toLowerCase());
}

export async function addPaymentRequest(request: Omit<PaymentRequest, 'id' | 'createdAt' | 'status'>): Promise<PaymentRequest> {
  const requests = await getAllPaymentRequests();
  const newRequest: PaymentRequest = {
    ...request,
    id: crypto.randomUUID(),
    publisherAddress: request.publisherAddress.toLowerCase(),
    borrowerAddress: request.borrowerAddress.toLowerCase(),
    status: 'pending',
    createdAt: Date.now(),
  };
  
  requests.unshift(newRequest);
  writeJsonFile(REQUESTS_FILE, requests);
  return newRequest;
}

export async function updatePaymentRequest(id: string, updates: Partial<PaymentRequest>): Promise<void> {
  const requests = await getAllPaymentRequests();
  const updated = requests.map(r => r.id === id ? { ...r, ...updates } : r);
  writeJsonFile(REQUESTS_FILE, updated);
}

// Borrower Application operations
export interface BorrowerApplication {
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
}

export async function getAllBorrowerApplications(): Promise<BorrowerApplication[]> {
  return readJsonFile<BorrowerApplication[]>(APPLICATIONS_FILE, []);
}

export async function getBorrowerApplicationByAddress(address: string): Promise<BorrowerApplication | null> {
  const applications = await getAllBorrowerApplications();
  return applications.find(a => a.applicantAddress.toLowerCase() === address.toLowerCase()) || null;
}

export async function addBorrowerApplication(application: Omit<BorrowerApplication, 'id' | 'createdAt' | 'status'>): Promise<BorrowerApplication> {
  const applications = await getAllBorrowerApplications();
  
  // Check if already applied
  const existing = applications.find(a => a.applicantAddress.toLowerCase() === application.applicantAddress.toLowerCase());
  if (existing && existing.status === 'pending') {
    throw new Error('Application already pending');
  }
  
  const newApplication: BorrowerApplication = {
    ...application,
    id: crypto.randomUUID(),
    applicantAddress: application.applicantAddress.toLowerCase(),
    status: 'pending',
    createdAt: Date.now(),
  };
  
  // Remove any previous rejected applications from same address
  const filtered = applications.filter(a => 
    a.applicantAddress.toLowerCase() !== application.applicantAddress.toLowerCase() || 
    a.status === 'approved'
  );
  filtered.unshift(newApplication);
  
  writeJsonFile(APPLICATIONS_FILE, filtered);
  return newApplication;
}

export async function updateBorrowerApplication(id: string, updates: Partial<BorrowerApplication>): Promise<void> {
  const applications = await getAllBorrowerApplications();
  const updated = applications.map(a => a.id === id ? { ...a, ...updates } : a);
  writeJsonFile(APPLICATIONS_FILE, updated);
}
