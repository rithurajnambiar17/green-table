import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/store";
import { CheckCircle2, BookText } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Session } from "@/lib/types";

interface Props {
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (note: string) => void;
}

export function MarkPaidDialog({ session, open, onOpenChange, onSuccess }: Props) {
  const { markPaid, markUdhari, updateSession, customers, settings } = useApp();
  // Initialize with existing notes if any
  const [note, setNote] = useState(session?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update local state if session changes
  if (session?.notes && note === "" && !isSubmitting) {
    setNote(session.notes);
  }

  const handleSubmit = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const finalNote = note.trim();
      if (finalNote !== (session.notes || "")) {
        await updateSession(session.id, { notes: finalNote });
      }
      await markPaid(session.id);
      toast.success("Session marked as paid");
      onOpenChange(false);
      onSuccess?.(finalNote);
    } catch (e: any) {
      toast.error(e.message || "Failed to mark as paid");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUdhari = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const finalNote = note.trim();
      if (finalNote !== (session.notes || "")) {
        await updateSession(session.id, { notes: finalNote });
      }
      await markUdhari(session.id);
      toast.success("Session added to Udhari");
      onOpenChange(false);
      onSuccess?.(finalNote);
    } catch (e: any) {
      toast.error(e.message || "Failed to put on Udhari");
    } finally {
      setIsSubmitting(false);
    }
  };

  const customer = customers.find(c => c.id === session?.customerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Mark Session Paid</DialogTitle>
          <DialogDescription>
            You can optionally leave or update a note below before marking this session as paid.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {customer?.allowCredit && (
            <div className="text-xs font-medium flex justify-between items-center bg-muted/20 p-2.5 rounded-md border border-border/40">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <BookText className="h-3.5 w-3.5" /> Udhari Balance:
              </span>
              <span className={customer.balance > 0 ? "text-destructive" : customer.balance < 0 ? "text-success" : ""}>
                {customer.balance > 0 ? "Owes " : customer.balance < 0 ? "Advance " : ""}
                {formatCurrency(Math.abs(customer.balance), settings.currency)}
              </span>
            </div>
          )}
          <Textarea
            placeholder="e.g. Owe customer 500 change..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>

        <DialogFooter className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <div className="flex-1" />
          {/* {customer?.allowCredit && (
            <Button variant="outline" onClick={handleUdhari} disabled={isSubmitting} className="border-warning/50 text-warning hover:bg-warning/10">
              Put on Udhari
            </Button>
          )} */}
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-success text-success-foreground hover:bg-success/90">
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
