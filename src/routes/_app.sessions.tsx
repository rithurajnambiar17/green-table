import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, Fragment } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import type { Session } from "@/lib/types";
import { formatCurrency, formatDuration } from "@/lib/format";
import { MessageCircle, Download, Trash2, CheckCircle2, BookText, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { ExtrasManager } from "@/components/ExtrasManager";
import { MarkPaidDialog } from "@/components/MarkPaidDialog";

export const Route = createFileRoute("/_app/sessions")({
  head: () => ({ meta: [{ title: "Sessions — Green Table" }] }),
  component: SessionsPage,
});

function SessionsPage() {
  const { sessions, settings, markPaid, markUdhari, customers } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid" | "live">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewSession, setViewSession] = useState<Session | null>(null);
  const activeSession = viewSession ? sessions.find(s => s.id === viewSession.id) || viewSession : null;
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);

  const [viewGroup, setViewGroup] = useState<Session[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const filtered = useMemo(() => {
    const result = sessions
      .filter((s) => {
        if (filter === "paid") return s.payment === "paid";
        if (filter === "unpaid") return s.payment === "unpaid" && s.status === "ended";
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
      });

    const groupedMap = new Map<string, Session & { subSessions?: Session[] }>();
    const finalResult: (Session & { subSessions?: Session[] })[] = [];

    for (const s of result) {
      if (s.payment === "unpaid" && s.status === "ended") {
        const key = `${s.customerPhone.trim()}-${s.customerName.trim().toLowerCase()}`;
        if (groupedMap.has(key)) {
          const existing = groupedMap.get(key)!;
          existing.id = `${existing.id},${s.id}`;
          const tables = new Set(existing.tableName.split(', '));
          tables.add(s.tableName);
          existing.tableName = Array.from(tables).join(', ');
          existing.accumulatedMs += s.accumulatedMs;
          existing.extrasTotal += s.extrasTotal;
          existing.total += s.total;

          existing.extras = [...existing.extras, ...s.extras];

          if (new Date(s.startedAt) < new Date(existing.startedAt)) {
            existing.startedAt = s.startedAt;
          }
          if (s.endedAt && (!existing.endedAt || new Date(s.endedAt) > new Date(existing.endedAt))) {
            existing.endedAt = s.endedAt;
          }
          if (s.notes) {
            existing.notes = existing.notes ? `${existing.notes}\n${s.notes}` : s.notes;
          }
          if (!existing.subSessions) existing.subSessions = [];
          existing.subSessions.push(s);
        } else {
          groupedMap.set(key, { ...s, extras: [...s.extras], subSessions: [s] });
        }
      } else {
        finalResult.push(s);
      }
    }

    for (const gs of groupedMap.values()) {
      if (gs.subSessions && gs.subSessions.length > 1) {
        finalResult.push(gs);
      } else {
        finalResult.push(gs.subSessions ? gs.subSessions[0] : gs);
      }
    }

    return finalResult.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions, q, filter, startDate, endDate]);

  // Reset to first page on filter change
  useMemo(() => setCurrentPage(1), [q, filter, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No sessions to export");
      return;
    }
    const headers = ["Player", "Phone", "Table", "Type", "Started At", "Ended At", "Duration (mins)", "Status", "Payment", "Extras Cost", "Total", "Items"];
    const allToExport = filtered.flatMap((s: Session & { subSessions?: Session[] }) =>
      (s.subSessions && s.subSessions.length > 1) ? s.subSessions : [s]
    );
    const rows = allToExport.map(s => {
      const itemsStr = s.extras && s.extras.length > 0
        ? s.extras.map(e => `${e.name} (x${e.qty})`).join(" | ")
        : "-";
      return [
        s.customerName,
        s.customerPhone,
        s.tableName,
        s.tableType,
        new Date(s.startedAt).toLocaleString(),
        s.endedAt ? new Date(s.endedAt).toLocaleString() : "",
        Math.floor(s.accumulatedMs / 60000),
        s.status,
        s.payment,
        s.extrasTotal || 0,
        s.total,
        itemsStr
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sessions_statement_${new Date().toISOString().slice(0, 10)}.csv`;
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
      const ids = id.split(',');
      for (const singleId of ids) {
        await deleteSession(singleId);
      }
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
          {/* {isAdmin && (
            <Button variant="destructive" onClick={handleClear} className="gap-2">
              <Trash2 className="h-4 w-4" /> Clear All Data
            </Button>
          )} */}
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
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-muted/20 rounded-md px-3 py-2 border border-border/60 text-xs">
          <span className="text-muted-foreground">
            Showing <span className="font-medium text-foreground">{(currentPage - 1) * pageSize + 1}</span>-
            <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, filtered.length)}</span> of{" "}
            <span className="font-medium text-foreground">{filtered.length}</span> sessions
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <span className="text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

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
              {paginatedSessions.map((s: Session & { subSessions?: Session[] }) => {
                const isGroup = s.subSessions && s.subSessions.length > 1;

                return (
                  <Fragment key={s.id}>
                    <tr
                      className={`transition-colors hover:bg-muted/30 cursor-pointer ${isGroup ? 'bg-muted/10' : ''}`}
                      onClick={() => isGroup ? setViewGroup(s.subSessions!) : setViewSession(s)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">{s.customerName} {isGroup && <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1">{s.subSessions!.length} Sessions</Badge>}</div>
                            <div className="text-xs text-muted-foreground">{settings.countryCode} {s.customerPhone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{s.tableName}</div>
                        <div className="text-xs text-muted-foreground capitalize">{isGroup ? "Multiple" : s.tableType}</div>
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
                  </Fragment>
                );
              })}
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
            <DialogDescription className="sr-only">Details for the selected session.</DialogDescription>
          </DialogHeader>
          {activeSession && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 border-b border-border/60 pb-3">
                <div><span className="text-muted-foreground block text-xs uppercase">Player</span> <span className="font-medium">{activeSession.customerName}</span></div>
                <div><span className="text-muted-foreground block text-xs uppercase">Table</span> <span className="font-medium">{activeSession.tableName}</span></div>
              </div>

              <div>
                <p className="text-xs uppercase text-muted-foreground mb-2">Items Purchased</p>
                {activeSession.payment === "unpaid" && activeSession.status === "ended" ? (
                  <ExtrasManager session={activeSession} compact={false} />
                ) : activeSession.extras.length > 0 ? (
                  <ul className="space-y-1">
                    {activeSession.extras.map(e => (
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
                {activeSession.hourlyRate > 0 && activeSession.accumulatedMs > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Table Time ({formatDuration(activeSession.accumulatedMs)})</span>
                    <span>{formatCurrency(activeSession.total - activeSession.extrasTotal - activeSession.taxRate, settings.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-display text-lg pt-1">
                  <span>Total</span>
                  <span className="text-neon">{formatCurrency(activeSession.total, settings.currency)}</span>
                </div>
              </div>

              {activeSession.notes && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs uppercase text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{activeSession.notes}</p>
                </div>
              )}

              <div className="pt-4 border-t border-border/60 flex flex-wrap justify-end gap-3">
                {activeSession.payment === "unpaid" && activeSession.status === "ended" && (
                  <>
                    {(() => {
                      const c = customers.find((x) => x.id === activeSession.customerId);
                      if (c?.allowCredit) {
                        return (
                          <Button
                            className="gap-2 border-warning/50 text-warning hover:bg-warning/10"
                            variant="outline"
                            onClick={async () => {
                              const ids = activeSession.id.split(',');
                              for (const id of ids) {
                                await markUdhari(id);
                              }
                              toast.success("Added to Udhari ledger.");
                              setViewSession(null);
                            }}
                          >
                            <BookText className="h-4 w-4" /> Put on Credit
                          </Button>
                        );
                      }
                      return null;
                    })()}
                    <Button
                      className="gap-2 bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => setShowMarkPaidDialog(true)}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Mark Paid
                    </Button>
                  </>
                )}
                {isAdmin && (
                  <Button variant="destructive" onClick={() => handleDeleteSession(activeSession.id)} className="gap-2">
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Grouped Sessions Dialog */}
      <Dialog open={!!viewGroup} onOpenChange={(open) => !open && setViewGroup(null)}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Unpaid Sessions — {viewGroup ? viewGroup[0].customerName : ""}</DialogTitle>
            <DialogDescription className="sr-only">List of unpaid sessions for this customer</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-3 pr-2 flex-1">
            {viewGroup?.map((session) => (
              <div
                key={session.id}
                className="flex flex-col p-4 rounded-lg bg-muted/30 border border-border/40 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setViewSession(session);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-sm font-medium flex items-center gap-2">
                      {session.tableName}
                      <Badge variant="outline" className="text-xs uppercase">{session.tableType}</Badge>
                    </span>
                    <span className="text-xs text-muted-foreground mt-1 block">{new Date(session.startedAt).toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-destructive block">
                      {formatCurrency(session.total, settings.currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDuration(session.accumulatedMs)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <MarkPaidDialog
        session={activeSession}
        open={showMarkPaidDialog}
        onOpenChange={setShowMarkPaidDialog}
        onSuccess={(note) => {
          if (activeSession) {
            setViewSession({ ...activeSession, payment: "paid", notes: note });
          }
        }}
      />
    </div>
  );
}
