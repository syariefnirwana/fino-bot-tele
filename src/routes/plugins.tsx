import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { testPluginCode } from "@/lib/plugin-code.functions";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/plugins")({
  head: () => ({
    meta: [
      { title: "Plugins — FINO BOT" },
      {
        name: "description",
        content:
          "Enable, disable and configure FINO BOT plugins: commands, scope, required role and per-plugin settings.",
      },
      { property: "og:title", content: "Plugins — FINO BOT" },
      { property: "og:description", content: "The FINO BOT plugin registry and configuration." },
    ],
  }),
  component: PluginsPage,
});

type Plugin = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  commands: string[];
  enabled: boolean;
  scope: string;
  required_role: string;
  dependencies: string[];
  is_core: boolean;
  usage_count: number;
  code: string | null;
  code_updated_at: string | null;
};

const CODE_TEMPLATE = `// Plugin code runs on the server for every matching command.
// Available: ctx, fetchJson, fetchText, evaluate, env, console
// ctx = { args, command, role, chatId, chatType, chatTitle, telegramId, from, config, plugins }
// Return the reply text (Telegram Markdown).

const name = ctx.args.trim() || ctx.from.first_name || "there";
return "Hello *" + name + "*!";
`;

const CATEGORIES = ["core", "utility", "group", "moderation", "fun", "ai", "media", "admin", "economy"];
const ROLES = ["user", "developer", "moderator", "admin", "owner"];

function PluginsPage() {
  const qc = useQueryClient();
  const { isStaff } = useAuth();
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Plugin | null>(null);
  const [creating, setCreating] = useState(false);

  const { data } = useQuery({
    queryKey: ["plugins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plugins").select("*").order("category").order("name");
      if (error) throw error;
      return data as unknown as Plugin[];
    },
  });

  const plugins = (data ?? []).filter((p) => filter === "all" || p.category === filter);

  async function toggle(p: Plugin, enabled: boolean) {
    const { error } = await supabase.from("plugins").update({ enabled }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${p.name} ${enabled ? "enabled" : "disabled"}`);
    qc.invalidateQueries({ queryKey: ["plugins"] });
  }

  return (
    <AppShell
      title="Plugin registry"
      description="Every bot feature is a plugin row. Disabled plugins are rejected by the runtime."
      actions={
        isStaff ? (
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button size="sm">New plugin</Button>
            </DialogTrigger>
            <PluginDialog
              onDone={() => {
                setCreating(false);
                qc.invalidateQueries({ queryKey: ["plugins"] });
              }}
            />
          </Dialog>
        ) : null
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1 font-mono text-xs uppercase transition-colors ${
              filter === c
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plugins.map((p) => (
          <div key={p.id} className="panel flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  {p.is_core ? (
                    <Badge variant="outline" className="text-[10px] uppercase">
                      core
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-xs text-primary">{p.commands.join("  ")}</p>
              </div>
              <Switch
                checked={p.enabled}
                disabled={!isStaff}
                onCheckedChange={(v) => toggle(p, v)}
              />
            </div>
            <p className="text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-auto flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>
                {p.category} · {p.scope} · {p.required_role}
              </span>
              <span className="font-mono">{p.usage_count} runs</span>
            </div>
            {isStaff ? (
              <Dialog
                open={editing?.id === p.id}
                onOpenChange={(open) => setEditing(open ? p : null)}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </DialogTrigger>
                <PluginDialog
                  plugin={p}
                  onDone={() => {
                    setEditing(null);
                    qc.invalidateQueries({ queryKey: ["plugins"] });
                  }}
                />
              </Dialog>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function PluginDialog({ plugin, onDone }: { plugin?: Plugin; onDone: () => void }) {
  const [form, setForm] = useState({
    key: plugin?.key ?? "",
    name: plugin?.name ?? "",
    description: plugin?.description ?? "",
    category: plugin?.category ?? "utility",
    commands: (plugin?.commands ?? []).join(", "),
    scope: plugin?.scope ?? "all",
    required_role: plugin?.required_role ?? "user",
    dependencies: (plugin?.dependencies ?? []).join(", "),
    code: plugin?.code ?? (plugin ? "" : CODE_TEMPLATE),
  });
  const [busy, setBusy] = useState(false);
  const [testArgs, setTestArgs] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; output: string; ms: number } | null>(null);
  const runTest = useServerFn(testPluginCode);

  async function test() {
    setTesting(true);
    try {
      const res = await runTest({
        data: { code: form.code, args: testArgs, pluginKey: form.key.trim() },
      });
      setResult(res);
    } catch (error) {
      setResult({
        ok: false,
        output: error instanceof Error ? error.message : "Test failed",
        ms: 0,
      });
    }
    setTesting(false);
  }

  async function save() {
    setBusy(true);
    const payload = {
      key: form.key.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      commands: form.commands
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      scope: form.scope,
      required_role: form.required_role as never,
      dependencies: form.dependencies
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    };
    const { error } = plugin
      ? await supabase.from("plugins").update(payload).eq("id", plugin.id)
      : await supabase.from("plugins").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(plugin ? "Plugin updated" : "Plugin created");
    onDone();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{plugin ? `Configure ${plugin.name}` : "New plugin"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Input
              value={form.key}
              disabled={!!plugin}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              placeholder="weather"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Commands (comma separated)</Label>
          <Input
            value={form.commands}
            onChange={(e) => setForm({ ...form, commands: e.target.value })}
            placeholder="/weather, /w"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["all", "private", "group"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Min role</Label>
            <Select
              value={form.required_role}
              onValueChange={(v) => setForm({ ...form, required_role: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Dependencies (plugin keys)</Label>
          <Input
            value={form.dependencies}
            onChange={(e) => setForm({ ...form, dependencies: e.target.value })}
          />
        </div>
        {!plugin ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            A new plugin row is registered but stays in "no runtime handler" state until a handler
            with the same key exists in the bot engine.
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={busy || !form.key || !form.name}>
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
