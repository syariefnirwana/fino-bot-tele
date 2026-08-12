import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Boxes, MessagesSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FINO BOT — Telegram Plugin Platform Console" },
      {
        name: "description",
        content:
          "Operate FINO BOT: plugin registry, Telegram users and groups, live activity logs, providers and webhook configuration in one console.",
      },
      { property: "og:title", content: "FINO BOT — Telegram Plugin Platform Console" },
      {
        property: "og:description",
        content:
          "A modular Telegram bot operating system with a plugin registry, roles and a live operations dashboard.",
      },
    ],
  }),
  component: Overview,
});

function useCount(table: "telegram_users" | "telegram_groups" | "activity_logs" | "plugins") {
  return useQuery({
    queryKey: ["count", table],
    queryFn: async () => {
      const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function Overview() {
  const users = useCount("telegram_users");
  const groups = useCount("telegram_groups");
  const events = useCount("activity_logs");
  const plugins = useQuery({
    queryKey: ["plugins", "overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plugins")
        .select("key,name,enabled,category,usage_count")
        .order("usage_count", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const logs = useQuery({
    queryKey: ["logs", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });
  const settings = useQuery({
    queryKey: ["bot_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const enabled = (plugins.data ?? []).filter((p) => p.enabled).length;

  const stats = [
    { label: "Telegram users", value: users.data ?? 0, icon: Users },
    { label: "Groups", value: groups.data ?? 0, icon: MessagesSquare },
    { label: "Enabled plugins", value: `${enabled}/${plugins.data?.length ?? 0}`, icon: Boxes },
    { label: "Processed events", value: events.data ?? 0, icon: Activity },
  ];

  return (
    <AppShell
      title="Overview"
      description="Live state of the FINO BOT runtime."
      actions={
        settings.data?.maintenance_mode ? (
          <Badge className="bg-warning text-warning-foreground">Maintenance mode</Badge>
        ) : (
          <Badge className="bg-success text-success-foreground">Runtime active</Badge>
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <s.icon className="size-4 text-primary" />
            </div>
            <p className="mt-3 font-mono text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Recent activity
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/logs">All logs</Link>
            </Button>
          </div>
          <div className="space-y-1 font-mono text-xs">
            {(logs.data ?? []).map((l) => (
              <div key={l.id} className="flex gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/60">
                <span className="shrink-0 text-muted-foreground">
                  {new Date(l.created_at).toLocaleTimeString()}
                </span>
                <span
                  className={
                    l.level === "error"
                      ? "text-destructive"
                      : l.level === "warn"
                        ? "text-warning"
                        : "text-primary"
                  }
                >
                  {l.level}
                </span>
                <span className="truncate">
                  {l.command ?? l.plugin_key ?? "system"} — {l.message}
                </span>
              </div>
            ))}
            {logs.data?.length === 0 ? (
              <p className="px-2 py-6 text-center text-muted-foreground">
                No traffic yet. Connect the webhook in Settings, then message your bot.
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Top plugins
          </h2>
          <div className="space-y-2">
            {(plugins.data ?? []).slice(0, 8).map((p) => (
              <div key={p.key} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className={`size-1.5 rounded-full ${p.enabled ? "bg-success" : "bg-muted-foreground"}`}
                  />
                  {p.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{p.usage_count}</span>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full">
            <Link to="/plugins">Manage plugins</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
