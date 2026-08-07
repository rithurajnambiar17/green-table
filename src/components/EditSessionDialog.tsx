import { useEffect, useState } from "react";
import { useApp, sessionElapsedMs } from "@/lib/store";
import type { Session } from "@/lib/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { calcBill, formatCurrency, sumExtras } from "@/lib/format";
import { ExtrasManager } from "./ExtrasManager";

interface Props {
  session: Session | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function EditSessionDialog({ session, open, onOpenChange }: Props) {
  const { updateSession, settings } = useApp();
  const [discount, setDiscount] = useState(0);
  const [adj, setAdj] = useState(0);
  const [rate, setRate] = useState(0);
  const [notes, setNotes] = useState("");

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (session) { 
      setDiscount(session.discount); 
      setAdj(session.manualAdjustment); 
      setRate(session.hourlyRate);
      setNotes(session.notes || "");
    }
  }, [session]);

  useEffect(() => {
    if (session?.status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session?.status]);

  if (!session) return null;
  const elapsed = sessionElapsedMs(session);
  const extrasTotal = sumExtras(session.extras);
  const preview = calcBill({
    durationMs: elapsed, hourlyRate: rate,
    discount, manualAdjustment: adj,
    taxRate: session.taxRate, extrasTotal,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Edit session — {session.tableName}</DialogTitle>
          <DialogDescription>Adjust rate, discount, manual charges and extras. Tax {session.taxRate}%.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Hourly rate</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(+e.target.value || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Discount</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(+e.target.value || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Adjustment (±)</Label>
            <Input type="number" value={adj} onChange={(e) => setAdj(+e.target.value || 0)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea 
            placeholder="Add a note (e.g. change owed)..." 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            className="resize-none h-20"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Extras</p>
          <ExtrasManager session={session} compact />
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
          <div className="flex justify-between text-sm"><span>Table charge</span><span>{formatCurrency(preview.tableCharge, settings.currency)}</span></div>
          <div className="flex justify-between text-sm"><span>Extras</span><span>{formatCurrency(preview.extras, settings.currency)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax ({session.taxRate}%)</span><span>{formatCurrency(preview.tax, settings.currency)}</span></div>
          <div className="mt-2 flex justify-between border-t border-border/60 pt-2 font-display text-lg">
            <span>Total</span><span className="text-neon">{formatCurrency(preview.total, settings.currency)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={async () => {
            await updateSession(session.id, { hourlyRate: rate, discount, manualAdjustment: adj, notes: notes.trim() });
            onOpenChange(false);
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
