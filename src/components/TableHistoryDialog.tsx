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
  tableName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TableHistoryDialog({ tableName, open, onOpenChange }: Props) {
  const { sessions, settings } = useApp();

  const history = useMemo(() => {
    if (!tableName) return [];
    return sessions
      .filter((s) => s.tableName === tableName && s.status === "ended")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [sessions, tableName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Session History: {tableName}</DialogTitle>
          <DialogDescription className="sr-only">History of sessions for this table.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-md border border-border/60">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Player</th>
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
                  <td className="px-4 py-2">{s.customerName}</td>
                  <td className="px-4 py-2 tabular-nums">{formatDuration(s.accumulatedMs)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div className="font-medium">{formatCurrency(s.total, settings.currency)}</div>
                    {(s.extrasTotal > 0 || s.total > 0) && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        (Table: {formatCurrency(s.total - (s.extrasTotal || 0), settings.currency)} 
                        {s.extrasTotal > 0 && ` • Cafe: ${formatCurrency(s.extrasTotal, settings.currency)}`})
                      </div>
                    )}
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
