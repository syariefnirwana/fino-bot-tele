import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { configureWebhook, getBotIdentity } from "@/lib/bot-admin.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Bot settings — FINO BOT" },
      {
        name: "description",
        content:
          "Configure the FINO BOT runtime: bot identity, webhook registration, maintenance mode, language and rate limits.",
      },
      { property: "og:title", content: "Bot settings — FINO BOT" },
      { property: "og:description", content: "Runtime configuration for the FINO BOT platform." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const identityFn = useServerFn(getBotIdentity);
  const webhookFn = useServerFn(configureWebhook);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const settings = useQuery({
    queryKey: ["bot_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const identity = useQuery({
    queryKey: ["bot_identity"],
    queryFn: () => identityFn({}),
    enabled: isStaff,
    retry: false,
  });

  const [form, setForm] = useState({
    bot_name: "",
    bot_username: "",
    default_language: "en",
    maintenance_mode: false,
    maintenance_message: "",
    rate_limit_per_minute: 20,
  });

  useEffect(() => {
    if (!settings.data) return;
    setForm({
      bot_name: settings.data.bot_name,
      bot_username: settings.data.bot_username ?? "",
      default_language: settings.data.default_language,
      maintenance_mode: settings.data.maintenance_mode,
      maintenance_message: settings.data.maintenance_message,
      rate_limit_per_minute: settings.data.rate_limit_per_minute,
    });
  }, [settings.data]);

  useEffect(() => {
    if (typeof window !== "undefined" && !webhookUrl) {
      setWebhookUrl(`${window.location.origin}/api/public/telegram/webhook`);
    }
  }, [webhookUrl]);

  async function save() {
    if (!settings.data) return;
    setBusy(true);
    const { error } = await supabase
      .from("bot_settings")
      .update({
        bot_name: form.bot_name,
        bot_username: form.bot_username || null,
        default_language: form.default_language,
        maintenance_mode: form.maintenance_mode,
        maintenance_message: form.maintenance_message,
        rate_limit_per_minute: Number(form.rate_limit_per_minute),
      })
      .eq("id", settings.data.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["bot_settings"] });
  }

  async function connect(remove = false) {
    setBusy(true);
    try {
      await webhookFn({ data: { url: remove ? "" : webhookUrl } });
      toast.success(remove ? "Webhook removed" : "Webhook connected to Telegram");
      identity.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reach Telegram");
    } finally {
      setBusy(false);
    }
  }

  const info = identity.data;

  return (
    <AppShell title="Settings" description="Runtime configuration for the bot and its webhook.">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Telegram connection
            </h2>
            {info?.configured === false ? (
              <Badge className="bg-warning text-warning-foreground">Token missing</Badge>
            ) : info?.ok ? (
              <Badge className="bg-success text-success-foreground">Connected</Badge>
            ) : null}
          </div>

          {info?.configured === false ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              Add your bot token from @BotFather as the backend secret{" "}
              <span className="font-mono">TELEGRAM_BOT_TOKEN</span> to activate the runtime.
            </p>
          ) : null}

          {info?.ok ? (
            <dl className="space-y-1 font-mono text-xs text-muted-foreground">
              <div>bot: @{info.username}</div>
              <div className="truncate">webhook: {info.webhookUrl || "not set"}</div>
              <div>pending updates: {info.pendingUpdates}</div>
              {info.lastError ? <div className="text-destructive">last error: {info.lastError}</div> : null}
            </dl>
          ) : null}

          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Telegram must reach this over HTTPS — use your published domain.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => connect(false)} disabled={!isStaff || busy}>
              Connect webhook
            </Button>
            <Button variant="outline" onClick={() => connect(true)} disabled={!isStaff || busy}>
              Remove
            </Button>
          </div>
        </section>

        <section className="panel space-y-4 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Bot identity & runtime
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Bot name</Label>
              <Input
                value={form.bot_name}
                onChange={(e) => setForm({ ...form, bot_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bot username</Label>
              <Input
                value={form.bot_username}
                placeholder="fino_bot"
                onChange={(e) => setForm({ ...form, bot_username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default language</Label>
              <Input
                value={form.default_language}
                onChange={(e) => setForm({ ...form, default_language: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rate limit / minute</Label>
              <Input
                type="number"
                value={form.rate_limit_per_minute}
                onChange={(e) =>
                  setForm({ ...form, rate_limit_per_minute: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium">Maintenance mode</p>
              <p className="text-xs text-muted-foreground">
                Non-admin commands get the maintenance message instead of running.
              </p>
            </div>
            <Switch
              checked={form.maintenance_mode}
              disabled={!isStaff}
              onCheckedChange={(v) => setForm({ ...form, maintenance_mode: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Maintenance message</Label>
            <Textarea
              value={form.maintenance_message}
              onChange={(e) => setForm({ ...form, maintenance_message: e.target.value })}
            />
          </div>
          <Button onClick={save} disabled={!isStaff || busy}>
            Save settings
          </Button>
          {!isStaff ? (
            <p className="text-xs text-muted-foreground">
              You need the owner or admin role to change these values.
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
