import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  ClubTable,
  Customer,
  InventoryItem,
  Session,
  SessionExtra,
  Settings,
  User,
  TableType,
  Expense,
} from "./types";
import { calcBill, sumExtras } from "./format";

interface AppState {
  user: User | null;
  authLoading: boolean;
  loading: boolean;
  tables: ClubTable[];
  customers: Customer[];
  sessions: Session[];
  settings: Settings;
  inventory: InventoryItem[];
  expenses: Expense[];
  customerTransactions: import("./types").CustomerTransaction[];
}

interface AppContextValue extends AppState {
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  startSession: (input: { tableId: string; customerName: string; customerPhone: string }) => Promise<Session | null>;
  pauseSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  endSession: (id: string) => Promise<Session | undefined>;
  updateSession: (id: string, patch: { hourlyRate?: number; discount?: number; manualAdjustment?: number; taxRate?: number; notes?: string; customerName?: string; customerPhone?: string }) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
  markUdhari: (id: string) => Promise<void>;
  toggleUdhariAccess: (customerId: string, allow: boolean) => Promise<void>;
  addUdhariTransaction: (customerId: string, amount: number, type: 'given' | 'received', notes: string) => Promise<void>;
  deleteUdhariTransaction: (txId: string) => Promise<void>;
  dismissSession: (id: string) => void;
  addExtra: (sessionId: string, name: string, price: number, qty: number, inventoryId?: string) => Promise<void>;
  removeExtra: (extraId: string) => Promise<void>;
  updateExtraQty: (extraId: string, delta: number) => Promise<void>;
  addExpense: (amount: number, category: 'cafe' | 'table', description: string) => Promise<void>;
  updateExpense: (id: string, patch: { amount?: number; category?: 'cafe' | 'table'; description?: string }) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  createTable: (name: string, type: TableType) => Promise<void>;
  updateTable: (id: string, patch: Partial<ClubTable>) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  createInventoryItem: (item: Omit<InventoryItem, "id" | "sortOrder">) => Promise<void>;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  clearData: () => Promise<void>;
  clearSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  checkoutWalkIn: (cart: { name: string; price: number; qty: number; inventoryId?: string }[], customerName?: string, customerPhone?: string, payment?: import("./types").PaymentStatus, notes?: string) => Promise<void>;
  logPastSession: (input: { tableId: string; customerName: string; customerPhone: string; startedAt: string; endedAt: string; payment: import("./types").PaymentStatus; notes?: string; cart: { name: string; price: number; qty: number; inventoryId?: string }[] }) => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  clubName: "Green Table",
  currency: "PKR",
  snookerRate: 250,
  miniSnookerRate: 200,
  poolRate: 150,
  taxRate: 5,
  countryCode: "+92",
};

const Ctx = createContext<AppContextValue | null>(null);

// ============ row mappers ============
type DbTable = { id: string; name: string; type: string; active: boolean; sort_order: number };
type DbCustomer = { id: string; name: string; phone: string; visits: number; last_visit: string | null; allow_credit: boolean; balance: number };
type DbExtra = { id: string; session_id: string; name: string; price: number; qty: number; category: string; created_at: string };
type DbSession = {
  id: string; table_id: string; table_name: string; table_type: string;
  customer_id: string | null; customer_name: string; customer_phone: string;
  started_at: string; ended_at: string | null;
  accumulated_ms: number; run_started_at: string | null; status: string;
  hourly_rate: number; discount: number; manual_adjustment: number; tax_rate: number;
  extras_total: number; total: number; payment: string; notes: string | null;
};
type DbSettings = { id: number; club_name: string; currency: string; snooker_rate: number; mini_snooker_rate: number | null; pool_rate: number; tax_rate: number; country_code: string };
type DbInventory = { id: string; name: string; category: string; price: number; stock: number; track_stock: boolean; sort_order: number };
type DbExpense = { id: string; amount: number; category: 'cafe' | 'table'; description: string; created_at: string; created_by: string };
type DbCustomerTransaction = { id: string; customer_id: string; amount: number; type: string; notes: string; created_at: string; created_by: string };

