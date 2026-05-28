export type TableType = "snooker" | "pool";
export type SessionStatus = "running" | "paused" | "ended";
export type PaymentStatus = "unpaid" | "paid";
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
}

export interface SessionExtra {
  id: string;
  sessionId: string;
  name: string;
  price: number;
  qty: number;
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
  extras: SessionExtra[];
}

export interface Settings {
  clubName: string;
  currency: string;
  snookerRate: number;
  poolRate: number;
  taxRate: number;
  countryCode: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
