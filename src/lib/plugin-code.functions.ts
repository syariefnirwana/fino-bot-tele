import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Runs plugin code in a sandbox with a simulated Telegram context. Staff only. */
export const testPluginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; args: string; pluginKey?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runPluginCode } = await import("@/lib/plugin-runtime.server");

    const { data: rows } = await supabaseAdmin
      .from("plugins")
      .select("key, name, commands, enabled, config");
    const plugins = (rows ?? []) as Array<{
      key: string;
      name: string;
      commands: string[];
      enabled: boolean;
      config: Record<string, unknown>;
    }>;
    const self = plugins.find((p) => p.key === data.pluginKey);

    const started = Date.now();
    try {
      const output = await runPluginCode(data.code, {
        args: data.args ?? "",
        command: self?.commands?.[0] ?? "/test",
        role: "owner",
        chatId: 0,
        chatType: "private",
        chatTitle: null,
        telegramId: 0,
        from: { first_name: "Tester", username: "tester" },
        config: (self?.config as Record<string, unknown>) ?? {},
        plugins: plugins.map((p) => ({
          key: p.key,
          name: p.name,
          commands: p.commands,
          enabled: p.enabled,
        })),
      });
      return { ok: true as const, output, ms: Date.now() - started };
    } catch (error) {
      return {
        ok: false as const,
        output: error instanceof Error ? error.message : String(error),
        ms: Date.now() - started,
      };
    }
  });

/** Compiles + lints plugin code before saving. Staff only. */
export const validatePluginCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!isStaff) throw new Error("Forbidden");

    const { compilePluginCode, lintPluginCode } = await import("@/lib/plugin-runtime.server");
    try {
      compilePluginCode(data.code);
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
        warnings: [] as string[],
      };
    }
    return { ok: true as const, error: "", warnings: lintPluginCode(data.code) };
  });
