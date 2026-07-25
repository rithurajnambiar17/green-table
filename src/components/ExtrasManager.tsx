import { useState } from "react";
import { Plus, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import type { Session } from "@/lib/types";
import { toast } from "sonner";

export function ExtrasManager({ session, compact = false }: { session: Session; compact?: boolean }) {
  const { addExtra, removeExtra, settings, inventory } = useApp();
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [qty, setQty] = useState(1);

  const submit = async () => {
    const p = Number(price);
    if (!name.trim() || !p || p <= 0 || qty <= 0) return;
    try {
      await addExtra(session.id, name.trim(), p, qty);
      setName(""); setPrice(""); setQty(1);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add"); }
  };

  const quickAdd = async (itemId: string, name: string, price: number) => {
    try {
      await addExtra(session.id, name, price, 1, itemId);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add"); }
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="space-y-2">
          {inventory.length === 0 ? (
            <p className="text-xs text-muted-foreground">No inventory items yet. Ask an admin to add products in Inventory.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {inventory.map((item) => {
                const out = item.trackStock && item.stock <= 0;
                return (
                  <Button
                    key={item.id}
                    size="sm"
                    variant="outline"
                    disabled={out}
                    onClick={() => quickAdd(item.id, item.name, item.price)}
                    className="h-8"
                  >
                    <Package className="mr-1.5 h-3.5 w-3.5" />
                    {item.name} · {formatCurrency(item.price, settings.currency)}
                    {item.trackStock && (
                      <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">
                        {out ? "out" : item.stock}
                      </Badge>
                    )}
                    {!out && <Plus className="ml-1 h-3 w-3" />}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_90px_70px_auto] gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Custom item" className="h-8" />
        <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Price" className="h-8" inputMode="decimal" />
        <Input value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value || 1))} type="number" min={1} className="h-8" />
        <Button size="sm" onClick={submit} className="h-8"><Plus className="h-3.5 w-3.5" /></Button>
      </div>

      {session.extras.length > 0 && (
        <ul className="space-y-1.5">
          {session.extras.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-sm">
              <span className="flex-1 truncate">
                {e.name} <span className="text-muted-foreground">× {e.qty}</span>
              </span>
              <span className="tabular-nums">{formatCurrency(e.price * e.qty, settings.currency)}</span>
              <button
                className="ml-2 text-muted-foreground hover:text-destructive"
                onClick={() => removeExtra(e.id)}
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between px-2.5 pt-1 text-sm font-medium">
            <span>Extras subtotal</span>
            <span className="tabular-nums text-neon">{formatCurrency(session.extras.reduce((a, e) => a + e.price * e.qty, 0), settings.currency)}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
