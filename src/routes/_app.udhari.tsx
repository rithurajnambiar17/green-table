import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { BookText, UserPlus, ArrowUpRight, ArrowDownLeft, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Customer } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/udhari")({
  head: () => ({ meta: [{ title: "Udhari Ledger — Green Table" }] }),
  component: UdhariPage,
});

function UdhariPage() {
  const { customers, customerTransactions, settings, toggleUdhariAccess, addUdhariTransaction } = useApp();
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  
  // Add Customer form state
  const [addCustName, setAddCustName] = useState("");
  const [addCustPhone, setAddCustPhone] = useState("");

  // Transaction form state
  const [txType, setTxType] = useState<'given'|'received'|null>(null);
  const [txAmount, setTxAmount] = useState("");
  const [txNotes, setTxNotes] = useState("");

  const udhariCustomers = customers.filter(c => c.allowCredit);
  const filteredCustomers = udhariCustomers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const selectedTx = selectedCustomer 
    ? customerTransactions.filter(tx => tx.customerId === selectedCustomer.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const handleAddUdhariCustomer = async () => {
    // Find the customer by name/phone
    const existing = customers.find(c => c.name === addCustName && c.phone === addCustPhone);
    if (existing) {
      await toggleUdhariAccess(existing.id, true);
      setSelectedCustomer(customers.find(c => c.id === existing.id) || null);
    }
    setIsAddCustomerOpen(false);
    setAddCustName("");
    setAddCustPhone("");
  };

  const handleTransaction = async () => {
    if (!selectedCustomer || !txType) return;
    const amount = Number(txAmount);
    if (isNaN(amount) || amount <= 0) return;

    await addUdhariTransaction(selectedCustomer.id, amount, txType, txNotes);
    
    setTxType(null);
    setTxAmount("");
    setTxNotes("");
    
    // Refresh selected customer state to show new balance
    const updated = customers.find(c => c.id === selectedCustomer.id);
    if (updated) setSelectedCustomer(updated);
  };

  const totalOutstanding = udhariCustomers.reduce((sum, c) => sum + c.balance, 0);

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-6 md:flex-row">
      {/* Left Column: Customer List */}
      <div className="flex w-full flex-col gap-4 md:w-80 lg:w-96 flex-shrink-0">
        <div>
          <h1 className="font-display text-3xl">Khatabook</h1>
          <p className="text-sm text-muted-foreground mt-1">Total to receive: <span className="font-semibold text-destructive">{formatCurrency(totalOutstanding, settings.currency)}</span></p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="glow-neon shrink-0"><UserPlus className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Customer to Udhari</DialogTitle>
                <DialogDescription className="sr-only">Allow a customer to pay via Udhari credit.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Search Existing Customer</Label>
                  <CustomerAutocomplete 
                    value={addCustName} 
                    onChange={(n, p) => { setAddCustName(n); setAddCustPhone(p); }} 
                    placeholder="Search by name or phone..."
                  />
                  <p className="text-xs text-muted-foreground">Only existing customers can be added to the Udhari ledger.</p>
                </div>
                <Button className="w-full" onClick={handleAddUdhariCustomer} disabled={!addCustName}>
                  Add to Ledger
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pb-4 pr-1">
          {filteredCustomers.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground text-sm border border-dashed rounded-lg">
              No Udhari customers found.
            </div>
          ) : (
            filteredCustomers.map(customer => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedCustomer?.id === customer.id 
                    ? "bg-accent border-neon/50 shadow-[0_0_10px_rgba(var(--neon-rgb),0.1)]" 
                    : "bg-card border-border/40 hover:bg-muted/50"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold">{customer.name}</span>
                  <span className={`font-semibold ${customer.balance > 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatCurrency(Math.abs(customer.balance), settings.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{customer.phone || "No phone"}</span>
                  <span>{customer.balance > 0 ? "You'll get" : customer.balance < 0 ? "You'll give" : "Settled"}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Ledger Details */}
      <div className="flex-1 flex flex-col min-h-0 bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm">
        {selectedCustomer ? (
          <>
            <div className="p-4 md:p-6 border-b border-border/60 bg-muted/10 flex justify-between items-center">
              <div>
                <h2 className="font-display text-2xl">{selectedCustomer.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedCustomer.phone || "No phone"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Net Balance</p>
                <p className={`font-display text-2xl ${selectedCustomer.balance > 0 ? 'text-destructive' : selectedCustomer.balance < 0 ? 'text-success' : 'text-foreground'}`}>
                  {formatCurrency(Math.abs(selectedCustomer.balance), settings.currency)}
                </p>
                <p className="text-xs text-muted-foreground">{selectedCustomer.balance > 0 ? "You will get" : selectedCustomer.balance < 0 ? "You will give" : "Account Settled"}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {selectedTx.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <BookText className="h-12 w-12 opacity-20 mb-4" />
                  <p>No transactions yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedTx.map((tx) => (
                    <div key={tx.id} className="flex flex-col p-3 rounded-lg bg-background border border-border/40">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm text-muted-foreground">{formatDateTime(tx.createdAt)}</span>
                        <span className={`font-semibold ${tx.type === 'given' ? 'text-destructive' : 'text-success'}`}>
                          {tx.type === 'given' ? '-' : '+'}{formatCurrency(tx.amount, settings.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-sm">{tx.notes || (tx.type === 'given' ? 'Credit given' : 'Payment received')}</span>
                        <Badge variant="outline" className={`text-[10px] ${tx.type === 'given' ? 'border-destructive/30 text-destructive' : 'border-success/30 text-success'}`}>
                          {tx.type === 'given' ? 'You Gave' : 'You Got'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border/60 bg-muted/10">
              <div className="grid grid-cols-2 gap-4">
                <Dialog open={txType === 'given'} onOpenChange={(open) => !open && setTxType(null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setTxType('given')}>
                      <ArrowUpRight className="mr-2 h-4 w-4" /> You Gave (₹)
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-destructive">You Gave to {selectedCustomer.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0" className="text-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Input value={txNotes} onChange={e => setTxNotes(e.target.value)} placeholder="e.g., Borrowed for food" />
                      </div>
                      <Button className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleTransaction} disabled={!txAmount}>
                        Save
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={txType === 'received'} onOpenChange={(open) => !open && setTxType(null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-success/50 text-success hover:bg-success/10" onClick={() => setTxType('received')}>
                      <ArrowDownLeft className="mr-2 h-4 w-4" /> You Got (₹)
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-success">You Got from {selectedCustomer.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0" className="text-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Input value={txNotes} onChange={e => setTxNotes(e.target.value)} placeholder="e.g., Paid via Cash" />
                      </div>
                      <Button className="w-full bg-success text-success-foreground hover:bg-success/90" onClick={handleTransaction} disabled={!txAmount}>
                        Save
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
            <BookText className="h-16 w-16 opacity-20 mb-4" />
            <h2 className="text-xl font-display mb-2">Select a Customer</h2>
            <p className="max-w-xs">Click on a customer from the list to view their Udhari ledger and add transactions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