const mapTable = (r: DbTable): ClubTable => ({ id: r.id, name: r.name, type: r.type as TableType, active: r.active, sortOrder: r.sort_order });
const mapCustomer = (r: DbCustomer): Customer => ({ id: r.id, name: r.name, phone: r.phone, visits: r.visits, lastVisit: r.last_visit, allowCredit: r.allow_credit || false, balance: Number(r.balance || 0) });
const mapCustomerTransaction = (r: DbCustomerTransaction): import("./types").CustomerTransaction => ({ id: r.id, customerId: r.customer_id, amount: Number(r.amount), type: r.type as 'given' | 'received', notes: r.notes || "", createdAt: r.created_at, createdBy: r.created_by });
const mapExtra = (r: DbExtra): SessionExtra => ({ id: r.id, sessionId: r.session_id, name: r.name, price: Number(r.price), qty: r.qty, category: r.category, createdAt: r.created_at });
const mapSession = (r: DbSession, extras: SessionExtra[]): Session => ({
  id: r.id, tableId: r.table_id, tableName: r.table_name, tableType: r.table_type as TableType,
  customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone,
  startedAt: r.started_at, endedAt: r.ended_at,
  accumulatedMs: Number(r.accumulated_ms), runStartedAt: r.run_started_at, status: r.status as Session["status"],
  hourlyRate: Number(r.hourly_rate), discount: Number(r.discount), manualAdjustment: Number(r.manual_adjustment),
  taxRate: Number(r.tax_rate), extrasTotal: Number(r.extras_total), total: Number(r.total),
  payment: r.payment as Session["payment"], notes: r.notes ?? "", extras,
});
const mapSettings = (r: DbSettings): Settings => ({
  clubName: r.club_name, currency: r.currency,
  snookerRate: Number(r.snooker_rate),
  miniSnookerRate: Number(r.mini_snooker_rate ?? 200),
  poolRate: Number(r.pool_rate),
  taxRate: Number(r.tax_rate), countryCode: r.country_code,
});
const mapInventory = (r: DbInventory): InventoryItem => ({
  id: r.id, name: r.name, category: r.category,
  price: Number(r.price), stock: r.stock, trackStock: r.track_stock, sortOrder: r.sort_order,
});
const mapExpense = (r: DbExpense): Expense => ({
  id: r.id, amount: Number(r.amount), category: r.category, description: r.description,
  createdAt: r.created_at, createdBy: r.created_by,
});

export function rateForType(t: TableType, s: Settings): number {
  if (t === "snooker") return s.snookerRate;
  if (t === "mini_snooker") return s.miniSnookerRate;
  return s.poolRate;
}

