import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Plus, Trash2, Banknote, Calendar, Coffee, Pencil, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — Green Table" },
      { name: "description", content: "Manage cafe and table expenses." },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { expenses, addExpense, updateExpense, deleteExpense, settings, user } = useApp();
  const isAdmin = user?.role === "admin";

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<"cafe" | "table">("cafe");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState<"all" | "cafe" | "table">("all");

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<"cafe" | "table">("cafe");
  const [editDesc, setEditDesc] = useState("");

  const add = async () => {
    if (!description.trim()) { toast.error("Description required"); return; }
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Valid amount required"); return; }

    try {
      await addExpense(amt, category, description.trim());
      setAmount(""); setDescription(""); setCategory("cafe");
      toast.success("Expense added");
    } catch (e: any) {
      toast.error(e.message || "Failed to add expense");
    }
  };

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return expenses.filter(e => new Date(e.createdAt) >= startOfMonth);
  }, [expenses]);

  const totalCurrentMonth = currentMonthExpenses.reduce((a, e) => a + e.amount, 0);
  const totalCafe = currentMonthExpenses.filter(e => e.category === "cafe").reduce((a, e) => a + e.amount, 0);
  const totalTable = currentMonthExpenses.filter(e => e.category === "table").reduce((a, e) => a + e.amount, 0);

  const displayedExpenses = useMemo(() => {
    if (filter === "all") return expenses;
    return expenses.filter((e) => e.category === filter);
  }, [expenses, filter]);

  // Reset pagination on filter change
  useMemo(() => setCurrentPage(1), [filter]);

  const totalPages = Math.ceil(displayedExpenses.length / pageSize);
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedExpenses.slice(start, start + pageSize);
  }, [displayedExpenses, currentPage]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Finance</p>
        <h1 className="font-display text-3xl md:text-4xl">Expenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log and track your cafe and table maintenance expenses.
        </p>
      </header>

      {!isAdmin && (
        <Card className="border-warning/40 bg-warning/10 p-4 text-sm">
          You are signed in as <b>staff</b>. Only admins can delete expenses.
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card 
          className={`glass p-4 cursor-pointer transition-all hover:bg-muted/30 ${filter === "all" ? "ring-2 ring-neon" : ""}`}
          onClick={() => setFilter("all")}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground">This Month Total</p>
          <p className="mt-1 font-display text-2xl text-neon">{formatCurrency(totalCurrentMonth, settings.currency)}</p>
        </Card>
        <Card 
          className={`glass p-4 cursor-pointer transition-all hover:bg-muted/30 ${filter === "cafe" ? "ring-2 ring-neon" : ""}`}
          onClick={() => setFilter("cafe")}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Cafe Expenses</p>
          <p className="mt-1 font-display text-2xl">{formatCurrency(totalCafe, settings.currency)}</p>
        </Card>
        <Card 
          className={`glass p-4 cursor-pointer transition-all hover:bg-muted/30 ${filter === "table" ? "ring-2 ring-neon" : ""}`}
          onClick={() => setFilter("table")}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Table / Cigarettes Expenses</p>
          <p className="mt-1 font-display text-2xl">{formatCurrency(totalTable, settings.currency)}</p>
        </Card>
      </div>

      <Card className="glass p-6">
        <h2 className="font-display text-xl">Log Expense</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_150px_120px_auto]">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (e.g., Coffee beans)" />
          <Select value={category} onValueChange={(v: "cafe" | "table") => setCategory(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cafe">Cafe</SelectItem>
              <SelectItem value="table">Table/Cigarette</SelectItem>
            </SelectContent>
          </Select>
          <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount" inputMode="decimal" />
          <Button onClick={add} className="glow-neon"><Plus className="mr-1 h-4 w-4" /> Add</Button>
        </div>
      </Card>

      <Card className="glass p-0">
        <div className="border-b border-border/60 px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Recent Expenses</h2>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-muted/20 border-b border-border/60 px-6 py-2 text-xs">
            <span className="text-muted-foreground">
              Showing <span className="font-medium text-foreground">{(currentPage - 1) * pageSize + 1}</span>-
              <span className="font-medium text-foreground">{Math.min(currentPage * pageSize, displayedExpenses.length)}</span> of{" "}
              <span className="font-medium text-foreground">{displayedExpenses.length}</span> expenses
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
              <span className="text-muted-foreground">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          </div>
        )}

        {displayedExpenses.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Banknote className="mx-auto mb-2 h-6 w-6 opacity-60" />
            No expenses found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Description</th>
                  <th className="px-6 py-3 font-medium text-right">Amount</th>
                  {isAdmin && <th className="px-6 py-3 font-medium w-24"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedExpenses.map((expense) => {
                  const isEditing = editingId === expense.id;
                  
                  return (
                  <tr key={expense.id} className="hover:bg-muted/20">
                    {isEditing ? (
                      <>
                        <td className="px-6 py-3 whitespace-nowrap text-muted-foreground">
                          {new Date(expense.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3">
                          <Select value={editCategory} onValueChange={(v: "cafe" | "table") => setEditCategory(v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cafe">Cafe</SelectItem>
                              <SelectItem value="table">Table/Cigarette</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-3">
                          <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-8 text-xs" />
                        </td>
                        <td className="px-6 py-3">
                          <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-8 text-xs text-right" inputMode="decimal" />
                        </td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-success" onClick={async () => {
                              if (!editDesc.trim()) { toast.error("Description required"); return; }
                              const amt = Number(editAmount);
                              if (isNaN(amt) || amt <= 0) { toast.error("Valid amount required"); return; }
                              try {
                                await updateExpense(expense.id, { amount: amt, category: editCategory, description: editDesc.trim() });
                                setEditingId(null);
                                toast.success("Expense updated");
                              } catch (e: any) { toast.error(e.message || "Failed to update"); }
                            }}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3 whitespace-nowrap">
                          {new Date(expense.createdAt).toLocaleDateString()} {new Date(expense.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-3 capitalize text-muted-foreground">
                          <div className="flex items-center gap-2">
                            {expense.category === 'cafe' ? <Coffee className="h-3.5 w-3.5" /> : <Banknote className="h-3.5 w-3.5" />}
                            {expense.category === 'table' ? 'Table/Cigarettes' : expense.category}
                          </div>
                        </td>
                        <td className="px-6 py-3 font-medium">{expense.description}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{formatCurrency(expense.amount, settings.currency)}</td>
                        {isAdmin && (
                          <td className="px-6 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                                setEditingId(expense.id);
                                setEditAmount(expense.amount.toString());
                                setEditCategory(expense.category);
                                setEditDesc(expense.description);
                              }}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Delete">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this expense of {formatCurrency(expense.amount, settings.currency)}? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={async () => { await deleteExpense(expense.id); toast.success("Deleted"); }}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
