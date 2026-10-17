import { config } from "./config.ts";

/**
 * OpenAI-compatible chat client (OpenRouter by default). Same contract as
 * Krish Studio's llm.ts: streaming, reasoning on, and each assistant turn's
 * `reasoning_details` kept and sent back exactly as received.
 */

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
  /** Opaque; never modify. Passed back on later turns. */
  reasoning_details?: unknown[];
}

export interface ChatResult {
  content: string;
  reasoning_details?: unknown[];
  model: string;
}

export class LlmError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function llmConfigured(): boolean {
  return Boolean(config.llmApiKey);
}

const isOpenRouter = () => /openrouter\.ai/.test(config.llmBaseUrl);

/** Model for an agent; images always use the vision model. */
export function modelFor(agent: string, vision = false): string {
  const perAgent = process.env[`LLM_MODEL_${agent.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  if (vision) return config.llmVisionModel ?? perAgent ?? config.llmModel;
  return perAgent ?? config.llmModel;
}

export function dataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

interface Attempt {
  reasoning: boolean;
  passback: boolean;
}

async function request(model: string, messages: ChatMessage[], opts: { json?: boolean; maxTokens?: number }, attempt: Attempt, signal?: AbortSignal): Promise<ChatResult> {
  const stream = isOpenRouter() || config.llmStream;
  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => {
      const { reasoning_details, ...rest } = m;
      return attempt.passback && reasoning_details ? { ...rest, reasoning_details } : rest;
    }),
    stream,
    temperature: 0.2,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    ...(attempt.reasoning && config.llmReasoning && isOpenRouter() ? { reasoning: { enabled: true } } : {}),
  };
  const res = await fetch(`${config.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.llmApiKey}`,
      ...(isOpenRouter() ? { "HTTP-Referer": config.appUrl, "X-Title": "Keshkala" } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmError(res.status, `LLM HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!stream) {
    const json = (await res.json()) as { model?: string; choices?: { message?: { content?: string; reasoning_details?: unknown[] } }[] };
    const msg = json.choices?.[0]?.message;
    return { content: msg?.content ?? "", reasoning_details: msg?.reasoning_details, model: json.model ?? model };
  }

  // Server-sent events: accumulate content and reasoning_details deltas.
  let content = "";
  const reasoning: unknown[] = [];
  let served = model;
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const evt = JSON.parse(data) as {
          model?: string;
          error?: { message?: string; code?: number };
          choices?: { delta?: { content?: string; reasoning_details?: unknown[] } }[];
        };
        if (evt.error) throw new LlmError(evt.error.code ?? 500, `LLM stream error: ${evt.error.message ?? "unknown"}`);
        if (evt.model) served = evt.model;
        const delta = evt.choices?.[0]?.delta;
        if (delta?.content) content += delta.content;
        if (delta?.reasoning_details?.length) reasoning.push(...delta.reasoning_details);
      } catch (err) {
        if (err instanceof LlmError) throw err;
        // Ignore keep-alive comments and partial lines.
      }
    }
  }
  return { content, reasoning_details: reasoning.length ? reasoning : undefined, model: served };
}

/**
 * One chat turn. Retries: 429/5xx twice with backoff; a 400 that mentions
 * reasoning retries without passed-back details, then without reasoning.
 */
export async function chat(input: { agent: string; messages: ChatMessage[]; vision?: boolean; json?: boolean; maxTokens?: number; signal?: AbortSignal }): Promise<ChatResult> {
  if (!llmConfigured()) throw new LlmError(0, "LLM_API_KEY is not set");
  const model = modelFor(input.agent, input.vision);
  let attempt: Attempt = { reasoning: true, passback: true };
  let opts = { json: input.json, maxTokens: input.maxTokens };
  let transient = 0;
  for (;;) {
    try {
      return await request(model, input.messages, opts, attempt, input.signal);
    } catch (err) {
      if (!(err instanceof LlmError)) throw err;
      if ((err.status === 429 || err.status >= 500) && transient < 2) {
        transient++;
        await new Promise((r) => setTimeout(r, 800 * transient));
      } else if (err.status === 400 && /reasoning/i.test(err.message) && (attempt.passback || attempt.reasoning)) {
        attempt = attempt.passback ? { reasoning: true, passback: false } : { reasoning: false, passback: false };
      } else if (err.status === 400 && opts.json && /response_format|json/i.test(err.message)) {
        opts = { ...opts, json: false }; // some hosts reject response_format
      } else {
        throw err;
      }
    }
  }
}

/** Chat that must answer with a JSON object. Tolerates fenced or chatty replies. */
export async function chatJson<T>(input: Parameters<typeof chat>[0]): Promise<T> {
  const res = await chat({ ...input, json: true });
  return parseJsonLoose<T>(res.content);
}

export function parseJsonLoose<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`LLM did not return JSON: ${text.slice(0, 200)}`);
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
