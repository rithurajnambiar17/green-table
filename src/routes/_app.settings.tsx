import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TableManager } from "@/components/TableManager";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Green Table" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, updateSettings, user, clearData } = useApp();
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Configuration</p>
        <h1 className="font-display text-3xl md:text-4xl">Settings</h1>
      </header>

      {!isAdmin && (
        <Card className="border-warning/40 bg-warning/10 p-4 text-sm">
          You are signed in as <b>staff</b>. Pricing, tax and table management are read-only — ask an admin to edit.
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="glass p-6">
          <h2 className="font-display text-xl">Club</h2>
          <p className="text-sm text-muted-foreground">Branding and contact defaults.</p>
          <div className="mt-4 space-y-3">
            <Field label="Club name">
              <Input value={form.clubName} onChange={(e) => setForm({ ...form, clubName: e.target.value })} disabled={!isAdmin} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency">
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} disabled={!isAdmin} />
              </Field>
              <Field label="WhatsApp country code">
                <Input value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} disabled={!isAdmin} />
              </Field>
            </div>
          </div>
        </Card>

        <Card className="glass p-6">
          <h2 className="font-display text-xl">Pricing</h2>
          <p className="text-sm text-muted-foreground">Hourly rates per table category and tax.</p>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Royal Snooker / hr">
                <Input type="number" value={form.snookerRate} onChange={(e) => setForm({ ...form, snookerRate: +e.target.value || 0 })} disabled={!isAdmin} />
              </Field>
              <Field label="Mini Pool / hr">
                <Input type="number" value={form.poolRate} onChange={(e) => setForm({ ...form, poolRate: +e.target.value || 0 })} disabled={!isAdmin} />
              </Field>
            </div>
            <Field label="Tax rate (%)">
              <Input type="number" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: +e.target.value || 0 })} disabled={!isAdmin} />
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setForm(settings)} disabled={!isAdmin}>Reset</Button>
        <Button
          disabled={!isAdmin}
          onClick={async () => { await updateSettings(form); toast.success("Settings saved"); }}
        >Save changes</Button>
      </div>

      {isAdmin ? (
        <TableManager />
      ) : (
        <Card className="glass p-6">
          <h2 className="font-display text-xl">Tables</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only admins can add, edit or remove tables.</p>
        </Card>
      )}

      {isAdmin && (
        <Card className="glass p-6 mt-6">
          <h2 className="font-display text-xl text-red-600">Data Management</h2>
          <p className="text-sm text-muted-foreground mb-4">Delete all sessions, extras, and customers. This action is irreversible.</p>
          <Button variant="destructive" onClick={async () => {
            if (confirm('Are you sure you want to permanently delete all data? This cannot be undone.')) {
              await clearData();
              toast.success('All data cleared.');
            }
          }}>Clear All Data</Button>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
