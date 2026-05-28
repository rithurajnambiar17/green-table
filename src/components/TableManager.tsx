import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import type { ClubTable, TableType } from "@/lib/types";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function TableManager() {
  const { tables, createTable, updateTable, deleteTable } = useApp();
  const [name, setName] = useState("");
  const [type, setType] = useState<TableType>("snooker");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; type: TableType }>({ name: "", type: "snooker" });

  const add = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    await createTable(name.trim(), type);
    setName("");
    toast.success("Table added");
  };

  const startEdit = (t: ClubTable) => { setEditing(t.id); setDraft({ name: t.name, type: t.type }); };
  const saveEdit = async (id: string) => {
    await updateTable(id, { name: draft.name.trim(), type: draft.type });
    setEditing(null);
    toast.success("Table updated");
  };

  return (
    <Card className="glass p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-xl">Manage Tables</h2>
          <p className="text-sm text-muted-foreground">Add, rename, or remove snooker and pool tables.</p>
        </div>
        <Badge variant="outline">{tables.length} configured</Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Table name (e.g. Royal Snooker 3)" />
        <Select value={type} onValueChange={(v) => setType(v as TableType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="snooker">Snooker</SelectItem>
            <SelectItem value="pool">Pool</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={add} className="glow-neon"><Plus className="mr-1 h-4 w-4" /> Add</Button>
      </div>

      <ul className="mt-4 divide-y divide-border/60">
        {tables.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            {editing === t.id ? (
              <>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-8 flex-1" />
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as TableType })}>
                  <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="snooker">Snooker</SelectItem>
                    <SelectItem value="pool">Pool</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => saveEdit(t.id)} aria-label="Save"><Check className="h-4 w-4 text-success" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel"><X className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <span className="flex-1">{t.name}</span>
                <Badge variant="outline" className="capitalize">{t.type}</Badge>
                <Button size="icon" variant="ghost" onClick={() => startEdit(t)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {t.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the table from the live floor. Existing session history is preserved. You cannot delete a table while it has active sessions.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try { await deleteTable(t.id); toast.success("Table deleted"); }
                          catch (e) { toast.error("Could not delete — clear active sessions first."); console.error(e); }
                        }}
                      >Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </li>
        ))}
        {tables.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No tables yet — add your first above.</li>}
      </ul>
    </Card>
  );
}
