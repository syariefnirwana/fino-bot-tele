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
 * Execution strategy: native AsyncFunction first (full modern JS). Some
 * serverless runtimes forbid dynamic code generation; in that case we fall
 * back to the bundled ES5 interpreter (no async/await — use .then()).
 */
import { Interpreter } from "eval5";

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

/** Runs dashboard-authored plugin code and returns the reply text. */
export async function runPluginCode(code: string, ctx: PluginSandboxCtx): Promise<string> {
  const sandbox = buildSandbox(ctx);
  const names = Object.keys(sandbox);
  const values = names.map((n) => sandbox[n]);

  let result: unknown;
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;
    const fn = new AsyncFunction(...names, code);
    result = await fn(...values);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const dynamicCodeBlocked =
      error instanceof EvalError || /code generation|disallowed|unsafe-eval/i.test(message);
    if (!dynamicCodeBlocked) throw error;

    // Fallback: ES5 interpreter (no async/await — return a Promise via .then()).
    const interpreter = new Interpreter(sandbox, { timeout: 8000 });
    result = interpreter.evaluate(`(function(){${code}})()`);
    result = await result;
  }

  if (result === undefined || result === null) return "";
  return typeof result === "string" ? result : JSON.stringify(result);
}
