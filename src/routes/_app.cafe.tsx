import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Coffee, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/cafe")({
  head: () => ({ meta: [{ title: "Cafe Log — Green Table" }] }),
  component: CafePage,
});

type DailyLog = {
  dateStr: string;
  date: Date;
  revenue: number;
  items: Map<string, { qty: number; revenue: number; category: string }>;
};

function CafePage() {
  const { sessions, settings } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const logs = useMemo(() => {
    let paid = sessions.filter((s) => s.payment === "paid" && s.endedAt);
    
    if (startDate) {
      const sDate = new Date(startDate);
      paid = paid.filter(s => new Date(s.endedAt!) >= sDate);
    }
    if (endDate) {
      const eDate = new Date(endDate);
      eDate.setHours(23, 59, 59, 999);
      paid = paid.filter(s => new Date(s.endedAt!) <= eDate);
    }
    
    // Group by day (YYYY-MM-DD local)
    const grouped = new Map<string, DailyLog>();

    for (const session of paid) {
      const ended = new Date(session.endedAt!);
      const dateStr = ended.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const dateKey = ended.toDateString();

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          dateStr,
          date: new Date(ended.getFullYear(), ended.getMonth(), ended.getDate()),
          revenue: 0,
          items: new Map(),
        });
      }

      const log = grouped.get(dateKey)!;

      for (const extra of session.extras) {
        if (extra.category === "tobacco") continue; // Optionally exclude tobacco. If they consider tobacco as part of the shop, you could include it. But "cafe" usually means beverage/food.

        log.revenue += (extra.price * extra.qty);
        
        if (!log.items.has(extra.name)) {
          log.items.set(extra.name, { qty: 0, revenue: 0, category: extra.category });
        }
        
        const item = log.items.get(extra.name)!;
        item.qty += extra.qty;
        item.revenue += (extra.price * extra.qty);
      }
    }

    // Convert to array and sort descending by date
    return Array.from(grouped.values())
      .filter((l) => l.revenue > 0) // Only show days with actual cafe sales
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sessions, startDate, endDate]);

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    const lower = searchTerm.toLowerCase();
    return logs.map(log => {
      const filteredItems = new Map(
        Array.from(log.items.entries()).filter(([name]) => name.toLowerCase().includes(lower))
      );
      return { ...log, items: filteredItems };
    }).filter(log => log.items.size > 0);
  }, [logs, searchTerm]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Daily Ledger</p>
            <h1 className="font-display text-3xl md:text-4xl">Cafe Log</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track daily cafe sales, items sold, and quantities.
            </p>
          </div>
          <div className="relative w-full md:w-64 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search items..." 
              className="pl-9 bg-background/50 backdrop-blur-sm border-border/60"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-4 bg-muted/20 p-3 rounded-lg border border-border/60 w-fit">
          <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Date Filter</div>
          <div className="flex items-center gap-2">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 w-auto text-sm" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 w-auto text-sm" />
            {(startDate || endDate) && (
              <button className="text-xs text-muted-foreground hover:text-foreground ml-2" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</button>
            )}
          </div>
        </div>
      </header>

      {logs.length === 0 ? (
        <Card className="glass p-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted/50 mb-4">
            <Coffee className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg">No Cafe Sales Yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Complete a session with cafe items to see them here.</p>
        </Card>
      ) : filteredLogs.length === 0 ? (
        <Card className="glass p-12 text-center">
          <h3 className="font-display text-lg">No results found</h3>
          <p className="text-sm text-muted-foreground mt-1">No items match your search for "{searchTerm}".</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {filteredLogs.map((log) => {
            const items = Array.from(log.items.entries()).sort((a, b) => b[1].qty - a[1].qty);
            
            return (
              <Card key={log.date.getTime()} className="glass overflow-hidden">
                <div className="border-b border-border/60 bg-muted/20 px-4 py-4 md:px-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-background shadow-sm border border-border/60">
                      <Coffee className="h-5 w-5 text-neon" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl">{log.dateStr}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{items.length} unique items sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Daily Cafe Revenue</p>
                    <p className="font-display text-2xl text-neon tabular-nums">{formatCurrency(log.revenue, settings.currency)}</p>
                  </div>
                </div>
                
                <div className="p-0 overflow-x-auto">
                  <Table className="min-w-[500px]">
                    <TableHeader className="bg-transparent hover:bg-transparent">
                      <TableRow className="border-border/60 hover:bg-transparent">
                        <TableHead className="w-[40%] md:w-[50%]">Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(([name, data]) => (
                        <TableRow key={name} className="border-border/40 hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-[10px] tracking-wider text-muted-foreground">
                              {data.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{data.qty}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(data.revenue, settings.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
