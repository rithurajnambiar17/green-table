import { useEffect, useState } from "react";
import { useApp, sessionElapsedMs } from "@/lib/store";
import type { Session } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calcBill, formatCurrency } from "@/lib/format";

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

  useEffect(() => {
    if (session) {
      setDiscount(session.discount);
      setAdj(session.manualAdjustment);
      setRate(session.hourlyRate);
    }
  }, [session]);

  if (!session) return null;
  const elapsed = sessionElapsedMs(session);
  const preview = calcBill({
    durationMs: elapsed,
    hourlyRate: rate,
    discount,
    manualAdjustment: adj,
    taxRate: session.taxRate,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle className="font-display">Edit session — {session.tableName}</DialogTitle>
          <DialogDescription>Adjust rate, discount and manual charges. Tax {session.taxRate}%.</DialogDescription>
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

        <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
          <div className="flex justify-between text-sm"><span>Base</span><span>{formatCurrency(preview.base, settings.currency)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax ({session.taxRate}%)</span><span>{formatCurrency(preview.tax, settings.currency)}</span></div>
          <div className="mt-2 flex justify-between border-t border-border/60 pt-2 font-display text-lg">
            <span>Total</span><span className="text-neon">{formatCurrency(preview.total, settings.currency)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              updateSession(session.id, { hourlyRate: rate, discount, manualAdjustment: adj });
              onOpenChange(false);
            }}
          >Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
