import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Package, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/store";
import type { InventoryItem } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Green Table" },
      { name: "description", content: "Manage cafe, cigarette and snack inventory for Green Table snooker & pool club." },
    ],
  }),
  component: InventoryPage,
});

const CATEGORIES = ["beverage", "food", "other", "tobacco"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  beverage: "Cafe - Beverage",
  food: "Cafe - Food",
  other: "Cafe - Other",
  tobacco: "Pool - Cigarettes/Tobacco",
};

function InventoryPage() {
  const { inventory, createInventoryItem, updateInventoryItem, deleteInventoryItem, settings, user } = useApp();
  const isAdmin = user?.role === "admin";

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("beverage");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [trackStock, setTrackStock] = useState(true);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<InventoryItem>>({});
  const [activeTab, setActiveTab] = useState<"cafe" | "pool">("cafe");

  const add = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    const p = Number(price); const s = Number(stock);
    if (isNaN(p) || p < 0) { toast.error("Valid price required"); return; }
    await createInventoryItem({
      name: name.trim(), category, price: p,
      stock: isNaN(s) ? 0 : s, trackStock,
    });
    setName(""); setPrice(""); setStock(""); setCategory("beverage"); setTrackStock(true);
    toast.success("Item added");
  };

  const startEdit = (i: InventoryItem) => { setEditing(i.id); setDraft(i); };
  const save = async () => {
    if (!editing) return;
    await updateInventoryItem(editing, draft);
    setEditing(null); setDraft({});
    toast.success("Item updated");
  };

  const restock = async (i: InventoryItem, delta: number) => {
    await updateInventoryItem(i.id, { stock: Math.max(0, i.stock + delta) });
  };

  const lowStock = inventory.filter((i) => i.trackStock && i.stock > 0 && i.stock <= 5);
  const outOfStock = inventory.filter((i) => i.trackStock && i.stock <= 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Cafe & shop</p>
        <h1 className="font-display text-3xl md:text-4xl">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Items available for quick-add to any live session. Selling a unit automatically decrements stock.
        </p>
      </header>

      {!isAdmin && (
        <Card className="border-warning/40 bg-warning/10 p-4 text-sm">
          You are signed in as <b>staff</b>. Only admins can add, edit or delete inventory items.
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="glass p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total items</p>
          <p className="mt-1 font-display text-2xl">{inventory.length}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Low stock (≤ 5)</p>
          <p className="mt-1 font-display text-2xl text-warning">{lowStock.length}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Out of stock</p>
          <p className="mt-1 font-display text-2xl text-destructive">{outOfStock.length}</p>
        </Card>
      </div>

      {isAdmin && (
        <Card className="glass p-6">
          <h2 className="font-display text-xl">Add product</h2>
          <p className="text-sm text-muted-foreground">Tea, coffee, cigarettes, snacks and drinks.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_140px_100px_100px_auto_auto]">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Price" inputMode="decimal" />
            <Input value={stock} onChange={(e) => setStock(e.target.value.replace(/[^\d]/g, ""))} placeholder="Stock" inputMode="numeric" />
            <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
              Track stock
            </label>
            <Button onClick={add} className="glow-neon"><Plus className="mr-1 h-4 w-4" /> Add</Button>
          </div>
        </Card>
      )}

      <Card className="glass p-0">
        <div className="border-b border-border/60 px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Products</h2>
          <div className="flex bg-muted p-1 rounded-md">
            <button
              onClick={() => setActiveTab("cafe")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === "cafe" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Cafe Items
            </button>
            <button
              onClick={() => setActiveTab("pool")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === "pool" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pool Items
            </button>
          </div>
        </div>
        {inventory.filter((i) => activeTab === "cafe" ? i.category !== "tobacco" : i.category === "tobacco").length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Package className="mx-auto mb-2 h-6 w-6 opacity-60" />
            No items in this category.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {inventory.filter((i) => activeTab === "cafe" ? i.category !== "tobacco" : i.category === "tobacco").map((i) => {
              const out = i.trackStock && i.stock <= 0;
              const low = i.trackStock && i.stock > 0 && i.stock <= 5;
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  {editing === i.id ? (
                    <>
                      <Input className="h-8 flex-1 min-w-[150px]" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                      <Select value={draft.category ?? "other"} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input className="h-8 w-24" type="number" value={draft.price ?? 0} onChange={(e) => setDraft({ ...draft, price: +e.target.value || 0 })} />
                      <Input className="h-8 w-24" type="number" value={draft.stock ?? 0} onChange={(e) => setDraft({ ...draft, stock: +e.target.value || 0 })} />
                      <Label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={draft.trackStock ?? true} onChange={(e) => setDraft({ ...draft, trackStock: e.target.checked })} />
                        Track
                      </Label>
                      <Button size="icon" variant="ghost" onClick={save}><Check className="h-4 w-4 text-success" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(null); setDraft({}); }}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-[160px]">
                        <p className="font-medium">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[i.category] || i.category}</p>
                      </div>
                      <span className="w-24 text-right tabular-nums">{formatCurrency(i.price, settings.currency)}</span>
                      {i.trackStock ? (
                        <Badge className={out ? "bg-destructive text-destructive-foreground" : low ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground"}>
                          {out && <AlertTriangle className="mr-1 h-3 w-3" />}
                          {i.stock} in stock
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not tracked</Badge>
                      )}
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => restock(i, 10)}>+10</Button>
                          <Button size="sm" variant="outline" onClick={() => restock(i, 1)}>+1</Button>
                          <Button size="icon" variant="ghost" onClick={() => startEdit(i)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {i.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes the item from quick-add. Historical session extras are preserved.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => { await deleteInventoryItem(i.id); toast.success("Deleted"); }}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
