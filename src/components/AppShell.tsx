import { useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, History, Users, BarChart3,
  Settings as SettingsIcon, LogOut, CircleDot, Menu, Package, Banknote, Coffee, BookText
} from "lucide-react";
import { useApp } from "@/lib/store";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const NAV = [
  { to: "/dashboard", label: "Live Tables", icon: LayoutDashboard },
  { to: "/sessions", label: "Sessions", icon: History },
  { to: "/customers", label: "Customers", icon: Users },
  // { to: "/udhari", label: "Udhari", icon: BookText },
  { to: "/inventory", label: "Inventory", icon: Package },
  // { to: "/cafe", label: "Cafe Log", icon: Coffee },
  { to: "/expenses", label: "Expenses", icon: Banknote },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, settings, sessions } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const liveCount = sessions.filter((s) => s.status === "running" || s.status === "paused").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="relative grid h-10 w-10 place-items-center rounded-xl felt-surface glow-neon">
          <CircleDot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="font-display text-lg leading-none tracking-wide">{settings.clubName}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Snooker · Pool</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={[
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--neon)]"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              ].join(" ")}
            >
              <Icon className={["h-4 w-4", active ? "text-neon" : ""].join(" ")} />
              <span className="flex-1">{item.label}</span>
              {item.to === "/dashboard" && liveCount > 0 && (
                <Badge className="bg-primary/90 text-primary-foreground">{liveCount}</Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-semibold">
            {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={async () => {
            await logout();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-xl md:flex">
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-r border-sidebar-border bg-sidebar/95 p-0 backdrop-blur-xl">
          <VisuallyHidden>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Green Table counter menu</SheetDescription>
          </VisuallyHidden>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-5">
            <div className="flex items-center gap-3">
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-neon" />
                </span>
                <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Counter · Live
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </Sheet>
    </div>
  );
}
