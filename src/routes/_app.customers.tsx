import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Green Table" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const { customers, sessions, settings } = useApp();
  const [q, setQ] = useState("");

  // derived stats from sessions
  const enriched = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; visits: number; spend: number; last: string | null; id: string }>();
    for (const c of customers) {
      map.set(c.id, { id: c.id, name: c.name, phone: c.phone, visits: 0, spend: 0, last: null });
    }
    for (const s of sessions) {
      const key = s.customerId;
      const existing = map.get(key) ?? { id: key, name: s.customerName, phone: s.customerPhone, visits: 0, spend: 0, last: null };
      existing.visits += 1;
      if (s.payment === "paid") existing.spend += s.total;
      if (!existing.last || new Date(s.startedAt) > new Date(existing.last)) existing.last = s.startedAt;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [customers, sessions]);

  const filtered = enriched.filter((c) => {
    const t = q.toLowerCase().trim();
    if (!t) return true;
    return c.name.toLowerCase().includes(t) || c.phone.includes(t);
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">CRM</p>
        <h1 className="font-display text-3xl md:text-4xl">Customers</h1>
      </header>

      <div className="flex items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…" className="max-w-sm" />
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} customers</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c, i) => {
          const tier = c.visits >= 8 ? "VIP" : c.visits >= 3 ? "Regular" : "New";
          const color =
            tier === "VIP" ? "bg-gold text-primary-foreground"
            : tier === "Regular" ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground";
          return (
            <Card key={c.id} className="glass p-5 hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-accent font-display text-lg">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium leading-tight">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{settings.countryCode} {c.phone}</p>
                  </div>
                </div>
                <Badge className={color}>{tier}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/40 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Visits</p>
                  <p className="font-display text-lg">{c.visits}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Spend</p>
                  <p className="font-display text-lg">{formatCurrency(c.spend, settings.currency)}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rank</p>
                  <p className="font-display text-lg">#{i + 1}</p>
                </div>
              </div>
              {c.last && (
                <p className="mt-3 text-xs text-muted-foreground">Last visit · {new Date(c.last).toLocaleDateString()}</p>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="glass p-10 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
            No customers yet. Start a session to add your first player.
          </Card>
        )}
      </div>
    </div>
  );
}
