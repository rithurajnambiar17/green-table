import { useState } from "react";
import { Plus, Trash2, Coffee, Cigarette, GlassWater, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import type { Session } from "@/lib/types";

const QUICK_ITEMS = [
  { name: "Tea", price: 80, icon: Coffee },
  { name: "Cigarette", price: 30, icon: Cigarette },
  { name: "Soft Drink", price: 120, icon: GlassWater },
  { name: "Snacks", price: 150, icon: Cookie },
] as const;

export function ExtrasManager({ session, compact = false }: { session: Session; compact?: boolean }) {
  const { addExtra, removeExtra, settings } = useApp();
  const [name, setName] = useState("");
  const [price, setPrice] = useState<string>("");
  const [qty, setQty] = useState(1);

  const submit = async () => {
    const p = Number(price);
    if (!name.trim() || !p || p <= 0 || qty <= 0) return;
    await addExtra(session.id, name.trim(), p, qty);
    setName(""); setPrice(""); setQty(1);
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap gap-2">
          {QUICK_ITEMS.map((q) => {
            const Icon = q.icon;
            return (
              <Button
                key={q.name}
                size="sm"
                variant="outline"
                onClick={() => addExtra(session.id, q.name, q.price, 1)}
                className="h-8"
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {q.name} · {formatCurrency(q.price, settings.currency)}
                <Plus className="ml-1 h-3 w-3" />
              </Button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-[1fr_90px_70px_auto] gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" className="h-8" />
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
