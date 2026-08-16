import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { testPluginCode, validatePluginCode } from "@/lib/plugin-code.functions";
import { PLUGIN_TEMPLATES } from "@/lib/plugin-templates";

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
                  {p.code?.trim() ? (
                    <Badge variant="outline" className="border-primary/50 text-[10px] uppercase text-primary">
                      code
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
  const validate = useServerFn(validatePluginCode);

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
    if (form.code.trim()) {
      try {
        const check = await validate({ data: { code: form.code } });
        if (!check.ok) {
          setBusy(false);
          setResult({ ok: false, output: `Syntax error: ${check.error}`, ms: 0 });
          toast.error("Plugin code has a syntax error — fix it before saving.");
          return;
        }
        if (check.warnings.length) {
          setResult({ ok: false, output: check.warnings.map((w: string) => `⚠ ${w}`).join("\n"), ms: 0 });
          toast.warning(check.warnings[0]!);
        }
      } catch (error) {
        setBusy(false);
        toast.error(error instanceof Error ? error.message : "Validation failed");
        return;
      }
    }
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
      code: form.code,
      code_updated_at: form.code.trim() ? new Date().toISOString() : null,
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
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>Plugin code (JavaScript)</Label>
            <span className="font-mono text-[11px] text-muted-foreground">
              ctx · fetchJson · fetchText · evaluate · env
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase text-muted-foreground">Template</span>
            {PLUGIN_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.description}
                onClick={() => {
                  if (
                    form.code.trim() &&
                    !window.confirm("Replace the current code with the " + t.label + " template?")
                  )
                    return;
                  setForm({ ...form, code: t.code });
                }}
                className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {t.label}
              </button>
            ))}
          </div>
          <Textarea
            value={form.code}
            spellCheck={false}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="min-h-[280px] font-mono text-xs leading-relaxed"
            placeholder={CODE_TEMPLATE}
          />
          <p className="text-[11px] text-muted-foreground">
            Runs on the server for every matching command. Return the reply text. Leave empty to use
            the built-in handler with the same key (if any).
          </p>
        </div>

        {plugin ? (
          <PluginHistory
            pluginId={plugin.id}
            onRestore={(code) => setForm((f) => ({ ...f, code }))}
          />
        ) : null}


        <div className="rounded-md border border-border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <Label>Test arguments</Label>
              <Input
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                placeholder="text after the command"
              />
            </div>
            <Button variant="outline" onClick={test} disabled={testing || !form.code.trim()}>
              {testing ? "Running…" : "Run test"}
            </Button>
          </div>
          {result ? (
            <pre
              className={`mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-xs ${
                result.ok
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {result.output || "(empty reply)"}
              {"\n\n"}
              {result.ok ? "✓" : "✗"} {result.ms}ms
            </pre>
          ) : null}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={busy || !form.key || !form.name}>
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

type PluginVersion = {
  id: string;
  version: number;
  code: string;
  commands: string[];
  note: string | null;
  created_at: string;
};

function PluginHistory({
  pluginId,
  onRestore,
}: {
  pluginId: string;
  onRestore: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["plugin-versions", pluginId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plugin_versions")
        .select("id, version, code, commands, note, created_at")
        .eq("plugin_id", pluginId)
        .order("version", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as PluginVersion[];
    },
  });

  const versions = data ?? [];

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <div>
          <Label>Version history</Label>
          <p className="text-[11px] text-muted-foreground">
            A snapshot is saved automatically every time the code or commands change.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show history"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <p className="font-mono text-xs text-muted-foreground">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">No versions yet.</p>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="rounded-md border border-border/70 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-xs">
                    <span className="text-primary">v{v.version}</span>{" "}
                    <span className="text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                    {v.note ? (
                      <span className="ml-2 text-muted-foreground">· {v.note}</span>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreview(preview === v.id ? null : v.id)}
                    >
                      {preview === v.id ? "Hide code" : "Preview"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onRestore(v.code);
                        toast.success(`Restored v${v.version} into the editor — press Save to apply`);
                      }}
                    >
                      Restore
                    </Button>
                  </div>
                </div>
                {preview === v.id ? (
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed">
                    {v.code || "(empty)"}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
