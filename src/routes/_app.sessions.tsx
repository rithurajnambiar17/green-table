import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Session } from "@/lib/types";
import { formatCurrency, formatDuration } from "@/lib/format";
import { MessageCircle, Download, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/sessions")({
  head: () => ({ meta: [{ title: "Sessions — Green Table" }] }),
  component: SessionsPage,
});

function SessionsPage() {
  const { sessions, settings, markPaid } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid" | "live">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewSession, setViewSession] = useState<Session | null>(null);

  const filtered = useMemo(() => {
    return sessions
      .filter((s) => {
        if (filter === "paid") return s.payment === "paid";
        if (filter === "unpaid") return s.payment === "unpaid";
        if (filter === "live") return s.status === "running" || s.status === "paused";
        return true;
      })
      .filter((s) => {
        const term = q.trim().toLowerCase();
        if (!term) return true;
        return (
          s.customerName.toLowerCase().includes(term) ||
          s.customerPhone.includes(term) ||
          s.tableName.toLowerCase().includes(term)
        );
      })
      .filter((s) => {
        if (!s.endedAt) return true;
        const dateToCheck = s.endedAt || s.startedAt;
        if (startDate) {
          const start = new Date(`${startDate}T00:00:00`);
          if (new Date(dateToCheck) < start) return false;
        }
        if (endDate) {
          const end = new Date(`${endDate}T23:59:59.999`);
          if (new Date(dateToCheck) > end) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions, q, filter, startDate, endDate]);

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No sessions to export");
      return;
    }
    const headers = ["Player", "Phone", "Table", "Type", "Started At", "Ended At", "Duration (mins)", "Status", "Payment", "Total"];
    const rows = filtered.map(s => [
      s.customerName,
      s.customerPhone,
      s.tableName,
      s.tableType,
      new Date(s.startedAt).toLocaleString(),
      s.endedAt ? new Date(s.endedAt).toLocaleString() : "",
      Math.floor(s.accumulatedMs / 60000),
      s.status,
      s.payment,
      s.total
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sessions_statement_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const { clearSessions, deleteSession, user } = useApp();
  const isAdmin = user?.role === "admin";
  const handleClear = async () => {
    if (!isAdmin) {
      toast.error("Only admins can clear data");
      return;
    }
    if (confirm("Are you sure you want to delete ALL session history? This action is irreversible.")) {
      await clearSessions();
      toast.success("All session data cleared.");
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!isAdmin) {
      toast.error("Only admins can delete sessions");
      return;
    }
    if (confirm("Are you sure you want to delete this session?")) {
      await deleteSession(id);
      toast.success("Session deleted.");
      setViewSession(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">History</p>
          <h1 className="font-display text-3xl md:text-4xl">Sessions</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Export Statement
          </Button>
          {isAdmin && (
            <Button variant="destructive" onClick={handleClear} className="gap-2">
              <Trash2 className="h-4 w-4" /> Clear All Data
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by player, phone, table…"
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "live", "unpaid", "paid"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-auto text-sm" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-auto text-sm" />
          {(startDate || endDate) && (
            <button className="text-xs text-muted-foreground hover:text-foreground ml-2" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} sessions</span>
      </div>

      <Card className="glass overflow-hidden p-0">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((s) => (
                <tr 
                  key={s.id} 
                  className="transition-colors hover:bg-muted/30 cursor-pointer"
                  onClick={() => setViewSession(s)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.customerName}</div>
                    <div className="text-xs text-muted-foreground">{settings.countryCode} {s.customerPhone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{s.tableName}</div>
                    <div className="text-xs text-muted-foreground capitalize">{s.tableType}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatDuration(s.accumulatedMs)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        s.status === "running" ? "bg-primary text-primary-foreground"
                        : s.status === "paused" ? "bg-warning text-warning-foreground"
                        : s.payment === "paid" ? "bg-success text-success-foreground"
                        : "bg-destructive text-destructive-foreground"
                      }
                    >
                      {s.status === "ended" ? (s.payment === "paid" ? "Paid" : "Unpaid") : s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-display tabular-nums">
                    {formatCurrency(s.total, settings.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {isAdmin && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(s.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No sessions found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!viewSession} onOpenChange={(open) => !open && setViewSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
          </DialogHeader>
          {viewSession && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 border-b border-border/60 pb-3">
                <div><span className="text-muted-foreground block text-xs uppercase">Player</span> <span className="font-medium">{viewSession.customerName}</span></div>
                <div><span className="text-muted-foreground block text-xs uppercase">Table</span> <span className="font-medium">{viewSession.tableName}</span></div>
              </div>
              
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-2">Items Purchased</p>
                {viewSession.extras.length > 0 ? (
                  <ul className="space-y-1">
                    {viewSession.extras.map(e => (
                      <li key={e.id} className="flex justify-between">
                        <span>{e.name} <span className="text-muted-foreground ml-1">× {e.qty}</span></span>
                        <span>{formatCurrency(e.price * e.qty, settings.currency)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground italic">No items taken.</p>
                )}
              </div>

              <div className="pt-3 border-t border-border/60 flex flex-col gap-1">
                {viewSession.hourlyRate > 0 && viewSession.accumulatedMs > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Table Time ({formatDuration(viewSession.accumulatedMs)})</span>
                    <span>{formatCurrency(viewSession.total - viewSession.extrasTotal - viewSession.taxRate, settings.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-display text-lg pt-1">
                  <span>Total</span>
                  <span className="text-neon">{formatCurrency(viewSession.total, settings.currency)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border/60 flex flex-wrap justify-end gap-3">
                {viewSession.payment === "unpaid" && viewSession.status === "ended" && (
                  <Button
                    className="gap-2 bg-success text-success-foreground hover:bg-success/90"
                    onClick={async () => {
                      await markPaid(viewSession.id);
                      toast.success("Session marked as paid.");
                      setViewSession({ ...viewSession, payment: "paid" });
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark Paid
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="destructive" onClick={() => handleDeleteSession(viewSession.id)} className="gap-2">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
