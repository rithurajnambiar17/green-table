import { useState } from "react";
import { useApp } from "@/lib/store";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ClubTable } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  table: ClubTable | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function StartSessionDialog({ table, open, onOpenChange }: Props) {
  const { startSession, customers } = useApp();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setName(""); setPhone(""); };

  const submit = async () => {
    if (!table) return;
    if (!name.trim() || !phone.trim()) { toast.error("Name and phone are required"); return; }
    setBusy(true);
    const s = await startSession({ tableId: table.id, customerName: name.trim(), customerPhone: phone.trim() });
    setBusy(false);
    if (s) toast.success(`Session started on ${table.name}`);
    else toast.error("Could not start session");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Start session — {table?.name}</DialogTitle>
          <DialogDescription>
            Enter player details to begin live billing on this {table?.type === "snooker" ? "Royal Snooker" : "Mini Pool"} table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Player name</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ali Raza" list="known-customers" autoFocus />
            <datalist id="known-customers">
              {customers.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pphone">Phone number</Label>
            <Input id="pphone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))} placeholder="3001234567" inputMode="tel" />
            <p className="text-xs text-muted-foreground">Used for WhatsApp thank-you after payment.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="glow-neon">{busy ? "Starting…" : "Start session"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
