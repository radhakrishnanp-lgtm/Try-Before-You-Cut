import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.ts";
import { parseToon } from "./toon.ts";

/**
 * Pooled MCP client for Magnific (static bearer token). One connection per
 * server instance; a broken connection is dropped and reopened once.
 */
const g = globalThis as unknown as { __keshkalaMcp?: Promise<Client> | null };

function connect(): Promise<Client> {
  const client = new Client({ name: "keshkala", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.magnificUrl), {
    requestInit: { headers: { authorization: `Bearer ${config.magnificToken}` } },
  });
  return client.connect(transport).then(() => client);
}

async function getClient(): Promise<Client> {
  g.__keshkalaMcp ??= connect().catch((err) => {
    g.__keshkalaMcp = null;
    throw err;
  });
  return g.__keshkalaMcp;
}

export class McpToolError extends Error {
  tool: string;
  constructor(tool: string, message: string) {
    super(`[magnific:${tool}] ${message}`);
    this.tool = tool;
  }
}

export function magnificConfigured(): boolean {
  return Boolean(config.magnificToken);
}

/** Call a tool and return its result parsed as JSON (or `{ text }`). */
export async function callTool<T = Record<string, unknown>>(name: string, args: Record<string, unknown>, timeoutMs = 90_000): Promise<T> {
  if (!magnificConfigured()) throw new McpToolError(name, "MAGNIFIC_MCP_TOKEN is not set");
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    let client: Client;
    try {
      client = await getClient();
    } catch (err) {
      lastErr = err;
      continue;
    }
    try {
      const res = await client.callTool({ name, arguments: args }, undefined, { timeout: timeoutMs });
      const text = (res.content as { type: string; text?: string }[] | undefined)?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n") ?? "";
      if (res.isError) throw new McpToolError(name, text.slice(0, 400) || "tool error");
      if (res.structuredContent) return res.structuredContent as T;
      // Magnific answers in JSON for most tools and TOON for some (e.g. creations_get).
      try {
        return JSON.parse(text) as T;
      } catch {
        try {
          return { ...parseToon(text), text } as T;
        } catch {
          return { text } as T;
        }
      }
    } catch (err) {
      if (err instanceof McpToolError) throw err;
      lastErr = err;
      g.__keshkalaMcp = null; // reconnect on transport failure
    }
  }
  throw new McpToolError(name, lastErr instanceof Error ? lastErr.message : String(lastErr));
}

/** Depth-first search for string values under the given keys in a tool response. */
export function findStrings(obj: unknown, keys: string[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) {
        if (keys.includes(k) && typeof val === "string") out.push(val);
        else if (keys.includes(k) && Array.isArray(val) && val.every((x) => typeof x === "string")) out.push(...(val as string[]));
        else walk(val);
      }
    }
  };
  walk(obj);
  return [...new Set(out)];
}
