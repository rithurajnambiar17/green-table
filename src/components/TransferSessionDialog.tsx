import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Session } from "@/lib/types";
import { toast } from "sonner";
import { CustomerAutocomplete } from "./CustomerAutocomplete";

interface Props {
  session: Session | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function TransferSessionDialog({ session, open, onOpenChange }: Props) {
  const { updateSession } = useApp();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && session) {
      setName(session.customerName);
      setPhone(session.customerPhone);
    }
  }, [open, session]);

  const reset = () => { 
    if (session) {
      setName(session.customerName);
      setPhone(session.customerPhone);
    }
  };

  const submit = async () => {
    if (!session) return;
    if (!name.trim() || !phone.trim()) { toast.error("Name and phone are required"); return; }
    if (name.trim() === session.customerName && phone.trim() === session.customerPhone) {
      onOpenChange(false);
      return;
    }

    setBusy(true);
    try {
      await updateSession(session.id, { 
        customerName: name.trim(), 
        customerPhone: phone.trim() 
      });
      toast.success(`Session transferred to ${name.trim()}`);
      onOpenChange(false);
    } catch (error) {
      toast.error("Could not transfer session");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Transfer session — {session?.tableName}</DialogTitle>
          <DialogDescription>
            Change the player for this session. The new player will be responsible for the bill.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="transfer_pname">New Player Name</Label>
            <CustomerAutocomplete 
              id="transfer_pname"
              placeholder="e.g. Ali Raza" 
              value={name} 
              onChange={(n, p) => {
                setName(n);
                if (p) setPhone(p);
              }} 
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transfer_pphone">Phone Number</Label>
            <Input id="transfer_pphone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))} placeholder="3001234567" inputMode="tel" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="glow-neon">{busy ? "Transferring…" : "Transfer session"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
