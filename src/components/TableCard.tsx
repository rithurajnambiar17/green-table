import { useMemo, useState } from "react";
import {
  Play, Pause, Square, CheckCircle2, Pencil, CircleDollarSign,
  MessageCircle, Coffee, ChevronDown, ChevronUp,
} from "lucide-react";
import { sessionElapsedMs, useApp } from "@/lib/store";
import type { ClubTable, Session } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { calcBill, formatCurrency, formatDuration, sumExtras, thankYouMessage, waLink } from "@/lib/format";
import { toast } from "sonner";
import { ExtrasManager } from "./ExtrasManager";
import { useMounted } from "@/hooks/use-mounted";

interface Props {
  table: ClubTable;
  session?: Session;
  onStart: () => void;
  onEdit: (s: Session) => void;
}

export function TableCard({ table, session, onStart, onEdit }: Props) {
  const { pauseSession, resumeSession, endSession, markPaid, settings } = useApp();
  const mounted = useMounted();
  const [showExtras, setShowExtras] = useState(false);

  const elapsed = session && mounted ? sessionElapsedMs(session) : session?.accumulatedMs ?? 0;
  const extrasTotal = useMemo(() => session ? sumExtras(session.extras) : 0, [session]);

  const live = useMemo(() => {
    if (!session) return null;
    return calcBill({
      durationMs: elapsed,
      hourlyRate: session.hourlyRate,
      discount: session.discount,
      manualAdjustment: session.manualAdjustment,
      taxRate: session.taxRate,
      extrasTotal,
    });
  }, [session, elapsed, extrasTotal]);

  const status = session?.status ?? "idle";

  const statusBadge: Record<string, { label: string; className: string }> = {
    idle: { label: "Available", className: "bg-muted text-muted-foreground" },
    running: { label: "Live", className: "bg-primary text-primary-foreground animate-pulse-neon" },
    paused: { label: "Paused", className: "bg-warning text-warning-foreground" },
    ended: { label: "Ended · Unpaid", className: "bg-destructive text-destructive-foreground" },
  };

  const rate = table.type === "snooker" ? settings.snookerRate : settings.poolRate;

  return (
    <Card
      className={[
        "group relative overflow-hidden rounded-2xl border border-border/60 p-0 transition-all",
        status === "running"
          ? "shadow-[0_0_0_1px_var(--neon),0_10px_40px_-12px_color-mix(in_oklab,var(--neon)_40%,transparent)]"
          : "hover:border-primary/40 hover:shadow-glass",
      ].join(" ")}
    >
      <div className="relative h-28 felt-surface">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,color-mix(in_oklab,white_18%,transparent),transparent_60%)]" />
        <div className="absolute left-5 top-4">
          <Badge variant="outline" className="border-white/30 bg-black/30 text-[10px] uppercase tracking-[0.2em] text-white/90">
            {table.type === "snooker" ? "Royal Snooker" : "Mini Pool"}
          </Badge>
        </div>
        <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between">
          <h3 className="font-display text-xl text-white drop-shadow">{table.name}</h3>
          <Badge className={statusBadge[status].className}>{statusBadge[status].label}</Badge>
        </div>
        <div className="pointer-events-none absolute right-4 top-3 flex -space-x-1 opacity-90">
          <span className="h-3 w-3 rounded-full bg-rose-500 ring-1 ring-white/40" />
          <span className="h-3 w-3 rounded-full bg-amber-400 ring-1 ring-white/40" />
          <span className="h-3 w-3 rounded-full bg-sky-500 ring-1 ring-white/40" />
          <span className="h-3 w-3 rounded-full bg-zinc-900 ring-1 ring-white/40" />
        </div>
      </div>

      <div className="space-y-4 p-5">
        {session ? (
          <>
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Player</p>
                <p className="text-base font-semibold">{session.customerName}</p>
                <p className="text-xs text-muted-foreground">{settings.countryCode} {session.customerPhone}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Rate</p>
                <p className="text-base font-semibold">{formatCurrency(session.hourlyRate, settings.currency)}/hr</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Elapsed</p>
                <p suppressHydrationWarning className="font-display text-2xl tabular-nums text-neon">
                  {formatDuration(elapsed)}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Running Bill</p>
                <p suppressHydrationWarning className="font-display text-2xl tabular-nums">
                  {formatCurrency(live?.total ?? 0, settings.currency)}
                </p>
                {extrasTotal > 0 && (
                  <p className="text-[10px] text-muted-foreground">incl. extras {formatCurrency(extrasTotal, settings.currency)}</p>
                )}
              </div>
            </div>

            {(status === "running" || status === "paused") && (
              <div className="rounded-xl border border-border/60 bg-muted/20">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-sm"
                  onClick={() => setShowExtras((v) => !v)}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Coffee className="h-4 w-4 text-neon" />
                    Extras (tea, cigarette, snacks…)
                    {session.extras.length > 0 && <Badge variant="outline">{session.extras.length}</Badge>}
                  </span>
                  {showExtras ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showExtras && (
                  <div className="border-t border-border/60 p-3">
                    <ExtrasManager session={session} />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {status === "running" && (
                <Button size="sm" variant="secondary" onClick={() => pauseSession(session.id)}>
                  <Pause className="mr-1.5 h-4 w-4" /> Pause
                </Button>
              )}
              {status === "paused" && (
                <Button size="sm" onClick={() => resumeSession(session.id)}>
                  <Play className="mr-1.5 h-4 w-4" /> Resume
                </Button>
              )}
              {(status === "running" || status === "paused") && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await endSession(session.id);
                    toast.success("Session ended. Confirm payment to send thank-you.");
                  }}
                >
                  <Square className="mr-1.5 h-4 w-4" /> End
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onEdit(session)}>
                <Pencil className="mr-1.5 h-4 w-4" /> Edit
              </Button>
              {status === "ended" && session.payment === "unpaid" && (
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={async () => {
                    await markPaid(session.id);
                    const msg = thankYouMessage(settings.clubName, session.customerName, session.total, settings.currency);
                    const url = waLink(session.customerPhone, settings.countryCode, msg);
                    window.open(url, "_blank", "noopener,noreferrer");
                    toast.success("Marked paid. WhatsApp thank-you opened.");
                  }}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark Paid & Send
                </Button>
              )}
              {session.payment === "paid" && (
                <Badge className="bg-success text-success-foreground">
                  <CircleDollarSign className="mr-1 h-3 w-3" /> Paid · {formatCurrency(session.total, settings.currency)}
                </Badge>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">Ready for the next break</p>
              <p className="text-sm font-semibold">
                {formatCurrency(rate, settings.currency)}<span className="text-muted-foreground">/hr</span>
              </p>
            </div>
            <Button onClick={onStart} className="w-full glow-neon">
              <Play className="mr-1.5 h-4 w-4" /> Start Session
            </Button>
          </div>
        )}
      </div>

      {status === "ended" && session?.payment === "unpaid" && (
        <div className="border-t border-border/60 bg-warning/10 px-5 py-2 text-xs text-warning-foreground/90 flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5" /> Payment pending — total {formatCurrency(session.total, settings.currency)}
        </div>
      )}
    </Card>
  );
}
