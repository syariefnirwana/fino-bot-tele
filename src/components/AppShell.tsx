import type { ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Boxes,
  Users,
  MessagesSquare,
  ScrollText,
  Plug,
  Settings,
  LogOut,
  Bot,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const NAV = [
  { to: "/", label: "Overview", icon: Activity },
  { to: "/plugins", label: "Plugins", icon: Boxes },
  { to: "/users", label: "Users", icon: Users },
  { to: "/groups", label: "Groups", icon: MessagesSquare },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/providers", label: "Providers", icon: Plug },
  { to: "/readme", label: "Readme", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;


export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, roles, loading } = useAuth();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">loading console…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-8 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Bot className="size-5" />
          </span>
          <div>
            <p className="font-mono text-sm font-bold tracking-tight">FINO BOT</p>
            <p className="text-[11px] text-muted-foreground">control plane</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 space-y-3 border-t border-sidebar-border pt-4">
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          <div className="flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="font-mono text-[10px] uppercase">
                {r}
              </Badge>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 px-2"
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs",
                pathname === item.to ? "bg-secondary text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
