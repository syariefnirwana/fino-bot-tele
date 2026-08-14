import { createFileRoute } from "@tanstack/react-router";
import type { PluginRow, Role } from "@/lib/bot-engine.server";

/**
 * Telegram webhook receiver.
 * Security: Telegram sends the configured secret in
 * `X-Telegram-Bot-Api-Secret-Token`; it must match `bot_settings.webhook_secret`.
 */
export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const receivedAt = Date.now();
        const traceId = crypto.randomUUID().slice(0, 8);
        const token = process.env["TELEGRAM_BOT_TOKEN"];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const engine = await import("@/lib/bot-engine.server");

        const { data: settings } = await supabaseAdmin
          .from("bot_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        const provided = request.headers.get("x-telegram-bot-api-secret-token");
        if (!settings || !provided || provided !== settings.webhook_secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!token) {
          await engine.log({
            level: "error",
            message: "TELEGRAM_BOT_TOKEN is not configured",
            trace_id: traceId,
          });
          return new Response("ok");
        }

        const update = (await request.json().catch(() => null)) as any;
        const message = update?.message ?? update?.edited_message;
        const chat = message?.chat;
        const from = message?.from;
        if (!chat || !from || typeof message.text !== "string") return new Response("ok");

        const chatId = Number(chat.id);
        const telegramId = Number(from.id);

        // Register / refresh the Telegram user
        const { data: existing } = await supabaseAdmin
          .from("telegram_users")
          .select("*")
          .eq("telegram_id", telegramId)
          .maybeSingle();

        let role: Role = "user";
        if (existing) {
          role = existing.role as Role;
          await supabaseAdmin
            .from("telegram_users")
            .update({
              username: from.username ?? null,
              first_name: from.first_name ?? null,
              last_name: from.last_name ?? null,
              language_code: from.language_code ?? null,
              message_count: existing.message_count + 1,
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (existing.banned) return new Response("ok");
        } else {
          await supabaseAdmin.from("telegram_users").insert({
            telegram_id: telegramId,
            username: from.username ?? null,
            first_name: from.first_name ?? null,
            last_name: from.last_name ?? null,
            language_code: from.language_code ?? null,
            message_count: 1,
          });
        }

        if (chat.type !== "private") {
          const { data: group } = await supabaseAdmin
            .from("telegram_groups")
            .select("*")
            .eq("chat_id", chatId)
            .maybeSingle();
          if (group) {
            if (!group.enabled) return new Response("ok");
            await supabaseAdmin
              .from("telegram_groups")
              .update({
                title: chat.title ?? null,
                message_count: group.message_count + 1,
                last_seen_at: new Date().toISOString(),
              })
              .eq("id", group.id);
          } else {
            await supabaseAdmin.from("telegram_groups").insert({
              chat_id: chatId,
              title: chat.title ?? null,
              chat_type: chat.type,
              message_count: 1,
            });
          }
        }

        const text: string = message.text.trim();
        if (!text.startsWith("/")) return new Response("ok");

        const [rawCommand, ...rest] = text.split(/\s+/);
        const command = rawCommand!.split("@")[0]!.toLowerCase();
        const args = rest.join(" ");

        if (settings.maintenance_mode && role !== "owner" && role !== "admin") {
          await engine.sendMessage(chatId, settings.maintenance_message, token);
          await engine.log({
            level: "warn",
            command,
            chat_id: chatId,
            telegram_id: telegramId,
            message: "Blocked by maintenance mode",
            trace_id: traceId,
          });
          return new Response("ok");
        }

        const { data: pluginRows } = await supabaseAdmin.from("plugins").select("*");
        const plugins = (pluginRows ?? []) as unknown as PluginRow[];
        const plugin = plugins.find((p) => p.commands.includes(command));

        if (!plugin) {
          await engine.sendMessage(chatId, `Unknown command \`${command}\`. Try /help.`, token);
          await engine.log({
            level: "warn",
            command,
            chat_id: chatId,
            telegram_id: telegramId,
            message: "Unknown command",
            trace_id: traceId,
          });
          return new Response("ok");
        }

        const denied = engine.canRun(plugin, { role, chatType: chat.type });
        if (denied) {
          await engine.sendMessage(chatId, denied, token);
          await engine.log({
            level: "warn",
            plugin_key: plugin.key,
            command,
            chat_id: chatId,
            telegram_id: telegramId,
            message: denied,
            trace_id: traceId,
          });
          return new Response("ok");
        }

        const source = (plugin.code ?? "").trim();
        const handler = engine.handlers[plugin.key];
        if (!source && !handler) {
          await engine.sendMessage(
            chatId,
            `Plugin *${plugin.name}* has no code yet. Add it from the dashboard.`,
            token,
          );
          await engine.log({
            level: "error",
            plugin_key: plugin.key,
            command,
            chat_id: chatId,
            telegram_id: telegramId,
            message: "Missing runtime handler",
            trace_id: traceId,
          });
          return new Response("ok");
        }

        try {
          const reply = source
            ? await (await import("@/lib/plugin-runtime.server")).runPluginCode(source, {
                args,
                command,
                role,
                chatId,
                chatType: chat.type,
                chatTitle: chat.title ?? null,
                telegramId,
                from,
                config: (plugin.config ?? {}) as Record<string, unknown>,
                plugins: plugins.map((p) => ({
                  key: p.key,
                  name: p.name,
                  commands: p.commands,
                  enabled: p.enabled,
                })),
              })
            : await handler!({
                chatId,
                chatType: chat.type,
                chatTitle: chat.title ?? null,
                telegramId,
                role,
                args,
                command,
                plugins,
                receivedAt,
                from,
              });
          await engine.sendMessage(chatId, reply, token);
          await supabaseAdmin
            .from("plugins")
            .update({ usage_count: (pluginRows!.find((p) => p.key === plugin.key)!.usage_count ?? 0) + 1 })
            .eq("key", plugin.key);
          await engine.log({
            plugin_key: plugin.key,
            command,
            chat_id: chatId,
            telegram_id: telegramId,
            message: "handled",
            duration_ms: Date.now() - receivedAt,
            trace_id: traceId,
          });
        } catch (error) {
          console.error("[fino] plugin error", error);
          await engine.sendMessage(
            chatId,
            `Something went wrong running that command. Reference: \`${traceId}\``,
            token,
          );
          await engine.log({
            level: "error",
            plugin_key: plugin.key,
            command,
            chat_id: chatId,
            telegram_id: telegramId,
            message: error instanceof Error ? error.message : "Unknown error",
            duration_ms: Date.now() - receivedAt,
            trace_id: traceId,
          });
        }

        return new Response("ok");
      },
    },
  },
});
