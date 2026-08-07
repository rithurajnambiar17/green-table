export type TableType = "snooker" | "mini_snooker" | "pool";
export type SessionStatus = "running" | "paused" | "ended";
export type PaymentStatus = "unpaid" | "paid" | "udhari";
export type Role = "admin" | "staff";

export interface ClubTable {
  id: string;
  name: string;
  type: TableType;
  active?: boolean;
  sortOrder?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  visits: number;
  lastVisit: string | null;
  allowCredit: boolean;
  balance: number;
}

export interface SessionExtra {
  id: string;
  sessionId: string;
  name: string;
  price: number;
  qty: number;
  category: string;
  createdAt: string;
}

export interface Session {
  id: string;
  tableId: string;
  tableName: string;
  tableType: TableType;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  startedAt: string;
  endedAt: string | null;
  accumulatedMs: number;
  runStartedAt: string | null;
  status: SessionStatus;
  hourlyRate: number;
  discount: number;
  manualAdjustment: number;
  taxRate: number;
  extrasTotal: number;
  total: number;
  payment: PaymentStatus;
  notes?: string;
  extras: SessionExtra[];
}

export interface Settings {
  clubName: string;
  currency: string;
  snookerRate: number;
  miniSnookerRate: number;
  poolRate: number;
  taxRate: number;
  countryCode: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  trackStock: boolean;
  sortOrder: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Expense {
  id: string;
  amount: number;
  category: 'cafe' | 'table';
  description: string;
  createdAt: string;
  createdBy?: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: 'given' | 'received';
  notes: string;
  createdAt: string;
  createdBy?: string;
}

export const TABLE_TYPE_LABEL: Record<TableType, string> = {
  snooker: "Royal Snooker",
  mini_snooker: "Mini Snooker",
  pool: "Pool",
};
