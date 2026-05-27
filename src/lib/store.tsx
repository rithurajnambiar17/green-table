import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ClubTable,
  Customer,
  Session,
  Settings,
  User,
} from "./types";
import { calcBill } from "./format";

// ============== Initial seed data ==============
const DEFAULT_TABLES: ClubTable[] = [
  { id: "t1", name: "Royal Snooker 1", type: "snooker" },
  { id: "t2", name: "Royal Snooker 2", type: "snooker" },
  { id: "t3", name: "Mini Pool 1", type: "pool" },
  { id: "t4", name: "Mini Pool 2", type: "pool" },
  { id: "t5", name: "Mini Pool 3", type: "pool" },
];

const DEFAULT_SETTINGS: Settings = {
  clubName: "Green Table",
  currency: "PKR",
  snookerRate: 600,
  poolRate: 400,
  taxRate: 5,
  countryCode: "+92",
};

const DEMO_USERS: Array<User & { password: string }> = [
  { id: "u1", name: "Club Admin", email: "admin@greentable.club", role: "admin", password: "admin123" },
  { id: "u2", name: "Counter Staff", email: "staff@greentable.club", role: "staff", password: "staff123" },
];

// ============== Seed sessions for analytics demo ==============
function seedSessions(): Session[] {
  const now = Date.now();
  const out: Session[] = [];
  const tables = DEFAULT_TABLES;
  const names = ["Ali Raza", "Sara Khan", "Bilal Ahmed", "Ayesha Noor", "Hamza Tariq", "Zoya Iqbal", "Usman Sheikh", "Maria Sultan"];
  for (let i = 0; i < 38; i++) {
    const daysAgo = Math.floor(Math.random() * 28);
    const t = tables[i % tables.length];
    const rate = t.type === "snooker" ? 600 : 400;
    const durMin = 30 + Math.floor(Math.random() * 120);
    const ended = now - daysAgo * 86400000 - Math.floor(Math.random() * 36000000);
    const started = ended - durMin * 60000;
    const { total } = calcBill({
      durationMs: durMin * 60000,
      hourlyRate: rate,
      discount: 0,
      manualAdjustment: 0,
      taxRate: 5,
    });
    out.push({
      id: `seed-${i}`,
      tableId: t.id,
      tableName: t.name,
      tableType: t.type,
      customerId: `c-seed-${i % names.length}`,
      customerName: names[i % names.length],
      customerPhone: `30012345${(10 + i).toString().slice(-2)}`,
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(ended).toISOString(),
      accumulatedMs: durMin * 60000,
      runStartedAt: null,
      status: "ended",
      hourlyRate: rate,
      discount: 0,
      manualAdjustment: 0,
      taxRate: 5,
      total,
      payment: "paid",
    });
  }
  return out;
}

// ============== Store shape ==============
interface AppState {
  user: User | null;
  tables: ClubTable[];
  customers: Customer[];
  sessions: Session[];
  settings: Settings;
}

interface AppContextValue extends AppState {
  login: (email: string, password: string) => boolean;
  logout: () => void;
  updateSettings: (s: Partial<Settings>) => void;
  startSession: (input: {
    tableId: string;
    customerName: string;
    customerPhone: string;
  }) => Session;
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;
  endSession: (sessionId: string) => Session | undefined;
  updateSession: (sessionId: string, patch: Partial<Session>) => void;
  markPaid: (sessionId: string) => void;
  addCustomer: (c: Omit<Customer, "id" | "visits" | "lastVisit">) => Customer;
}

const STORAGE_KEY = "gt_app_v1";
const AUTH_KEY = "gt_auth_v1";

const Ctx = createContext<AppContextValue | null>(null);