export async function fetchPaginated(table: string, orderBy: string, maxLimit: number) {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  while (from < maxLimit) {
    const to = Math.min(from + step - 1, maxLimit - 1);
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .order(orderBy, { ascending: false })
      .range(from, to);
    if (error || !data) break;
    allData = allData.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return { data: allData };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<ClubTable[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<import("./types").CustomerTransaction[]>([]);
  const [dismissedSessions, setDismissedSessions] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dismissed_sessions");
      if (stored) setDismissedSessions(JSON.parse(stored));
    } catch (e) { }
  }, []);

  const dismissSession = useCallback((id: string) => {
    setDismissedSessions(prev => {
      const next = [...prev, id];
      localStorage.setItem("dismissed_sessions", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    supabase.from("settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(mapSettings(data as DbSettings));
    });
  }, []);

  const loadUser = useCallback(async (uid: string, email: string) => {
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    setUser({
      id: uid,
      email,
      name: profile?.name ?? email.split("@")[0],
      role: (roleRow?.role as User["role"]) ?? "staff",
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setTimeout(() => loadUser(session.user.id, session.user.email ?? ""), 0);
      } else {
        setUser(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        loadUser(session.user.id, session.user.email ?? "").finally(() => setAuthLoading(false));
      } else {
        setAuthLoading(false);
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadUser]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tablesRes, customersRes, sessionsRes, extrasRes, settingsRes, inventoryRes, expensesRes, txRes] = await Promise.all([
      supabase.from("club_tables").select("*").order("sort_order"),
      supabase.from("customers").select("*").order("last_visit", { ascending: false, nullsFirst: false }),
      fetchPaginated("sessions", "started_at", 5000),
      fetchPaginated("session_extras", "created_at", 20000),
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("inventory_items").select("*").order("sort_order"),
      fetchPaginated("expenses", "created_at", 5000),
      fetchPaginated("customer_transactions", "created_at", 5000),
    ]);
    setTables((tablesRes.data ?? []).map((r) => mapTable(r as DbTable)));
    setCustomers((customersRes.data ?? []).map((r) => mapCustomer(r as DbCustomer)));
    const extrasByS = new Map<string, SessionExtra[]>();
    for (const e of (extrasRes.data ?? []).map((r) => mapExtra(r as DbExtra))) {
      const arr = extrasByS.get(e.sessionId) ?? [];
      arr.push(e); extrasByS.set(e.sessionId, arr);
    }
    setSessions((sessionsRes.data ?? []).map((r) => mapSession(r as DbSession, extrasByS.get((r as DbSession).id) ?? [])));
    if (settingsRes.data) setSettings(mapSettings(settingsRes.data as DbSettings));
    setInventory((inventoryRes.data ?? []).map((r) => mapInventory(r as DbInventory)));
    setExpenses((expensesRes.data ?? []).map((r) => mapExpense(r as DbExpense)));
    setCustomerTransactions((txRes.data ?? []).map((r) => mapCustomerTransaction(r as DbCustomerTransaction)));
    setLoading(false);
  }, []);

  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user) { loadedFor.current = null; return; }
    if (loadedFor.current === user.id) return;
    loadedFor.current = user.id;
    loadAll();

    const ch = supabase
      .channel("gt-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "session_extras" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "club_tables" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_transactions" }, () => loadAll())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, loadAll]);

  const signIn: AppContextValue["signIn"] = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);
  const signUp: AppContextValue["signUp"] = useCallback(async (email, password, name) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { name } },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateSettings: AppContextValue["updateSettings"] = useCallback(async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from("settings").update({
      club_name: next.clubName, currency: next.currency,
      snooker_rate: next.snookerRate,
      mini_snooker_rate: next.miniSnookerRate,
      pool_rate: next.poolRate,
      tax_rate: next.taxRate, country_code: next.countryCode,
    }).eq("id", 1);
  }, [settings]);

  const createTable: AppContextValue["createTable"] = useCallback(async (name, type) => {
    const maxOrder = tables.reduce((a, t) => Math.max(a, t.sortOrder ?? 0), 0);
    const { data } = await supabase.from("club_tables").insert({ name, type, sort_order: maxOrder + 1 }).select().single();
    if (data) {
      setTables(prev => [...prev, mapTable(data as DbTable)]);
    }
  }, [tables]);
  const updateTable: AppContextValue["updateTable"] = useCallback(async (id, patch) => {
    const dbPatch: { name?: string; type?: string; active?: boolean } = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.type !== undefined) dbPatch.type = patch.type;
    if (patch.active !== undefined) dbPatch.active = patch.active;
    await supabase.from("club_tables").update(dbPatch).eq("id", id);
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);
  const deleteTable: AppContextValue["deleteTable"] = useCallback(async (id) => {
    await supabase.from("club_tables").delete().eq("id", id);
    setTables(prev => prev.filter(t => t.id !== id));
  }, []);

  const startSession: AppContextValue["startSession"] = useCallback(async ({ tableId, customerName, customerPhone }) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;
    const rate = rateForType(table.type, settings);

    const existing = customers.find((c) => c.phone === customerPhone);
    let customerId = existing?.id ?? null;
    if (existing) {
      await supabase.from("customers").update({
        name: customerName || existing.name,
        visits: existing.visits + 1,
        last_visit: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      const { data: ins } = await supabase.from("customers").insert({
        name: customerName, phone: customerPhone, visits: 1, last_visit: new Date().toISOString(),
      }).select("id").maybeSingle();
      customerId = ins?.id ?? null;
    }

    const now = new Date().toISOString();
    const { data: created } = await supabase.from("sessions").insert({
      table_id: table.id, table_name: table.name, table_type: table.type,
      customer_id: customerId, customer_name: customerName, customer_phone: customerPhone,
      started_at: now, run_started_at: now,
      accumulated_ms: 0, status: "running",
      hourly_rate: rate, discount: 0, manual_adjustment: 0, tax_rate: settings.taxRate,
      extras_total: 0, total: 0, payment: "unpaid",
    }).select("*").maybeSingle();
    if (!created) return null;
    const newSession = mapSession(created as DbSession, []);
    setSessions(prev => [newSession, ...prev]);
    return newSession;
  }, [tables, customers, settings]);

  const pauseSession = useCallback(async (id: string) => {
    const s = sessions.find((x) => x.id === id);
    if (!s || s.status !== "running" || !s.runStartedAt) return;
    const add = Date.now() - new Date(s.runStartedAt).getTime();
    await supabase.from("sessions").update({
      accumulated_ms: s.accumulatedMs + add,
      run_started_at: null,
      status: "paused",
    }).eq("id", id);
    setSessions(prev => prev.map(x => x.id === id ? { ...x, accumulatedMs: x.accumulatedMs + add, runStartedAt: null, status: "paused" } : x));
  }, [sessions]);

  const resumeSession = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from("sessions").update({
      run_started_at: now, status: "running",
    }).eq("id", id);
    setSessions(prev => prev.map(x => x.id === id ? { ...x, runStartedAt: now, status: "running" } : x));
  }, []);

  const endSession: AppContextValue["endSession"] = useCallback(async (id) => {
    const s = sessions.find((x) => x.id === id);
    if (!s) return undefined;
    const extra = s.status === "running" && s.runStartedAt
      ? Date.now() - new Date(s.runStartedAt).getTime() : 0;
    const totalMs = s.accumulatedMs + extra;
    const extrasTotal = sumExtras(s.extras);
    const { total } = calcBill({
      durationMs: totalMs, hourlyRate: s.hourlyRate,
      discount: s.discount, manualAdjustment: s.manualAdjustment,
      taxRate: s.taxRate, extrasTotal,
    });
    const { data } = await supabase.from("sessions").update({
      accumulated_ms: totalMs, run_started_at: null,
      status: "ended", ended_at: new Date().toISOString(),
      extras_total: extrasTotal, total,
    }).eq("id", id).select("*").maybeSingle();
    const updated = data ? mapSession(data as DbSession, s.extras) : undefined;
    if (updated) {
      setSessions(prev => prev.map(x => x.id === id ? updated : x));
    }
    return updated;
  }, [sessions]);

  const updateSession: AppContextValue["updateSession"] = useCallback(async (id, patch) => {
    const dbPatch: { hourly_rate?: number; discount?: number; manual_adjustment?: number; tax_rate?: number; notes?: string; customer_id?: string | null; customer_name?: string; customer_phone?: string; } = {};
    if (patch.hourlyRate !== undefined) dbPatch.hourly_rate = patch.hourlyRate;
    if (patch.discount !== undefined) dbPatch.discount = patch.discount;
    if (patch.manualAdjustment !== undefined) dbPatch.manual_adjustment = patch.manualAdjustment;
    if (patch.taxRate !== undefined) dbPatch.tax_rate = patch.taxRate;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;

    let nextCustomerId: string | null | undefined = undefined;
    if (patch.customerPhone !== undefined) {
      const existing = customers.find((c) => c.phone === patch.customerPhone);
      nextCustomerId = existing?.id ?? null;
      if (existing) {
        await supabase.from("customers").update({
          name: patch.customerName || existing.name,
        }).eq("id", existing.id);
      } else {
        const { data: ins } = await supabase.from("customers").insert({
          name: patch.customerName || "Walk-in", 
          phone: patch.customerPhone, 
          visits: 1, 
          last_visit: new Date().toISOString(),
        }).select("id").maybeSingle();
        nextCustomerId = ins?.id ?? null;
      }
      dbPatch.customer_id = nextCustomerId;
      dbPatch.customer_name = patch.customerName;
      dbPatch.customer_phone = patch.customerPhone;
    }

    if (Object.keys(dbPatch).length) {
      await supabase.from("sessions").update(dbPatch).eq("id", id);
      setSessions(prev => prev.map(x => x.id === id ? { 
        ...x, 
        ...patch, 
        ...(nextCustomerId !== undefined ? { customerId: nextCustomerId } : {})
      } : x));
    }
  }, [customers]);

  const markPaid = useCallback(async (id: string) => {
    await supabase.from("sessions").update({ payment: "paid" }).eq("id", id);
    setSessions(prev => prev.map(x => x.id === id ? { ...x, payment: "paid" } : x));
  }, []);

  const addUdhariTransaction: AppContextValue["addUdhariTransaction"] = useCallback(async (customerId, amount, type, notes) => {
    if (amount <= 0) return;
    const { data } = await supabase.from("customer_transactions").insert({
      customer_id: customerId, amount, type, notes, created_by: user?.id
    }).select("*").maybeSingle();

    if (data) {
      setCustomerTransactions(prev => [mapCustomerTransaction(data as DbCustomerTransaction), ...prev]);

      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        const newBalance = type === 'given' ? customer.balance + amount : customer.balance - amount;
        await supabase.from("customers").update({ balance: newBalance }).eq("id", customerId);
        setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, balance: newBalance } : c));
      }
    }
  }, [user, customers]);

  const deleteUdhariTransaction: AppContextValue["deleteUdhariTransaction"] = useCallback(async (txId) => {
    const tx = customerTransactions.find(t => t.id === txId);
    if (!tx) return;

    // revert customer balance
    const customer = customers.find(c => c.id === tx.customerId);
    if (customer) {
      const newBalance = tx.type === 'given' ? customer.balance - tx.amount : customer.balance + tx.amount;
      await supabase.from("customers").update({ balance: newBalance }).eq("id", customer.id);
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, balance: newBalance } : c));
    }

    await supabase.from("customer_transactions").delete().eq("id", txId);
    setCustomerTransactions(prev => prev.filter(t => t.id !== txId));

    // Revert associated session to unpaid if applicable
    const matchedSession = sessions.find(s =>
      s.customerId === tx.customerId &&
      Math.abs(new Date(s.endedAt || s.startedAt).getTime() - new Date(tx.createdAt).getTime()) < 60000 &&
      Math.abs(s.total - tx.amount) < 0.01 &&
      s.payment === "udhari"
    );
    if (matchedSession) {
      await supabase.from("sessions").update({ payment: "unpaid" }).eq("id", matchedSession.id);
      setSessions(prev => prev.map(s => s.id === matchedSession.id ? { ...s, payment: "unpaid" } : s));
    }
  }, [customerTransactions, customers, sessions]);

  const toggleUdhariAccess: AppContextValue["toggleUdhariAccess"] = useCallback(async (id, allow) => {
    await supabase.from("customers").update({ allow_credit: allow }).eq("id", id);
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, allowCredit: allow } : c));
  }, []);

  const markUdhari = useCallback(async (id: string) => {
    const s = sessions.find((x) => x.id === id);
    if (!s || s.total <= 0) return;
    await supabase.from("sessions").update({ payment: "udhari" }).eq("id", id);
    setSessions(prev => prev.map(x => x.id === id ? { ...x, payment: "udhari" } : x));
    if (s.customerId) {
      await addUdhariTransaction(s.customerId, s.total, "given", `Session at ${s.tableName}`);
    }
  }, [sessions, addUdhariTransaction]);

  const removeExtra: AppContextValue["removeExtra"] = useCallback(async (extraId) => {
    const s = sessions.find((x) => x.extras.some((e) => e.id === extraId));
    if (s) {
      const extra = s.extras.find((e) => e.id === extraId)!;

      const inv = inventory.find(i => i.name === extra.name);
      if (inv && inv.trackStock) {
        await supabase.from("inventory_items").update({ stock: inv.stock + extra.qty }).eq("id", inv.id);
        setInventory(prev => prev.map(i => i.id === inv.id ? { ...i, stock: i.stock + extra.qty } : i));
      }

      await supabase.from("session_extras").delete().eq("id", extraId);
      const newExtras = s.extras.filter((e) => e.id !== extraId);
      const newExtrasTotal = sumExtras(newExtras);
      let newTotal = s.total;
      if (s.status === "ended" || true) {
        newTotal = calcBill({
          durationMs: s.accumulatedMs, hourlyRate: s.hourlyRate,
          discount: s.discount, manualAdjustment: s.manualAdjustment,
          taxRate: s.taxRate, extrasTotal: newExtrasTotal,
        }).total;
      }

      await supabase.from("sessions").update({ extras_total: newExtrasTotal, total: newTotal }).eq("id", s.id);
      setSessions(prev => prev.map(x => x.id === s.id ? { ...x, extras: newExtras, extrasTotal: newExtrasTotal, total: newTotal } : x));
    }
  }, [sessions, inventory]);

  const updateExtraQty: AppContextValue["updateExtraQty"] = useCallback(async (extraId, delta) => {
    const s = sessions.find((x) => x.extras.some((e) => e.id === extraId));
    if (!s) return;
    const extra = s.extras.find((e) => e.id === extraId)!;
    const newQty = extra.qty + delta;

    if (newQty <= 0) {
      await removeExtra(extraId);
      return;
    }

    const inv = inventory.find(i => i.name === extra.name);
    if (inv?.trackStock) {
      if (delta > 0 && inv.stock < delta) {
        throw new Error(`Only ${inv.stock} ${inv.name} in stock`);
      }
      await supabase.from("inventory_items").update({ stock: inv.stock - delta }).eq("id", inv.id);
      setInventory(prev => prev.map(i => i.id === inv.id ? { ...i, stock: i.stock - delta } : i));
    }

    await supabase.from("session_extras").update({ qty: newQty }).eq("id", extraId);

    const newExtras = s.extras.map(e => e.id === extraId ? { ...e, qty: newQty } : e);
    const newExtrasTotal = sumExtras(newExtras);
    let newTotal = s.total;
    if (s.status === "ended" || true) {
      newTotal = calcBill({
        durationMs: s.accumulatedMs, hourlyRate: s.hourlyRate,
        discount: s.discount, manualAdjustment: s.manualAdjustment,
        taxRate: s.taxRate, extrasTotal: newExtrasTotal,
      }).total;
    }

    await supabase.from("sessions").update({ extras_total: newExtrasTotal, total: newTotal }).eq("id", s.id);
    setSessions(prev => prev.map(x => x.id === s.id ? { ...x, extras: newExtras, extrasTotal: newExtrasTotal, total: newTotal } : x));
  }, [sessions, inventory, removeExtra]);

  const addExtra: AppContextValue["addExtra"] = useCallback(async (sessionId, name, price, qty, inventoryId) => {
    const s = sessions.find((x) => x.id === sessionId);
    const existing = s?.extras.find(e => e.name === name && e.price === price);
    if (existing) {
      await updateExtraQty(existing.id, qty);
      return;
    }

    let category = "cafe";
    if (inventoryId) {
      const inv = inventory.find((i) => i.id === inventoryId);
      if (inv) category = inv.category;
      if (inv?.trackStock) {
        if (inv.stock < qty) { throw new Error(`Only ${inv.stock} ${inv.name} in stock`); }
        await supabase.from("inventory_items").update({ stock: inv.stock - qty }).eq("id", inventoryId);
        setInventory(prev => prev.map(i => i.id === inventoryId ? { ...i, stock: i.stock - qty } : i));
      }
    }
    const { data: ins } = await supabase.from("session_extras")
      .insert({ session_id: sessionId, name, price, qty, category }).select("*").maybeSingle();
    if (!ins) return;

    const newExtras = [...(s?.extras ?? []), mapExtra(ins as DbExtra)];
    const newExtrasTotal = sumExtras(newExtras);
    let newTotal = s ? s.total : 0;
    if (s && s.status === "ended") {
      newTotal = calcBill({
        durationMs: s.accumulatedMs, hourlyRate: s.hourlyRate,
        discount: s.discount, manualAdjustment: s.manualAdjustment,
        taxRate: s.taxRate, extrasTotal: newExtrasTotal,
      }).total;
    } else if (s) {
      newTotal = calcBill({
        durationMs: s.accumulatedMs, hourlyRate: s.hourlyRate,
        discount: s.discount, manualAdjustment: s.manualAdjustment,
        taxRate: s.taxRate, extrasTotal: newExtrasTotal,
      }).total;
    }

    await supabase.from("sessions").update({ extras_total: newExtrasTotal, total: newTotal }).eq("id", sessionId);
    setSessions(prev => prev.map(x => x.id === sessionId ? { ...x, extras: newExtras, extrasTotal: newExtrasTotal, total: newTotal } : x));
  }, [sessions, inventory, updateExtraQty]);

  const clearData = useCallback(async () => {
    await supabase.from("session_extras").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setSessions([]);
    setCustomers([]);
  }, []);

  const clearSessions = useCallback(async () => {
    await supabase.from("session_extras").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setSessions([]);
  }, []);

  const deleteSession: AppContextValue["deleteSession"] = useCallback(async (id) => {
    const s = sessions.find((x) => x.id === id);
    if (s && s.extras) {
      for (const extra of s.extras) {
        const inv = inventory.find(i => i.name === extra.name);
        if (inv && inv.trackStock) {
          await supabase.from("inventory_items").update({ stock: inv.stock + extra.qty }).eq("id", inv.id);
          setInventory(prev => prev.map(i => i.id === inv.id ? { ...i, stock: i.stock + extra.qty } : i));
        }
      }
    }
    await supabase.from("sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(x => x.id !== id));
  }, [sessions, inventory]);

  const createInventoryItem: AppContextValue["createInventoryItem"] = useCallback(async (item) => {
    const maxOrder = inventory.reduce((a, i) => Math.max(a, i.sortOrder), 0);
    const { data } = await supabase.from("inventory_items").insert({
      name: item.name, category: item.category, price: item.price,
      stock: item.stock, track_stock: item.trackStock, sort_order: maxOrder + 1,
    }).select().single();
    if (data) {
      setInventory(prev => [...prev, mapInventory(data as DbInventory)]);
    }
  }, [inventory]);
  const updateInventoryItem: AppContextValue["updateInventoryItem"] = useCallback(async (id, patch) => {
    const dbPatch: { name?: string; category?: string; price?: number; stock?: number; track_stock?: boolean } = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.price !== undefined) dbPatch.price = patch.price;
    if (patch.stock !== undefined) dbPatch.stock = patch.stock;
    if (patch.trackStock !== undefined) dbPatch.track_stock = patch.trackStock;
    await supabase.from("inventory_items").update(dbPatch).eq("id", id);
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);
  const deleteInventoryItem: AppContextValue["deleteInventoryItem"] = useCallback(async (id) => {
    await supabase.from("inventory_items").delete().eq("id", id);
    setInventory(prev => prev.filter(i => i.id !== id));
  }, []);

  const checkoutWalkIn: AppContextValue["checkoutWalkIn"] = useCallback(async (cart, customerName, customerPhone, payment = "paid", notes = "") => {
    let posTable = tables.find(t => t.name === "Walk-in POS");
    if (!posTable) {
      const maxOrder = tables.reduce((a, t) => Math.max(a, t.sortOrder ?? 0), 0);
      const { data } = await supabase.from("club_tables").insert({
        name: "Walk-in POS", type: "pool", sort_order: maxOrder + 1
      }).select().single();
      if (!data) throw new Error("Could not create POS table");
      posTable = { id: data.id, name: data.name, type: data.type as TableType, active: data.active, sortOrder: data.sort_order };
    }

    let customerId = null;
    if (customerPhone) {
      const existing = customers.find((c) => c.phone === customerPhone);
      if (existing) {
        await supabase.from("customers").update({
          name: customerName || existing.name,
          visits: existing.visits + 1,
          last_visit: new Date().toISOString(),
        }).eq("id", existing.id);
        customerId = existing.id;
      } else {
        const { data: ins } = await supabase.from("customers").insert({
          name: customerName || "Walk-in", phone: customerPhone, visits: 1, last_visit: new Date().toISOString(),
        }).select("id").maybeSingle();
        customerId = ins?.id ?? null;
      }
    }

    const now = new Date().toISOString();
    const extrasTotal = cart.reduce((a, b) => a + (b.price * b.qty), 0);
    const tax = extrasTotal * (settings.taxRate / 100);
    const total = extrasTotal + tax;

    const { data: created } = await supabase.from("sessions").insert({
      table_id: posTable.id,
      table_name: posTable.name,
      table_type: posTable.type,
      customer_id: customerId,
      customer_name: customerName || "Walk-in",
      customer_phone: customerPhone || "N/A",
      started_at: now,
      ended_at: now,
      accumulated_ms: 0,
      status: "ended",
      hourly_rate: 0,
      tax_rate: settings.taxRate,
      extras_total: extrasTotal,
      total: total,
      payment: payment || "paid",
      notes: notes.trim(),
    }).select().single();

    if (!created) throw new Error("Failed to create POS session");

    for (const item of cart) {
      let category = "cafe";
      if (item.inventoryId) {
        const inv = inventory.find(i => i.id === item.inventoryId);
        if (inv) category = inv.category;
        if (inv?.trackStock) {
          await supabase.from("inventory_items").update({ stock: inv.stock - item.qty }).eq("id", item.inventoryId);
        }
      }
      await supabase.from("session_extras").insert({
        session_id: created.id, name: item.name, price: item.price, qty: item.qty, category
      });
    }

    if (payment === "udhari" && customerId) {
      await addUdhariTransaction(customerId, total, "given", `Walk-in POS: ${cart.map(c => c.name).join(", ")}`);
    }

    await loadAll();
  }, [tables, customers, inventory, settings, loadAll, addUdhariTransaction]);

  const logPastSession: AppContextValue["logPastSession"] = useCallback(async ({ tableId, customerName, customerPhone, startedAt, endedAt, payment, notes, cart }) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) throw new Error("Table not found");

    let customerId = null;
    if (customerPhone || customerName) {
      const existing = customers.find((c) => c.phone === customerPhone || c.name === customerName);
      if (existing) {
        await supabase.from("customers").update({
          name: customerName || existing.name,
          phone: customerPhone || existing.phone,
          visits: existing.visits + 1,
          last_visit: new Date().toISOString(),
        }).eq("id", existing.id);
        customerId = existing.id;
      } else {
        const { data: ins } = await supabase.from("customers").insert({
          name: customerName || "Anonymous", phone: customerPhone || "N/A", visits: 1, last_visit: new Date().toISOString(),
        }).select("id").maybeSingle();
        customerId = ins?.id ?? null;
      }
    }

    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    if (durationMs < 0) throw new Error("End time must be after start time");

    const extrasTotal = cart.reduce((a, b) => a + (b.price * b.qty), 0);
    const rate = rateForType(table.type, settings);

    const { total } = calcBill({
      durationMs, hourlyRate: rate,
      discount: 0, manualAdjustment: 0,
      taxRate: settings.taxRate, extrasTotal,
    });

    const { data: created } = await supabase.from("sessions").insert({
      table_id: table.id,
      table_name: table.name,
      table_type: table.type,
      customer_id: customerId,
      customer_name: customerName || "Anonymous",
      customer_phone: customerPhone || "N/A",
      started_at: startedAt,
      ended_at: endedAt,
      accumulated_ms: durationMs,
      run_started_at: null,
      status: "ended",
      hourly_rate: rate,
      discount: 0,
      manual_adjustment: 0,
      tax_rate: settings.taxRate,
      extras_total: extrasTotal,
      total: total,
      payment: payment,
      notes: notes?.trim() || "",
    }).select().single();

    if (!created) throw new Error("Failed to create manual session");

    for (const item of cart) {
      let category = "cafe";
      if (item.inventoryId) {
        const inv = inventory.find(i => i.id === item.inventoryId);
        if (inv) category = inv.category;
        if (inv?.trackStock) {
          await supabase.from("inventory_items").update({ stock: inv.stock - item.qty }).eq("id", item.inventoryId);
        }
      }
      await supabase.from("session_extras").insert({
        session_id: created.id, name: item.name, price: item.price, qty: item.qty, category
      });
    }

    if (payment === "udhari" && customerId) {
      await addUdhariTransaction(customerId, total, "given", `Logged Session at ${table.name}`);
    }

    await loadAll();
  }, [tables, customers, inventory, settings, loadAll, addUdhariTransaction]);

  const addExpense: AppContextValue["addExpense"] = useCallback(async (amount, category, description) => {
    const { data } = await supabase.from("expenses").insert({ amount, category, description, created_by: user?.id }).select("*").maybeSingle();
    if (data) {
      setExpenses(prev => [mapExpense(data as DbExpense), ...prev]);
    }
  }, [user]);

  const updateExpense: AppContextValue["updateExpense"] = useCallback(async (id, patch) => {
    if (Object.keys(patch).length > 0) {
      await supabase.from("expenses").update(patch).eq("id", id);
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    }
  }, []);

  const deleteExpense: AppContextValue["deleteExpense"] = useCallback(async (id) => {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, []);

  const value = useMemo<AppContextValue>(
    () => {
      const dynamicCustomers = customers.map(c => ({
        ...c,
        balance: sessions.filter(s => s.customerId === c.id && s.payment === "udhari").reduce((acc, s) => acc + s.total, 0)
      }));

      return {
        user, authLoading, loading, tables, customers: dynamicCustomers, sessions, settings, inventory, expenses, customerTransactions, dismissedSessions,
        signIn, signUp, logout, updateSettings,
        startSession, pauseSession, resumeSession, endSession, updateSession, markPaid, markUdhari, toggleUdhariAccess, addUdhariTransaction, deleteUdhariTransaction, dismissSession,
        addExtra, removeExtra, updateExtraQty, addExpense, updateExpense, deleteExpense, createTable, updateTable, deleteTable,
        createInventoryItem, updateInventoryItem, deleteInventoryItem, clearData, clearSessions, deleteSession, checkoutWalkIn, logPastSession,
      };
    },
    [user, authLoading, loading, tables, customers, sessions, settings, inventory, expenses, customerTransactions, dismissedSessions,
      signIn, signUp, logout, updateSettings,
      startSession, pauseSession, resumeSession, endSession, updateSession, markPaid, markUdhari, toggleUdhariAccess, addUdhariTransaction, deleteUdhariTransaction, dismissSession,
      addExtra, removeExtra, updateExtraQty, addExpense, updateExpense, deleteExpense, createTable, updateTable, deleteTable,
      createInventoryItem, updateInventoryItem, deleteInventoryItem, clearData, clearSessions, deleteSession, checkoutWalkIn, logPastSession],
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
