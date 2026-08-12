import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error || !data) throw new Error("You need an owner or admin role to do this.");
}

/** Reads the Telegram bot identity using the configured bot token. */
export const getBotIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) return { configured: false as const };
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const json = (await res.json()) as any;
    if (!json.ok) return { configured: true as const, ok: false as const, error: json.description as string };
    const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json() as any);
    return {
      configured: true as const,
      ok: true as const,
      username: json.result.username as string,
      firstName: json.result.first_name as string,
      webhookUrl: (info?.result?.url as string) ?? "",
      pendingUpdates: (info?.result?.pending_update_count as number) ?? 0,
      lastError: (info?.result?.last_error_message as string) ?? "",
    };
  });

/** Registers (or removes) the Telegram webhook for this deployment. */
export const configureWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ url: z.string().url().or(z.literal("")) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    if (!token) throw new Error("The bot token is not configured yet.");

    const { data: settings } = await context.supabase
      .from("bot_settings")
      .select("webhook_secret")
      .limit(1)
      .maybeSingle();

    if (!data.url) {
      const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
      const json = (await res.json()) as any;
      if (!json.ok) throw new Error(json.description ?? "Telegram rejected the request.");
      return { ok: true, removed: true };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: data.url,
        secret_token: settings?.webhook_secret,
        allowed_updates: ["message", "edited_message"],
      }),
    });
    const json = (await res.json()) as any;
    if (!json.ok) throw new Error(json.description ?? "Telegram rejected the request.");
    return { ok: true, removed: false };
  });