function loadState(): AppState {
  if (typeof window === "undefined") {
    return { user: null, tables: DEFAULT_TABLES, customers: [], sessions: [], settings: DEFAULT_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const auth = localStorage.getItem(AUTH_KEY);
    const user = auth ? (JSON.parse(auth) as User) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Omit<AppState, "user">;
      return { ...parsed, user };
    }
  } catch {
    /* ignore */
  }
  return {
    user: null,
    tables: DEFAULT_TABLES,
    customers: [],
    sessions: seedSessions(),
    settings: DEFAULT_SETTINGS,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());

  // persist (skip user, that goes in AUTH_KEY)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { user: _user, ...rest } = state;
    void _user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }, [state]);

  // tick for live timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const login = useCallback((email: string, password: string) => {
    const found = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!found) return false;
    const { password: _p, ...user } = found;
    void _p;
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    setState((s) => ({ ...s, user }));
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setState((s) => ({ ...s, user: null }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const addCustomer = useCallback<AppContextValue["addCustomer"]>((c) => {
    const id = `c-${Date.now()}`;
    const customer: Customer = { id, ...c, visits: 0, lastVisit: null };
    setState((s) => ({ ...s, customers: [customer, ...s.customers] }));
    return customer;
  }, []);

  const startSession = useCallback<AppContextValue["startSession"]>(
    ({ tableId, customerName, customerPhone }) => {
      const id = `s-${Date.now()}`;
      let createdSession!: Session;
      setState((s) => {
        const table = s.tables.find((t) => t.id === tableId)!;
        const rate = table.type === "snooker" ? s.settings.snookerRate : s.settings.poolRate;
        // upsert customer by phone
        let customer = s.customers.find((c) => c.phone === customerPhone);
        let customers = s.customers;
        if (!customer) {
          customer = {
            id: `c-${Date.now()}`,
            name: customerName,
            phone: customerPhone,
            visits: 1,
            lastVisit: new Date().toISOString(),
          };
          customers = [customer, ...s.customers];
        } else {
          customers = s.customers.map((c) =>
            c.id === customer!.id
              ? { ...c, name: customerName || c.name, visits: c.visits + 1, lastVisit: new Date().toISOString() }
              : c,
          );
        }
        const now = new Date().toISOString();
        const session: Session = {
          id,
          tableId,
          tableName: table.name,
          tableType: table.type,
          customerId: customer.id,
          customerName,
          customerPhone,
          startedAt: now,
          endedAt: null,
          accumulatedMs: 0,
          runStartedAt: now,
          status: "running",
          hourlyRate: rate,
          discount: 0,
          manualAdjustment: 0,
          taxRate: s.settings.taxRate,
          total: 0,
          payment: "unpaid",
        };
        createdSession = session;
        return { ...s, customers, sessions: [session, ...s.sessions] };
      });
      return createdSession;
    },
    [],
  );

  const pauseSession = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((se) => {
        if (se.id !== id || se.status !== "running" || !se.runStartedAt) return se;
        const add = Date.now() - new Date(se.runStartedAt).getTime();
        return {
          ...se,
          accumulatedMs: se.accumulatedMs + add,
          runStartedAt: null,
          status: "paused",
        };
      }),
    }));
  }, []);

  const resumeSession = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((se) =>
        se.id === id && se.status === "paused"
          ? { ...se, runStartedAt: new Date().toISOString(), status: "running" }
          : se,
      ),
    }));
  }, []);

  const endSession = useCallback<AppContextValue["endSession"]>((id) => {
    let ended: Session | undefined;
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((se) => {
        if (se.id !== id) return se;
        const extra = se.status === "running" && se.runStartedAt
          ? Date.now() - new Date(se.runStartedAt).getTime()
          : 0;
        const totalMs = se.accumulatedMs + extra;
        const { total } = calcBill({
          durationMs: totalMs,
          hourlyRate: se.hourlyRate,
          discount: se.discount,
          manualAdjustment: se.manualAdjustment,
          taxRate: se.taxRate,
        });
        ended = {
          ...se,
          accumulatedMs: totalMs,
          runStartedAt: null,
          status: "ended",
          endedAt: new Date().toISOString(),
          total,
        };
        return ended;
      }),
    }));
    return ended;
  }, []);

  const updateSession = useCallback<AppContextValue["updateSession"]>((id, patch) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((se) => (se.id === id ? { ...se, ...patch } : se)),
    }));
  }, []);

  const markPaid = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((se) => (se.id === id ? { ...se, payment: "paid" } : se)),
    }));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      login,
      logout,
      updateSettings,
      startSession,
      pauseSession,
      resumeSession,
      endSession,
      updateSession,
      markPaid,
      addCustomer,
    }),
    [state, login, logout, updateSettings, startSession, pauseSession, resumeSession, endSession, updateSession, markPaid, addCustomer],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/** Live elapsed ms for a session (accounts for current running streak). */
export function sessionElapsedMs(s: Session) {
  if (s.status === "running" && s.runStartedAt) {
    return s.accumulatedMs + (Date.now() - new Date(s.runStartedAt).getTime());
  }
  return s.accumulatedMs;
}
