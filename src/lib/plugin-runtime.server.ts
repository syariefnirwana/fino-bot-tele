/**
 * FINO BOT — dashboard plugin runtime.
 *
 * Plugin code is stored in the `plugins.code` column and written from the
 * dashboard. The body is executed as a function body with a small sandbox:
 *
 *   ctx        — { args, command, role, chatId, chatType, chatTitle,
 *                  telegramId, from, config, plugins }
 *   fetchJson  — (url, init?) => Promise<any>
 *   fetchText  — (url, init?) => Promise<string>
 *   evaluate   — (mathExpression) => number   (safe arithmetic only)
 *   env        — (secretName) => string | undefined
 *   console
 *
 * Return a string: that becomes the Telegram reply (Markdown).
 *
 * Execution strategy: native AsyncFunction first (fast path in Node/dev). The
 * production Worker forbids dynamic code generation, so we fall back to the
 * bundled `sval` interpreter, which supports modern syntax (const/let, arrow
 * functions, async/await, spread, optional chaining, nullish coalescing).
 */
import Sval from "sval";

export type PluginSandboxCtx = {
  args: string;
  command: string;
  role: string;
  chatId: number;
  chatType: string;
  chatTitle: string | null;
  telegramId: number;
  from: Record<string, unknown>;
  config: Record<string, unknown>;
  plugins: Array<{ key: string; name: string; commands: string[]; enabled: boolean }>;
};

export function evaluateMath(expression: string): number {
  const expr = String(expression).trim();
  if (!/^[0-9+\-*/%.() ]+$/.test(expr)) throw new Error("Only numbers and + - * / % ( ) are allowed");
  const tokens = expr.match(/\d+(\.\d+)?|[+\-*/%()]/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const parseExpr = (): number => {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = tokens[i++];
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = tokens[i++];
      const rhs = parseFactor();
      value = op === "*" ? value * rhs : op === "/" ? value / rhs : value % rhs;
    }
    return value;
  };
  const parseFactor = (): number => {
    if (peek() === "-") {
      i++;
      return -parseFactor();
    }
    if (peek() === "+") {
      i++;
      return parseFactor();
    }
    if (peek() === "(") {
      i++;
      const value = parseExpr();
      if (peek() !== ")") throw new Error("Unbalanced parentheses");
      i++;
      return value;
    }
    const token = tokens[i++];
    const num = Number(token);
    if (!Number.isFinite(num)) throw new Error("Invalid expression");
    return num;
  };
  const result = parseExpr();
  if (i !== tokens.length) throw new Error("Invalid expression");
  return result;
}

function buildSandbox(ctx: PluginSandboxCtx) {
  const fetchJson = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    return (await res.json()) as unknown;
  };
  const fetchText = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    return await res.text();
  };
  return {
    ctx,
    fetchJson,
    fetchText,
    fetch,
    evaluate: evaluateMath,
    env: (name: string) => process.env[name],
    console,
    JSON,
    Math,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    encodeURIComponent,
    decodeURIComponent,
    isFinite,
    parseInt,
    parseFloat,
    Promise,
    RegExp,
    Error,
  } as Record<string, unknown>;
}

function isDynamicCodeBlocked(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return error instanceof EvalError || /code generation|disallowed|unsafe-eval/i.test(message);
}

/** Builds an interpreted runner for the given code (no eval / new Function). */
function interpret(code: string, sandbox: Record<string, unknown>) {
  const interpreter = new Sval({ ecmaVer: "latest", sandBox: true });
  interpreter.import(sandbox);
  interpreter.run(`exports.__run = async function () {\n${code}\n};`);
  return (interpreter.exports as { __run: () => Promise<unknown> }).__run;
}

/**
 * Compiles plugin code without running it. Throws a syntax error when the
 * code cannot be parsed, so the dashboard can validate before saving.
 */
export function compilePluginCode(code: string): void {
  const sandbox = buildSandbox({
    args: "",
    command: "/test",
    role: "owner",
    chatId: 0,
    chatType: "private",
    chatTitle: null,
    telegramId: 0,
    from: {},
    config: {},
    plugins: [],
  });
  interpret(code, sandbox);
}

/** Static checks that catch the most common plugin mistakes before saving. */
export function lintPluginCode(code: string): string[] {
  const warnings: string[] = [];
  const source = code.trim();
  if (!source) return ["The code is empty — the bot will reply with nothing."];
  if (!/\breturn\b/.test(source)) warnings.push("No `return` found — the bot will reply with nothing.");
  if (/\b(require|import)\s*\(/.test(source))
    warnings.push("`require()` / dynamic `import()` are not available in the sandbox.");
  if (/^\s*import\s+/m.test(source)) warnings.push("`import` statements are not supported — use the provided helpers.");
  if (/\bprocess\.env\b/.test(source)) warnings.push("Use `env(\"NAME\")` instead of `process.env`.");
  if (/\b(window|document|localStorage)\b/.test(source))
    warnings.push("Browser globals are not available — plugin code runs on the server.");
  if (/\bsetInterval\s*\(/.test(source)) warnings.push("`setInterval` will never be cleaned up — avoid it.");
  return warnings;
}

/** Runs dashboard-authored plugin code and returns the reply text. */
export async function runPluginCode(code: string, ctx: PluginSandboxCtx): Promise<string> {
  const sandbox = buildSandbox(ctx);
  const names = Object.keys(sandbox);
  const values = names.map((n) => sandbox[n]);

  let result: unknown;
  let run: (() => Promise<unknown>) | null = null;
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;
    const fn = new AsyncFunction(...names, code);
    run = () => fn(...values);
  } catch (error) {
    if (!isDynamicCodeBlocked(error)) throw error;
    // Fallback: interpreted execution (modern syntax supported, no eval).
    run = interpret(code, sandbox);
  }

  result = await run();

  if (result === undefined || result === null) return "";
  return typeof result === "string" ? result : JSON.stringify(result);
}
