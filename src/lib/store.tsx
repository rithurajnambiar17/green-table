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
}

interface AppContextValue extends AppState {
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
  startSession: (input: { tableId: string; customerName: string; customerPhone: string }) => Promise<Session | null>;
  pauseSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;
  endSession: (sessionId: string) => Promise<Session | undefined>;
  updateSession: (sessionId: string, patch: Partial<Session>) => Promise<void>;
  markPaid: (sessionId: string) => Promise<void>;
  addExtra: (sessionId: string, name: string, price: number, qty: number, inventoryId?: string) => Promise<void>;
  removeExtra: (extraId: string) => Promise<void>;
  createTable: (name: string, type: TableType) => Promise<void>;
  updateTable: (id: string, patch: Partial<ClubTable>) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  createInventoryItem: (item: Omit<InventoryItem, "id" | "sortOrder">) => Promise<void>;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  clearData: () => Promise<void>;
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
type DbCustomer = { id: string; name: string; phone: string; visits: number; last_visit: string | null };
type DbExtra = { id: string; session_id: string; name: string; price: number; qty: number; created_at: string };
type DbSession = {
  id: string; table_id: string; table_name: string; table_type: string;
  customer_id: string | null; customer_name: string; customer_phone: string;
  started_at: string; ended_at: string | null;
  accumulated_ms: number; run_started_at: string | null; status: string;
  hourly_rate: number; discount: number; manual_adjustment: number; tax_rate: number;
  extras_total: number; total: number; payment: string;
};
type DbSettings = { id: number; club_name: string; currency: string; snooker_rate: number; mini_snooker_rate: number | null; pool_rate: number; tax_rate: number; country_code: string };
type DbInventory = { id: string; name: string; category: string; price: number; stock: number; track_stock: boolean; sort_order: number };

const mapTable = (r: DbTable): ClubTable => ({ id: r.id, name: r.name, type: r.type as TableType, active: r.active, sortOrder: r.sort_order });
const mapCustomer = (r: DbCustomer): Customer => ({ id: r.id, name: r.name, phone: r.phone, visits: r.visits, lastVisit: r.last_visit });
const mapExtra = (r: DbExtra): SessionExtra => ({ id: r.id, sessionId: r.session_id, name: r.name, price: Number(r.price), qty: r.qty, createdAt: r.created_at });
const mapSession = (r: DbSession, extras: SessionExtra[]): Session => ({
  id: r.id, tableId: r.table_id, tableName: r.table_name, tableType: r.table_type as TableType,
  customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone,
  startedAt: r.started_at, endedAt: r.ended_at,
  accumulatedMs: Number(r.accumulated_ms), runStartedAt: r.run_started_at, status: r.status as Session["status"],
  hourlyRate: Number(r.hourly_rate), discount: Number(r.discount), manualAdjustment: Number(r.manual_adjustment),
  taxRate: Number(r.tax_rate), extrasTotal: Number(r.extras_total), total: Number(r.total),
  payment: r.payment as Session["payment"], extras,
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

export function rateForType(t: TableType, s: Settings): number {
  if (t === "snooker") return s.snookerRate;
  if (t === "mini_snooker") return s.miniSnookerRate;
  return s.poolRate;
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


  // Fetch settings globally on mount so unauthenticated pages (like login) have access
  useEffect(() => {
    supabase.from("settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(mapSettings(data as DbSettings));
    });
  }, []);

  // ============ Auth ============
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
        // defer to avoid deadlock per supabase guidance
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

  // ============ Data loaders ============
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tablesRes, customersRes, sessionsRes, extrasRes, settingsRes, inventoryRes] = await Promise.all([
      supabase.from("club_tables").select("*").order("sort_order"),
      supabase.from("customers").select("*").order("last_visit", { ascending: false, nullsFirst: false }),
      supabase.from("sessions").select("*").order("started_at", { ascending: false }).limit(500),
      supabase.from("session_extras").select("*"),
      supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("inventory_items").select("*").order("sort_order"),
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
    setLoading(false);
  }, []);

  // load + realtime when signed in
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
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, loadAll]);

  // ============ Auth API ============
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

  // ============ Settings ============
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

  // ============ Tables ============
  const createTable: AppContextValue["createTable"] = useCallback(async (name, type) => {
    const maxOrder = tables.reduce((a, t) => Math.max(a, t.sortOrder ?? 0), 0);
    await supabase.from("club_tables").insert({ name, type, sort_order: maxOrder + 1 });
  }, [tables]);
  const updateTable: AppContextValue["updateTable"] = useCallback(async (id, patch) => {
    const dbPatch: { name?: string; type?: string; active?: boolean } = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.type !== undefined) dbPatch.type = patch.type;
    if (patch.active !== undefined) dbPatch.active = patch.active;
    await supabase.from("club_tables").update(dbPatch).eq("id", id);
  }, []);
  const deleteTable: AppContextValue["deleteTable"] = useCallback(async (id) => {
    await supabase.from("club_tables").delete().eq("id", id);
  }, []);

  // ============ Sessions ============
  const startSession: AppContextValue["startSession"] = useCallback(async ({ tableId, customerName, customerPhone }) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;
    const rate = rateForType(table.type, settings);

    // upsert customer
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
    const dbPatch: { hourly_rate?: number; discount?: number; manual_adjustment?: number; tax_rate?: number } = {};
    if (patch.hourlyRate !== undefined) dbPatch.hourly_rate = patch.hourlyRate;
    if (patch.discount !== undefined) dbPatch.discount = patch.discount;
    if (patch.manualAdjustment !== undefined) dbPatch.manual_adjustment = patch.manualAdjustment;
    if (patch.taxRate !== undefined) dbPatch.tax_rate = patch.taxRate;
    if (Object.keys(dbPatch).length) {
      await supabase.from("sessions").update(dbPatch).eq("id", id);
      setSessions(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
    }
  }, []);

  const markPaid = useCallback(async (id: string) => {
    await supabase.from("sessions").update({ payment: "paid" }).eq("id", id);
    setSessions(prev => prev.map(x => x.id === id ? { ...x, payment: "paid" } : x));
  }, []);

  // ============ Extras ============
  const addExtra: AppContextValue["addExtra"] = useCallback(async (sessionId, name, price, qty, inventoryId) => {
    // If tied to an inventory item, decrement stock (if tracked)
    if (inventoryId) {
      const inv = inventory.find((i) => i.id === inventoryId);
      if (inv?.trackStock) {
        if (inv.stock < qty) { throw new Error(`Only ${inv.stock} ${inv.name} in stock`); }
        await supabase.from("inventory_items").update({ stock: inv.stock - qty }).eq("id", inventoryId);
        setInventory(prev => prev.map(i => i.id === inventoryId ? { ...i, stock: i.stock - qty } : i));
      }
    }
    const { data: ins } = await supabase.from("session_extras")
      .insert({ session_id: sessionId, name, price, qty }).select("*").maybeSingle();
    if (!ins) return;
    const s = sessions.find((x) => x.id === sessionId);
    const newExtras = [...(s?.extras ?? []), mapExtra(ins as DbExtra)];
    const newExtrasTotal = sumExtras(newExtras);
    await supabase.from("sessions").update({ extras_total: newExtrasTotal }).eq("id", sessionId);
    setSessions(prev => prev.map(x => x.id === sessionId ? { ...x, extras: newExtras, extrasTotal: newExtrasTotal } : x));
  }, [sessions, inventory]);

  const removeExtra: AppContextValue["removeExtra"] = useCallback(async (extraId) => {
    const s = sessions.find((x) => x.extras.some((e) => e.id === extraId));
    await supabase.from("session_extras").delete().eq("id", extraId);
    if (s) {
      const newExtras = s.extras.filter((e) => e.id !== extraId);
      const newExtrasTotal = sumExtras(newExtras);
      await supabase.from("sessions").update({ extras_total: newExtrasTotal }).eq("id", s.id);
      setSessions(prev => prev.map(x => x.id === s.id ? { ...x, extras: newExtras, extrasTotal: newExtrasTotal } : x));
    }
  }, [sessions]);

  // ============ Clear All Data ============
  const clearData = useCallback(async () => {
    // Delete in order: session_extras cascade with sessions, then customers
    await supabase.from("session_extras").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setSessions([]);
    setCustomers([]);
  }, []);

  // ============ Inventory ============
  const createInventoryItem: AppContextValue["createInventoryItem"] = useCallback(async (item) => {
    const maxOrder = inventory.reduce((a, i) => Math.max(a, i.sortOrder), 0);
    await supabase.from("inventory_items").insert({
      name: item.name, category: item.category, price: item.price,
      stock: item.stock, track_stock: item.trackStock, sort_order: maxOrder + 1,
    });
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

  const value = useMemo<AppContextValue>(
    () => ({
      user, authLoading, loading, tables, customers, sessions, settings, inventory,
      signIn, signUp, logout, updateSettings,
      startSession, pauseSession, resumeSession, endSession, updateSession, markPaid,
      addExtra, removeExtra, createTable, updateTable, deleteTable,
      createInventoryItem, updateInventoryItem, deleteInventoryItem, clearData,
    }),
    [user, authLoading, loading, tables, customers, sessions, settings, inventory,
     signIn, signUp, logout, updateSettings,
     startSession, pauseSession, resumeSession, endSession, updateSession, markPaid,
     addExtra, removeExtra, createTable, updateTable, deleteTable,
     createInventoryItem, updateInventoryItem, deleteInventoryItem, clearData],
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
