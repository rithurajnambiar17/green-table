import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { TableCard } from "@/components/TableCard";
import { StartSessionDialog } from "@/components/StartSessionDialog";
import { EditSessionDialog } from "@/components/EditSessionDialog";
import type { ClubTable, Session } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Activity, Wallet, Users, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Live Tables — Green Table" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { tables, sessions, settings } = useApp();
  const [startFor, setStartFor] = useState<ClubTable | null>(null);
  const [editFor, setEditFor] = useState<Session | null>(null);

  const activeByTable = new Map<string, Session>();
  for (const s of sessions) {
    if (s.status === "running" || s.status === "paused" || (s.status === "ended" && s.payment === "unpaid")) {
      if (!activeByTable.has(s.tableId)) activeByTable.set(s.tableId, s);
    }
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const today = sessions.filter((s) => s.endedAt && new Date(s.endedAt) >= todayStart);
  const todayRevenue = today.filter((s) => s.payment === "paid").reduce((a, b) => a + b.total, 0);
  const liveCount = sessions.filter((s) => s.status === "running" || s.status === "paused").length;
  const customersToday = new Set(today.map((s) => s.customerId)).size;

  const stats = [
    { label: "Live Sessions", value: String(liveCount), icon: Activity, accent: true },
    { label: "Today's Revenue", value: formatCurrency(todayRevenue, settings.currency), icon: Wallet },
    { label: "Players Today", value: String(customersToday), icon: Users },
    { label: "Sessions Today", value: String(today.length), icon: Trophy },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Live floor</p>
          <h1 className="font-display text-3xl md:text-4xl">Tables Overview</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {tables.length} tables · {tables.filter(t => t.type === "snooker").length} Royal Snooker · {tables.filter(t => t.type === "pool").length} Mini Pool
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="glass relative overflow-hidden p-5">
              {s.accent && (
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <Icon className={["h-4 w-4", s.accent ? "text-neon" : "text-muted-foreground"].join(" ")} />
              </div>
              <p className="mt-3 font-display text-3xl tabular-nums">{s.value}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => (
          <TableCard
            key={t.id}
            table={t}
            session={activeByTable.get(t.id)}
            onStart={() => setStartFor(t)}
            onEdit={(s) => setEditFor(s)}
          />
        ))}
      </div>

      <StartSessionDialog table={startFor} open={!!startFor} onOpenChange={(o) => !o && setStartFor(null)} />
      <EditSessionDialog session={editFor} open={!!editFor} onOpenChange={(o) => !o && setEditFor(null)} />
    </div>
  );
}
