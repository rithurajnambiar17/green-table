import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDuration, thankYouMessage, waLink } from "@/lib/format";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_app/sessions")({
  head: () => ({ meta: [{ title: "Sessions — Green Table" }] }),
  component: SessionsPage,
});

function SessionsPage() {
  const { sessions, settings } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid" | "live">("all");

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
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions, q, filter]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">History</p>
        <h1 className="font-display text-3xl md:text-4xl">Sessions</h1>
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
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} sessions</span>
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
                <tr key={s.id} className="transition-colors hover:bg-muted/30">
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
                    {s.payment === "paid" && (
                      <a
                        className="inline-flex items-center gap-1 text-xs text-neon hover:underline"
                        target="_blank"
                        rel="noreferrer"
                        href={waLink(s.customerPhone, settings.countryCode, thankYouMessage(settings.clubName, s.customerName, s.total, settings.currency))}
                      >
                        <MessageCircle className="h-3 w-3" /> Resend
                      </a>
                    )}
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
    </div>
  );
}
