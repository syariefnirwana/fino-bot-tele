import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/providers")({
  head: () => ({
    meta: [
      { title: "API providers — FINO BOT" },
      {
        name: "description",
        content:
          "Register third-party API providers for FINO BOT plugins, set priority for failover and track which need credentials.",
      },
      { property: "og:title", content: "API providers — FINO BOT" },
      { property: "og:description", content: "Provider registry and failover order for FINO BOT." },
    ],
  }),
  component: ProvidersPage,
});

function ProvidersPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    category: "general",
    base_url: "",
    secret_name: "",
    priority: 100,
  });

  const { data } = useQuery({
    queryKey: ["api_providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_providers")
        .select("*")
        .order("priority");
      if (error) throw error;
      return data;
    },
  });

  async function create() {
    const { error } = await supabase.from("api_providers").insert({
      slug: form.slug.trim(),
      name: form.name.trim(),
      category: form.category.trim() || "general",
      base_url: form.base_url.trim() || null,
      secret_name: form.secret_name.trim() || null,
      priority: Number(form.priority) || 100,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Provider registered");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["api_providers"] });
  }

  async function toggle(id: string, enabled: boolean) {
    const { error } = await supabase.from("api_providers").update({ enabled }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["api_providers"] });
  }

  return (
    <AppShell
      title="API providers"
      description="Providers plugins can call. Credentials are stored as backend secrets, never in this table."
      actions={
        isStaff ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Add provider</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register provider</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                {(
                  [
                    ["slug", "Slug", "openweather"],
                    ["name", "Name", "OpenWeather"],
                    ["category", "Category", "weather"],
                    ["base_url", "Base URL", "https://api.openweathermap.org"],
                    ["secret_name", "Secret name", "OPENWEATHER_API_KEY"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input
                      value={String(form[key])}
                      placeholder={placeholder}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label>Priority (lower runs first)</Label>
                  <Input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create} disabled={!form.slug || !form.name}>
                  Register
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((p) => (
          <div key={p.id} className="panel p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="font-mono text-xs text-muted-foreground">{p.slug}</p>
              </div>
              <Switch
                checked={p.enabled}
                disabled={!isStaff}
                onCheckedChange={(v) => toggle(p.id, v)}
              />
            </div>
            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div>category: {p.category}</div>
              <div className="truncate">endpoint: {p.base_url ?? "—"}</div>
              <div>priority: {p.priority}</div>
              <div>
                credential:{" "}
                {p.secret_name ? (
                  <span className="font-mono text-warning">{p.secret_name} (requires secret)</span>
                ) : (
                  "none required"
                )}
              </div>
            </dl>
          </div>
        ))}
        {data?.length === 0 ? (
          <p className="panel p-10 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            No providers registered yet.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
