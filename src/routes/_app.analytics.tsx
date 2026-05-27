import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import legends from "@/assets/legends-banner.jpg";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Green Table" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { sessions, settings, tables } = useApp();

  const paid = sessions.filter((s) => s.payment === "paid" && s.endedAt);

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const sumIn = (since: Date) => paid.filter((s) => new Date(s.endedAt!) >= since).reduce((a, b) => a + b.total, 0);

  const kpis = [
    { label: "Today", value: sumIn(startOfDay) },
    { label: "This Week", value: sumIn(startOfWeek) },
    { label: "This Month", value: sumIn(startOfMonth) },
    { label: "This Year", value: sumIn(startOfYear) },
  ];

  // Revenue trend last 14 days
  const trend = useMemo(() => {
    const days: { date: string; revenue: number; sessions: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(startOfDay); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const within = paid.filter((s) => {
        const t = new Date(s.endedAt!);
        return t >= d && t < next;
      });
      days.push({
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: within.reduce((a, b) => a + b.total, 0),
        sessions: within.length,
      });
    }
    return days;
  }, [paid, startOfDay]);

  // Peak hours
  const hours = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, sessions: 0 }));
    for (const s of paid) {
      const h = new Date(s.startedAt).getHours();
      buckets[h].sessions += 1;
    }
    return buckets;
  }, [paid]);

  // Top tables
  const tableUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of paid) counts.set(s.tableName, (counts.get(s.tableName) ?? 0) + 1);
    return tables
      .map((t) => ({ name: t.name, sessions: counts.get(t.name) ?? 0, type: t.type }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [paid, tables]);

  // Type split
  const split = useMemo(() => {
    const snooker = paid.filter((s) => s.tableType === "snooker").reduce((a, b) => a + b.total, 0);
    const pool = paid.filter((s) => s.tableType === "pool").reduce((a, b) => a + b.total, 0);
    return [
      { name: "Royal Snooker", value: Math.round(snooker) },
      { name: "Mini Pool", value: Math.round(pool) },
    ];
  }, [paid]);

  const COLORS = ["var(--chart-1)", "var(--chart-3)"];

  return (
    <div className="space-y-8">
      {/* Hero strip */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60">
        <img src={legends} alt="Stylized silhouettes of cue-sport champions under green spotlights" className="h-40 w-full object-cover opacity-70" loading="lazy" width={1600} height={600} />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center p-6 md:p-10">
          <p className="text-[11px] uppercase tracking-[0.35em] text-neon">Insights</p>
          <h1 className="font-display text-3xl md:text-4xl">Business Analytics</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Revenue, traffic and table performance — straight from your live floor.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="glass p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="mt-2 font-display text-3xl text-neon tabular-nums">{formatCurrency(k.value, settings.currency)}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="glass p-5 lg:col-span-2">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Last 14 days</p>
              <h3 className="font-display text-xl">Revenue trend</h3>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -10, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="rv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--neon)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--neon)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} stroke="var(--border)" />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} stroke="var(--border)" />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                  formatter={(v: number) => formatCurrency(v, settings.currency)}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--neon)" strokeWidth={2} fill="url(#rv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Revenue split</p>
          <h3 className="font-display text-xl">Snooker vs Pool</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={split} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {split.map((_, i) => <Cell key={i} fill={COLORS[i]} stroke="var(--background)" strokeWidth={2} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                  formatter={(v: number) => formatCurrency(v, settings.currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="glass p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Traffic</p>
          <h3 className="font-display text-xl">Peak playing hours</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours} margin={{ left: -20, right: 6, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--border)" interval={2} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--border)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Bar dataKey="sessions" radius={[6, 6, 0, 0]} fill="var(--neon)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="glass p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Performance</p>
          <h3 className="mb-3 font-display text-xl">Most-used tables</h3>
          <ul className="space-y-3">
            {tableUsage.map((t, idx) => {
              const max = tableUsage[0]?.sessions || 1;
              const pct = (t.sessions / max) * 100;
              return (
                <li key={t.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">#{idx + 1} {t.name}</span>
                    <span className="tabular-nums text-muted-foreground">{t.sessions} sessions</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: t.type === "snooker" ? "var(--neon)" : "var(--chart-3)",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
