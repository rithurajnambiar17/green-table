import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency, formatDuration } from "@/lib/format";
import type { Session } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useMemo } from "react";

interface Props {
  customerId: string | null;
  customerName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerHistoryDialog({ customerId, customerName, open, onOpenChange }: Props) {
  const { sessions, settings } = useApp();

  const history = useMemo(() => {
    if (!customerId) return [];
    return sessions
      .filter((s) => (s.customerId === customerId || `phone:${s.customerPhone}` === customerId) && s.status === "ended")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions, customerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Session History: {customerName}</DialogTitle>
          <DialogDescription className="sr-only">History of sessions for this customer.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-md border border-border/60">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Table</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {history.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {new Date(s.startedAt).toLocaleDateString()} {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2">{s.tableName}</td>
                  <td className="px-4 py-2 tabular-nums">{formatDuration(s.accumulatedMs)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(s.total, settings.currency)}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No sessions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
