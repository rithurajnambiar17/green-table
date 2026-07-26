import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { TableCard } from "@/components/TableCard";
import { StartSessionDialog } from "@/components/StartSessionDialog";
import { EditSessionDialog } from "@/components/EditSessionDialog";
import type { ClubTable, Session } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { WalkInPOSDialog } from "@/components/WalkInPOSDialog";
import { LogPastSessionDialog } from "@/components/LogPastSessionDialog";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Live Tables — Green Table" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { tables, sessions, settings, dismissedSessions } = useApp();
  const [startFor, setStartFor] = useState<ClubTable | null>(null);
  const [editFor, setEditFor] = useState<Session | null>(null);

  const activeByTable = new Map<string, Session>();
  for (const s of sessions) {
    if (s.status === "running" || s.status === "paused" || (s.status === "ended" && s.payment === "unpaid" && !dismissedSessions.includes(s.id))) {
      if (!activeByTable.has(s.tableId)) activeByTable.set(s.tableId, s);
    }
  }



  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Live floor</p>
          <h1 className="font-display text-3xl md:text-4xl">Tables Overview</h1>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {tables.length} tables · {tables.filter(t => t.type === "snooker").length} Royal Snooker · {tables.filter(t => t.type === "pool").length} Mini Pool
          </p>
          <LogPastSessionDialog />
          <WalkInPOSDialog />
        </div>
      </header>



      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {tables.filter(t => t.name !== "Walk-in POS").map((t) => (
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
