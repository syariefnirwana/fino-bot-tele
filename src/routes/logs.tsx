import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Activity logs — FINO BOT" },
      {
        name: "description",
        content:
          "Live stream of every Telegram update FINO BOT processes, with level, plugin, latency and trace id.",
      },
      { property: "og:title", content: "Activity logs — FINO BOT" },
      { property: "og:description", content: "Runtime observability for the FINO BOT platform." },
    ],
  }),
  component: LogsPage,
});

const LEVELS = ["all", "info", "warn", "error"] as const;

function LogsPage() {
  const qc = useQueryClient();
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["activity_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("activity_logs_stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        () => qc.invalidateQueries({ queryKey: ["activity_logs"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const rows = (data ?? []).filter((l) => {
    const q = search.toLowerCase();
    return (
      (level === "all" || l.level === level) &&
      (!q ||
        l.message.toLowerCase().includes(q) ||
        (l.command ?? "").toLowerCase().includes(q) ||
        (l.plugin_key ?? "").toLowerCase().includes(q) ||
        (l.trace_id ?? "").includes(q))
    );
  });

  return (
    <AppShell
      title="Activity logs"
      description="Every processed update, newest first. Streams live."
      actions={
        <div className="flex items-center gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded-full border px-3 py-1 font-mono text-xs uppercase ${
                level === l
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {l}
            </button>
          ))}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="filter"
            className="w-44"
          />
        </div>
      }
    >
      <div className="panel divide-y divide-border font-mono text-xs">
        {rows.map((l) => (
          <div key={l.id} className="grid gap-1 px-4 py-2 md:grid-cols-[150px_60px_140px_1fr_90px]">
            <span className="text-muted-foreground">
              {new Date(l.created_at).toLocaleString()}
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
            <span className="truncate text-muted-foreground">
              {l.command ?? l.plugin_key ?? "system"}
            </span>
            <span className="truncate">{l.message}</span>
            <span className="text-right text-muted-foreground">
              {l.duration_ms != null ? `${l.duration_ms}ms` : ""} {l.trace_id ?? ""}
            </span>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-muted-foreground">No log entries match.</p>
        ) : null}
      </div>
    </AppShell>
  );
}
