/**
 * FINO BOT — plugin dispatch engine.
 * Runs inside the Telegram webhook route. Every plugin is a handler keyed by
 * its `key` column in the `plugins` table; the row controls enable/disable,
 * scope, required role and config.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TELEGRAM_API = "https://api.telegram.org/bot";

export type Role = "owner" | "admin" | "moderator" | "developer" | "user";

const ROLE_RANK: Record<Role, number> = {
  user: 0,
  developer: 1,
  moderator: 2,
  admin: 3,
  owner: 4,
};

export type PluginRow = {
  key: string;
  name: string;
  description: string;
  category: string;
  commands: string[];
  enabled: boolean;
  scope: string;
  required_role: Role;
  config: Record<string, unknown>;
  dependencies: string[];
};

export type BotContext = {
  chatId: number;
  chatType: string;
  chatTitle: string | null;
  telegramId: number;
  role: Role;
  args: string;
  command: string;
  plugins: PluginRow[];
  receivedAt: number;
  from: { username?: string; first_name?: string; last_name?: string };
};

type Handler = (ctx: BotContext) => Promise<string>;

export const handlers: Record<string, Handler> = {
  start: async (ctx) =>
    `*FINO BOT* online.\n\nHi ${ctx.from.first_name ?? "there"} — you are registered as \`${ctx.role}\`.\nSend /help to see everything you can run.`,

  help: async (ctx) => {
    const usable = ctx.plugins.filter(
      (p) =>
        p.enabled &&
        ROLE_RANK[ctx.role] >= ROLE_RANK[p.required_role] &&
        (p.scope === "all" ||
          (p.scope === "group" && ctx.chatType !== "private") ||
          (p.scope === "private" && ctx.chatType === "private")),
    );
    const byCategory = new Map<string, string[]>();
    for (const p of usable) {
      const list = byCategory.get(p.category) ?? [];
      list.push(`${p.commands.join(", ")} — ${p.description}`);
      byCategory.set(p.category, list);
    }
    const body = [...byCategory.entries()]
      .map(([cat, lines]) => `*${cat.toUpperCase()}*\n${lines.join("\n")}`)
      .join("\n\n");
    return body || "No plugins are enabled right now.";
  },

  ping: async (ctx) => `pong — ${Date.now() - ctx.receivedAt}ms processing time`,

  whoami: async (ctx) =>
    `telegram id: \`${ctx.telegramId}\`\nchat id: \`${ctx.chatId}\`\nchat type: \`${ctx.chatType}\`\nrole: \`${ctx.role}\``,

  echo: async (ctx) => ctx.args || "Usage: /echo <text>",

  chatinfo: async (ctx) =>
    `*${ctx.chatTitle ?? "This chat"}*\nid: \`${ctx.chatId}\`\ntype: \`${ctx.chatType}\``,

  roll: async (ctx) => {
    const match = /^(\d{0,2})d(\d{1,3})$/.exec(ctx.args.trim() || "1d6");
    if (!match) return "Usage: /roll 2d20";
    const count = Math.min(Math.max(parseInt(match[1] || "1", 10) || 1, 1), 20);
    const sides = Math.min(Math.max(parseInt(match[2]!, 10), 2), 1000);
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    return `🎲 ${rolls.join(" + ")} = *${rolls.reduce((a, b) => a + b, 0)}*`;
  },

  /**
   * EXAMPLE PLUGIN 1 — pure logic, no external service.
   * Row in `plugins`: key = "calc", commands = ["/calc"].
   */
  calc: async (ctx) => {
    const expr = ctx.args.trim();
    if (!expr) return "Usage: /calc 12 * (3 + 4)";
    if (!/^[0-9+\-*/%.() ]+$/.test(expr)) return "Only numbers and + - * / % ( ) are allowed.";
    try {
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict";return (${expr})`)() as unknown;
      if (typeof value !== "number" || !Number.isFinite(value)) return "That is not a valid expression.";
      return `\`${expr}\` = *${value}*`;
    } catch {
      return "Could not parse that expression.";
    }
  },

  /**
   * EXAMPLE PLUGIN 2 — external API + per-plugin config.
   * Reads `config.default_city` from the plugin row, so the operator can
   * change behaviour from the dashboard without touching code.
   */
  weather: async (ctx) => {
    const row = ctx.plugins.find((p) => p.key === "weather");
    const city = ctx.args.trim() || String(row?.config?.["default_city"] ?? "Jakarta");
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`,
    ).then((r) => r.json() as Promise<any>);
    const place = geo?.results?.[0];
    if (!place) return `Could not find *${city}*.`;
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,wind_speed_10m`,
    ).then((r) => r.json() as Promise<any>);
    const cur = wx?.current;
    if (!cur) return "Weather service is unavailable right now.";
    return `*${place.name}, ${place.country}*\ntemp: ${cur.temperature_2m}°C\nwind: ${cur.wind_speed_10m} km/h`;
  },

  stats: async () => {
    const [users, groups, logs, plugins] = await Promise.all([
      supabaseAdmin.from("telegram_users").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("telegram_groups").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("activity_logs").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("plugins").select("id", { count: "exact", head: true }).eq("enabled", true),
    ]);
    return `*FINO BOT stats*\nusers: ${users.count ?? 0}\ngroups: ${groups.count ?? 0}\nevents: ${logs.count ?? 0}\nenabled plugins: ${plugins.count ?? 0}`;
  },
};

export async function sendMessage(chatId: number, text: string, token: string) {
  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) console.error("[fino] sendMessage failed", await res.text());
}

export async function log(entry: {
  level?: string;
  plugin_key?: string | null;
  command?: string | null;
  telegram_id?: number | null;
  chat_id?: number | null;
  message: string;
  duration_ms?: number | null;
  trace_id?: string | null;
}) {
  const { error } = await supabaseAdmin.from("activity_logs").insert({
    level: entry.level ?? "info",
    plugin_key: entry.plugin_key ?? null,
    command: entry.command ?? null,
    telegram_id: entry.telegram_id ?? null,
    chat_id: entry.chat_id ?? null,
    message: entry.message,
    duration_ms: entry.duration_ms ?? null,
    trace_id: entry.trace_id ?? null,
  });
  if (error) console.error("[fino] log failed", error.message);
}

export function canRun(plugin: PluginRow, ctx: { role: Role; chatType: string }) {
  if (!plugin.enabled) return "This plugin is disabled.";
  if (ROLE_RANK[ctx.role] < ROLE_RANK[plugin.required_role])
    return `This command requires the \`${plugin.required_role}\` role.`;
  if (plugin.scope === "group" && ctx.chatType === "private")
    return "This command only works inside a group.";
  if (plugin.scope === "private" && ctx.chatType !== "private")
    return "This command only works in a private chat.";
  return null;
}
