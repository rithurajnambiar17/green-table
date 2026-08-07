import { useState } from "react";
import { Plus, Minus, Trash2, Package, Clock, StickyNote, BookText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerAutocomplete } from "./CustomerAutocomplete";

export function LogPastSessionDialog() {
  const { inventory, tables, settings, logPastSession, customers } = useApp();
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<{ name: string; price: number; qty: number; inventoryId?: string }[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableId, setTableId] = useState("");
  const [notes, setNotes] = useState("");
  
  // Format dates for datetime-local input
  const toLocalISO = (d: Date) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [startedAt, setStartedAt] = useState(toLocalISO(new Date(Date.now() - 3600000)));
  const [endedAt, setEndedAt] = useState(toLocalISO(new Date()));
  
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState(1);

  const addCustom = () => {
    const p = Number(customPrice);
    if (!customName.trim() || !p || p <= 0 || customQty <= 0) return;
    setCart(prev => [...prev, { name: customName.trim(), price: p, qty: customQty }]);
    setCustomName(""); setCustomPrice(""); setCustomQty(1);
  };

  const quickAdd = (item: { id: string; name: string; price: number; trackStock: boolean; stock: number }) => {
    setCart(prev => {
      const existing = prev.find(i => i.inventoryId === item.id);
      if (existing) {
        return prev.map(i => i.inventoryId === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { name: item.name, price: item.price, qty: 1, inventoryId: item.id }];
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (item.inventoryId) {
        const inv = inventory.find(invItem => invItem.id === item.inventoryId);
        if (inv?.trackStock && inv.stock < newQty) {
          toast.error("Not enough stock!");
          return item;
        }
      }
      return { ...item, qty: newQty };
    }));
  };

  const selectedCustomerObj = customers.find(c => c.name === customerName && (!customerPhone || c.phone === customerPhone));

  const submit = async (payment: import("@/lib/types").PaymentStatus = "paid") => {
    if (!tableId) {
      toast.error("Please select a table");
      return;
    }
    
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }

    try {
      await logPastSession({
        tableId,
        customerName,
        customerPhone,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        payment,
        notes,
        cart
      });
      toast.success("Past session logged successfully!");
      setOpen(false);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setTableId("");
      setNotes("");
      setStartedAt(toLocalISO(new Date(Date.now() - 3600000)));
      setEndedAt(toLocalISO(new Date()));
    } catch (e: any) {
      toast.error(e.message || "Failed to log session");
    }
  };

  const extrasTotal = cart.reduce((a, b) => a + (b.price * b.qty), 0);
  
  const table = tables.find(t => t.id === tableId);
  const rate = table ? (table.type === "snooker" ? settings.snookerRate : table.type === "mini_snooker" ? settings.miniSnookerRate : settings.poolRate) : 0;
  
  const durationMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  const hours = durationMs / 3_600_000;
  const tableCharge = hours * rate;
  const tax = (tableCharge + extrasTotal) * (settings.taxRate / 100);
  const grandTotal = tableCharge + extrasTotal + tax;

  const activeTables = tables.filter(t => t.name !== "Walk-in POS");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/10">
          <Clock className="h-4 w-4" />
          Log Past Session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md sm:max-w-lg overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Log Past Session</DialogTitle>
          <DialogDescription>Manually log a completed session.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Table & Time</p>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={tableId}
              onChange={e => setTableId(e.target.value)}
            >
              <option value="">Select a table...</option>
              {activeTables.map(t => (
                <option key={t.id} value={t.id} className="bg-background text-foreground">{t.name} ({t.type})</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Start Time</label>
                <Input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Time</label>
                <Input type="datetime-local" value={endedAt} onChange={e => setEndedAt(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <p className="text-xs font-medium text-muted-foreground uppercase">Customer Details (Optional)</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CustomerAutocomplete 
                placeholder="Name" 
                value={customerName} 
                onChange={(name, phone) => {
                  setCustomerName(name);
                  if (phone) setCustomerPhone(phone);
                }} 
              />
              <Input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value.replace(/[^\d]/g, ""))} />
            </div>

            {selectedCustomerObj?.allowCredit && (
              <div className="text-xs font-medium flex justify-between items-center bg-muted/20 p-2.5 rounded-md border border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <BookText className="h-3.5 w-3.5" /> Udhari Balance:
                </span>
                <span className={selectedCustomerObj.balance > 0 ? "text-destructive" : selectedCustomerObj.balance < 0 ? "text-success" : ""}>
                  {selectedCustomerObj.balance > 0 ? "Owes " : selectedCustomerObj.balance < 0 ? "Advance " : ""}
                  {formatCurrency(Math.abs(selectedCustomerObj.balance), settings.currency)}
                </span>
              </div>
            )}

            <div className="relative">
              <StickyNote className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Notes (optional)..." value={notes} onChange={e => setNotes(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Cafe / Items</p>
            {inventory.length === 0 ? (
              <p className="text-xs text-muted-foreground">No inventory items.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  inventory.reduce((acc, item) => {
                    if (!acc[item.category]) acc[item.category] = [];
                    acc[item.category].push(item);
                    return acc;
                  }, {} as Record<string, typeof inventory>)
                ).map(([category, items]) => (
                  <DropdownMenu key={category}>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 capitalize">
                        <Package className="mr-1.5 h-3.5 w-3.5" />
                        {category === "tobacco" ? "Pool / Tobacco" : category}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {items.map((item) => {
                        const cartQty = cart.find(c => c.inventoryId === item.id)?.qty || 0;
                        const out = item.trackStock && item.stock - cartQty <= 0;
                        return (
                          <DropdownMenuItem
                            key={item.id}
                            disabled={out}
                            onClick={() => quickAdd(item)}
                            className="flex items-center justify-between gap-4 cursor-pointer"
                          >
                            <span>{item.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{formatCurrency(item.price, settings.currency)}</span>
                              {item.trackStock && (
                                <Badge variant="outline" className={out ? "bg-destructive text-destructive-foreground h-4 px-1 text-[10px]" : "h-4 px-1 text-[10px]"}>
                                  {out ? "out" : (item.stock - cartQty)}
                                </Badge>
                              )}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_90px_70px_auto] gap-2 pt-2 border-t border-border/60">
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Custom item" className="h-8" />
            <Input value={customPrice} onChange={(e) => setCustomPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Price" className="h-8" inputMode="decimal" />
            <Input value={customQty} onChange={(e) => setCustomQty(Math.max(1, +e.target.value || 1))} type="number" min={1} className="h-8" />
            <Button size="sm" onClick={addCustom} className="h-8"><Plus className="h-3.5 w-3.5" /></Button>
          </div>

          {cart.length > 0 && (
            <div className="min-h-[100px] max-h-[150px] overflow-y-auto rounded-md border border-border/60 bg-muted/20 p-2">
              <ul className="space-y-1.5">
                {cart.map((e, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm">
                    <div className="flex-1 flex items-center gap-2 overflow-hidden mr-2">
                      <span className="truncate">{e.name}</span>
                      <div className="flex items-center gap-1.5 rounded-md bg-muted/30 px-1 py-0.5 border border-border/50">
                        <button className="text-muted-foreground hover:text-primary transition-colors" onClick={() => updateQty(idx, e.qty - 1)}><Minus className="h-3 w-3" /></button>
                        <span className="text-[11px] text-muted-foreground w-3 text-center">{e.qty}</span>
                        <button className="text-muted-foreground hover:text-primary transition-colors" onClick={() => updateQty(idx, e.qty + 1)}><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                    <span className="tabular-nums">{formatCurrency(e.price * e.qty, settings.currency)}</span>
                    <button className="ml-2 text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}



          <div className="flex justify-between items-end pt-2 border-t border-border/60">
            <div className="text-sm">
              <p className="text-muted-foreground">Table: {formatCurrency(tableCharge, settings.currency)}</p>
              <p className="text-muted-foreground">Cafe: {formatCurrency(extrasTotal, settings.currency)}</p>
              {settings.taxRate > 0 && <p className="text-muted-foreground">Tax ({settings.taxRate}%): {formatCurrency(tax, settings.currency)}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground mb-1">Total</p>
              <p className="text-2xl font-display text-neon">{formatCurrency(grandTotal, settings.currency)}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={() => submit("unpaid")} disabled={!tableId}>
            Log Unpaid
          </Button>
          {selectedCustomerObj?.allowCredit && (
            <Button variant="outline" className="border-warning/50 text-warning hover:bg-warning/10" onClick={() => submit("udhari")} disabled={!tableId}>
              Log on Udhari
            </Button>
          )}
          <Button onClick={() => submit("paid")} disabled={!tableId} className="glow-neon">
            Log Paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
