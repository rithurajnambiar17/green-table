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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Green Table" },
      { name: "description", content: "Counter staff sign-in for Green Table snooker and pool club management." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, login } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@greentable.club");
  const [password, setPassword] = useState("admin123");

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } else {
      toast.error("Invalid credentials");
    }
  };

  return (
    <div className="relative grid min-h-screen md:grid-cols-2">
      {/* Visual */}
      <div className="relative hidden overflow-hidden md:block">
        <img
          src={hero}
          alt="Premium snooker lounge with emerald felt table glowing under warm pendant lamp"
          className="absolute inset-0 h-full w-full object-cover"
          width={1600}
          height={1024}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/30 to-background/90" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="text-[11px] uppercase tracking-[0.4em] text-neon">Green Table</p>
          <h1 className="mt-3 max-w-md font-display text-4xl leading-tight">
            A premium counter, built for the perfect break.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Live tables. Automatic billing. Cinematic analytics. Run your snooker &amp; pool floor like a championship hall.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="relative flex items-center justify-center p-6">
        <div className="absolute right-5 top-5"><ThemeToggle /></div>
        <form onSubmit={submit} className="w-full max-w-sm animate-rise space-y-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl felt-surface glow-neon">
              <CircleDot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-display text-2xl leading-none">Green Table</p>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Counter Manager</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd">Password</Label>
              <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <Button type="submit" className="w-full glow-neon">Sign in to Counter</Button>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-neon" /> Demo accounts
            </div>
            <p>admin@greentable.club / admin123</p>
            <p>staff@greentable.club / staff123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
