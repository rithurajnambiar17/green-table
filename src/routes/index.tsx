import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleDot, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import hero from "@/assets/snooker-hero.jpg";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Counter Manager" },
      { name: "description", content: "Counter staff sign-in for the snooker and pool club management." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, signIn, signUp, authLoading, settings } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, authLoading, navigate]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await signIn(email, password);
    setBusy(false);
    if (r.ok) { toast.success("Welcome back"); navigate({ to: "/dashboard" }); }
    else toast.error(r.error ?? "Invalid credentials");
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setBusy(true);
    const r = await signUp(email, password, name || email.split("@")[0]);
    setBusy(false);
    if (r.ok) {
      toast.success("Account created — signing you in…");
      const s = await signIn(email, password);
      if (s.ok) navigate({ to: "/dashboard" });
    } else toast.error(r.error ?? "Could not sign up");
  };

  return (
    <div className="relative grid min-h-screen md:grid-cols-2">
      <div className="relative hidden overflow-hidden md:block">
        <img
          src={hero}
          alt="Premium snooker lounge with emerald felt table glowing under warm pendant lamp"
          className="absolute inset-0 h-full w-full object-cover"
          width={1600} height={1024}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/30 to-background/90" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="text-[11px] uppercase tracking-[0.4em] text-neon">{settings.clubName}</p>
          <h1 className="mt-3 max-w-md font-display text-4xl leading-tight">
            A premium counter, built for the perfect break.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Live tables. Automatic billing. Cinematic analytics. Run your snooker &amp; pool floor like a championship hall.
          </p>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6">
        <div className="absolute right-5 top-5"><ThemeToggle /></div>
        <div className="w-full max-w-sm animate-rise space-y-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl felt-surface glow-neon">
              <CircleDot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-display text-2xl leading-none">{settings.clubName}</p>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Counter Manager</p>
            </div>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={onSignIn} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pwd">Password</Label>
                  <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                <Button type="submit" disabled={busy} className="w-full glow-neon">
                  {busy ? "Signing in…" : "Sign in to Counter"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={onSignUp} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sname">Your name</Label>
                  <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Counter Staff" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="semail">Email</Label>
                  <Input id="semail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spwd">Password</Label>
                  <Input id="spwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" disabled={busy} className="w-full glow-neon">
                  {busy ? "Creating…" : "Create account"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  The very first account becomes club admin. All later accounts are staff (an admin can manage them later).
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-neon" /> Secure cloud auth
            </div>
            <p>Your data is stored in the Cloud with row-level security. Sessions sync in real time across devices.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
