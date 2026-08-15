export type PluginTemplate = {
  id: string;
  label: string;
  description: string;
  code: string;
};

export const PLUGIN_TEMPLATES: PluginTemplate[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Minimal starter that echoes a greeting.",
    code: `// Plugin code runs on the server for every matching command.
// Available: ctx, fetchJson, fetchText, evaluate, env, console
// ctx = { args, command, role, chatId, chatType, chatTitle, telegramId, from, config, plugins }
// Return the reply text (Telegram Markdown).

const name = ctx.args.trim() || ctx.from.first_name || "there";
return "Hello *" + name + "*!";
`,
  },
  {
    id: "api-fetch",
    label: "API fetch",
    description: "Call an external JSON API with fetchJson and format the result.",
    code: `// API fetch template — reads a public JSON endpoint.
// Configure a base URL from the plugin config: { "base_url": "https://api.example.com" }

const base = ctx.config.base_url || "https://api.github.com";
const query = ctx.args.trim();
if (!query) return "Usage: " + ctx.command + " <search term>";

try {
  const data = await fetchJson(base + "/search/repositories?per_page=3&q=" + encodeURIComponent(query));
  const items = data.items || [];
  if (!items.length) return "No results for *" + query + "*.";

  return items
    .map((r, i) => (i + 1) + ". *" + r.full_name + "* — " + (r.description || "no description"))
    .join("\\n");
} catch (e) {
  return "Upstream request failed: " + e.message;
}
`,
  },
  {
    id: "command-parser",
    label: "Command parser",
    description: "Parse subcommands, flags (--key=value) and positional arguments.",
    code: `// Command parser template — supports subcommands and --flags.
// Example: /task add --priority=high buy milk

const tokens = ctx.args.trim().split(/\\s+/).filter(Boolean);
const sub = (tokens.shift() || "help").toLowerCase();

const flags = {};
const words = [];
for (const t of tokens) {
  if (t.startsWith("--")) {
    const [k, v] = t.slice(2).split("=");
    flags[k] = v === undefined ? true : v;
  } else {
    words.push(t);
  }
}
const rest = words.join(" ");

switch (sub) {
  case "add":
    if (!rest) return "Nothing to add. Try: " + ctx.command + " add --priority=high buy milk";
    return "Added *" + rest + "* (priority: " + (flags.priority || "normal") + ")";
  case "list":
    return "No items yet. Add one with " + ctx.command + " add <text>";
  default:
    return [
      "*Usage*",
      ctx.command + " add <text> [--priority=high]",
      ctx.command + " list",
    ].join("\\n");
}
`,
  },
  {
    id: "role-gated",
    label: "Role gated",
    description: "Restrict sensitive actions to admins/owners at runtime.",
    code: `// Role-gated template — checks ctx.role before doing anything sensitive.
// Roles, lowest to highest: user, developer, moderator, admin, owner
// Tip: also set "Min role" on the plugin so the runtime blocks it earlier.

const RANK = { user: 0, developer: 1, moderator: 2, admin: 3, owner: 4 };
const required = ctx.config.min_role || "admin";

if ((RANK[ctx.role] ?? 0) < (RANK[required] ?? 4)) {
  return "⛔ This command requires the *" + required + "* role. You are *" + ctx.role + "*.";
}

const target = ctx.args.trim();
if (!target) return "Usage: " + ctx.command + " <target>";

return "✅ Action executed on *" + target + "* by " + (ctx.from.username || ctx.from.first_name || ctx.telegramId);
`,
  },
  {
    id: "group-tools",
    label: "Group utility",
    description: "Behaves differently in groups vs private chats.",
    code: `// Group utility template — chat-aware behaviour.

if (ctx.chatType === "private") {
  return "This command is meant for groups. Add me to a group and try again.";
}

const enabled = ctx.plugins.filter((p) => p.enabled).length;
return [
  "*" + (ctx.chatTitle || "This group") + "*",
  "Chat ID: \`" + ctx.chatId + "\`",
  "Your role: *" + ctx.role + "*",
  "Active plugins: *" + enabled + "*",
].join("\\n");
`,
  },
];
