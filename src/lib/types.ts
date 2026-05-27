export type TableType = "snooker" | "pool";
export type SessionStatus = "idle" | "running" | "paused" | "ended";
export type PaymentStatus = "unpaid" | "paid";
export type Role = "admin" | "staff";

export interface ClubTable {
  id: string;
  name: string;
  type: TableType;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  visits: number;
  lastVisit: string | null;
}

export interface Session {
  id: string;
  tableId: string;
  tableName: string;
  tableType: TableType;
  customerId: string;
  customerName: string;
  customerPhone: string;
  startedAt: string; // ISO
  endedAt: string | null;
  // accumulated billable ms (excluding paused time)
  accumulatedMs: number;
  // when status === running, the moment we started the current run
  runStartedAt: string | null;
  status: SessionStatus;
  hourlyRate: number;
  discount: number; // currency
  manualAdjustment: number; // can be negative
  taxRate: number; // percent, e.g. 5
  total: number; // computed final total when ended
  payment: PaymentStatus;
}

export interface Settings {
  clubName: string;
  currency: string;
  snookerRate: number;
  poolRate: number;
  taxRate: number; // %
  countryCode: string; // +92 etc., for wa.me links (digits only)
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
