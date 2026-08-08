import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDateTime, formatDuration } from "@/lib/format";
import { BookText, UserPlus, ArrowUpRight, ArrowDownLeft, Search, Plus, Info, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Customer, Session } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { MarkPaidDialog } from "@/components/MarkPaidDialog";
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/udhari")({
  head: () => ({ meta: [{ title: "Udhari Ledger — Green Table" }] }),
  component: UdhariPage,
});

function UdhariPage() {
  const { customers, sessions, settings, toggleUdhariAccess } = useApp();
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [viewSession, setViewSession] = useState<Session | null>(null);
  const [sessionToPay, setSessionToPay] = useState<Session | null>(null);
  
  // Add Customer form state
  const [addCustName, setAddCustName] = useState("");
  const [addCustPhone, setAddCustPhone] = useState("");

  const udhariCustomers = customers.filter(c => c.allowCredit);
  const filteredCustomers = udhariCustomers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const getCustomerBalance = (customerId: string) => {
    return sessions.filter(s => s.customerId === customerId && s.payment === "udhari").reduce((acc, s) => acc + s.total, 0);
  };

  const selectedCustomerSessions = selectedCustomer 
    ? sessions.filter(s => s.customerId === selectedCustomer.id && s.payment === "udhari").sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
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

  const totalOutstanding = udhariCustomers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);

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
            filteredCustomers.map(customer => {
              const liveBalance = getCustomerBalance(customer.id);
              return (
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
                    <span className={`font-semibold ${liveBalance > 0 ? 'text-destructive' : 'text-success'}`}>
                      {formatCurrency(Math.abs(liveBalance), settings.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{customer.phone || "No phone"}</span>
                    <span>{liveBalance > 0 ? "Amount Due" : "Settled"}</span>
                  </div>
                </button>
              );
            })
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
                <p className={`font-display text-2xl ${getCustomerBalance(selectedCustomer.id) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {formatCurrency(Math.abs(getCustomerBalance(selectedCustomer.id)), settings.currency)}
                </p>
                <p className="text-xs text-muted-foreground">{getCustomerBalance(selectedCustomer.id) > 0 ? "Amount Due" : "Account Settled"}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {selectedCustomerSessions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <BookText className="h-12 w-12 opacity-20 mb-4" />
                  <p>No pending Udhari sessions.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCustomerSessions.map((session) => (
                    <div 
                      key={session.id} 
                      className="flex flex-col p-4 rounded-lg bg-background border border-border/40 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setViewSession(session)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          {session.tableName}
                          <Info className="h-3 w-3 text-neon" />
                        </span>
                        <span className="font-semibold text-destructive">
                          {formatCurrency(session.total, settings.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-muted-foreground">{formatDateTime(session.startedAt)}</span>
                        <Button
                          size="sm"
                          className="bg-success text-success-foreground hover:bg-success/90 h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToPay(session);
                          }}
                        >
                          Mark Paid
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Session Details Dialog */}
      <Dialog open={!!viewSession} onOpenChange={(open) => !open && setViewSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription className="sr-only">Details for the selected session.</DialogDescription>
          </DialogHeader>
          {viewSession && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 border-b border-border/60 pb-3">
                <div><span className="text-muted-foreground block text-xs uppercase">Player</span> <span className="font-medium">{viewSession.customerName}</span></div>
                <div><span className="text-muted-foreground block text-xs uppercase">Table</span> <span className="font-medium">{viewSession.tableName}</span></div>
              </div>
              
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-2">Items Purchased</p>
                {viewSession.extras.length > 0 ? (
                  <ul className="space-y-1">
                    {viewSession.extras.map(e => (
                      <li key={e.id} className="flex justify-between">
                        <span>{e.name} <span className="text-muted-foreground ml-1">× {e.qty}</span></span>
                        <span>{formatCurrency(e.price * e.qty, settings.currency)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground italic">No items taken.</p>
                )}
              </div>

              <div className="pt-3 border-t border-border/60 flex flex-col gap-1">
                {viewSession.hourlyRate > 0 && viewSession.accumulatedMs > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Table Time ({formatDuration(viewSession.accumulatedMs)})</span>
                    <span>{formatCurrency(viewSession.total - viewSession.extrasTotal - viewSession.taxRate, settings.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-display text-lg pt-1">
                  <span>Total</span>
                  <span className="text-neon">{formatCurrency(viewSession.total, settings.currency)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <MarkPaidDialog
        session={sessionToPay}
        open={!!sessionToPay}
        onOpenChange={(open) => !open && setSessionToPay(null)}
        onSuccess={(note) => {
          setSessionToPay(null);
        }}
      />
    </div>
  );
}
