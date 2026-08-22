import { useMemo, useState, useEffect } from "react";
import {
  Play, Pause, Square, CheckCircle2, Pencil, CircleDollarSign,
  MessageCircle, Coffee, ChevronDown, ChevronUp, BookText, ArrowRightLeft
} from "lucide-react";
import { sessionElapsedMs, useApp, rateForType } from "@/lib/store";
import { TABLE_TYPE_LABEL, type ClubTable, type Session } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { calcBill, formatCurrency, formatDuration, sumExtras } from "@/lib/format";
import { toast } from "sonner";
import { MarkPaidDialog } from "@/components/MarkPaidDialog";
import { ExtrasManager } from "./ExtrasManager";
import { TransferSessionDialog } from "./TransferSessionDialog";
import { useMounted } from "@/hooks/use-mounted";

interface Props {
  table: ClubTable;
  session?: Session;
  onStart: () => void;
  onEdit: (s: Session) => void;
}

export function TableCard({ table, session, onStart, onEdit }: Props) {
  const { pauseSession, resumeSession, endSession, markPaid, markUdhari, dismissSession, settings, customers } = useApp();
  const mounted = useMounted();
  const [showExtras, setShowExtras] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  const [tick, setTick] = useState(0);

  // Re-render every second if the session is running
  useEffect(() => {
    if (session?.status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session?.status]);

  // Read the elapsed time based on the latest Date.now() (triggered by tick)
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

  const customer = useMemo(() => {
    return session?.customerId ? customers.find(c => c.id === session.customerId) : null;
  }, [session?.customerId, customers]);

  const statusBadge: Record<string, { label: string; className: string }> = {
    idle: { label: "Available", className: "bg-muted text-muted-foreground" },
    running: { label: "Live", className: "bg-primary text-primary-foreground animate-pulse-neon" },
    paused: { label: "Paused", className: "bg-warning text-warning-foreground" },
    ended: { label: "Ended · Unpaid", className: "bg-destructive text-destructive-foreground" },
  };

  const rate = rateForType(table.type, settings);

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
            {TABLE_TYPE_LABEL[table.type]}
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

            {(status === "running" || status === "paused" || (status === "ended" && session?.payment === "unpaid")) && (
              <Dialog open={showExtras} onOpenChange={setShowExtras}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-between px-3 h-9">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Coffee className="h-4 w-4 text-neon" />
                      Extras / Items
                    </span>
                    {session.extras.length > 0 && <Badge variant="secondary" className="h-5">{session.extras.reduce((a, e) => a + e.qty, 0)}</Badge>}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Items to {table.name}</DialogTitle>
                    <DialogDescription className="sr-only">Manage extras and cafe items for this table.</DialogDescription>
                  </DialogHeader>
                  <ExtrasManager session={session} />
                </DialogContent>
              </Dialog>
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
              <Button size="sm" variant="ghost" onClick={() => setShowTransferDialog(true)}>
                <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Transfer
              </Button>
              {status === "ended" && session.payment === "unpaid" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      dismissSession(session.id);
                      toast.success("Session dismissed. You can pay it later from the Sessions tab.");
                    }}
                  >
                    Pay Later
                  </Button>
                  {customer?.allowCredit && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-warning/50 text-warning hover:bg-warning/10"
                      onClick={async () => {
                        await markUdhari(session.id);
                        dismissSession(session.id);
                        toast.success("Added to Udhari ledger.");
                      }}
                    >
                      <BookText className="mr-1.5 h-4 w-4" /> Put on Credit
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => setShowMarkPaidDialog(true)}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark Paid
                  </Button>
                </>
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

      {session?.notes && (
        <div className="border-t border-border/60 bg-muted/40 px-5 py-3">
          <p className="text-xs uppercase text-muted-foreground mb-1">Notes</p>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{session.notes}</p>
        </div>
      )}

      {session && (
        <MarkPaidDialog
          session={session}
          open={showMarkPaidDialog}
          onOpenChange={setShowMarkPaidDialog}
        />
      )}

      {session && (
        <TransferSessionDialog
          session={session}
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
        />
      )}
    </Card>
  );
}
