import assert from "node:assert/strict";
import { test } from "node:test";

// Config is read at import time, so set env before loading app modules.
process.env.LLM_API_KEY = "test";
process.env.LLM_BASE_URL = "https://openrouter.ai/api/v1";
const { chat, parseJsonLoose } = await import("../src/lib/llm.ts");
const { findStrings } = await import("../src/lib/mcp/client.ts");
const { parseToon } = await import("../src/lib/mcp/toon.ts");

// Captured from the real Magnific MCP server (signed tokens shortened).
const CREATIONS_GET = `identifier: gOMYqTKSXO
name: shape-check
tool: upload
status: completed
url: "https://pikaso.cdnpk.net/private/production/1/2.png?token=exp=1~hmac=abc"
previewUrl: "https://pikaso.cdnpk.net/private/production/1/2.png?token=x&w=1024&preview=1"
createdAt: "2026-10-17T16:24:34+00:00"
metadata:
  prompt: shape-check
  width: 64
  height: 64
webUrl: "https://www.magnific.com/app/creation/gOMYqTKSXO"`;

const CREATIONS_WAIT = {
  results: [{ identifier: "gOMYqTKSXO", status: "completed", results: { url: "https://x/full.png", thumbnailUrl: "https://x/thumb.png" } }],
  allTerminal: true,
};

test("parseToon reads Magnific creations_get", () => {
  const t = parseToon(CREATIONS_GET);
  assert.equal(t.identifier, "gOMYqTKSXO");
  assert.equal(t.status, "completed");
  assert.equal(t.url, "https://pikaso.cdnpk.net/private/production/1/2.png?token=exp=1~hmac=abc");
  assert.deepEqual(t.metadata, { prompt: "shape-check", width: 64, height: 64 });
});

test("parseToon handles inline and tabular arrays", () => {
  const t = parseToon("tags[2]: a,b\nitems[2]{id,name}:\n  1,Alpha\n  2,\"Beta, B\"\ncount: 2");
  assert.deepEqual(t.tags, ["a", "b"]);
  assert.deepEqual(t.items, [{ id: 1, name: "Alpha" }, { id: 2, name: "Beta, B" }]);
  assert.equal(t.count, 2);
});

test("findStrings pulls the full-res url and status from creations_wait", () => {
  assert.deepEqual(findStrings(CREATIONS_WAIT, ["url"]), ["https://x/full.png"]);
  assert.deepEqual(findStrings(CREATIONS_WAIT, ["status"]), ["completed"]);
  assert.deepEqual(findStrings({ identifier: "abc", status: "completed" }, ["identifier", "creationIdentifier"]), ["abc"]);
});

test("parseJsonLoose tolerates fences and chatter", () => {
  assert.deepEqual(parseJsonLoose('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('{"samePerson": true, "likeness": 0.9}'), { samePerson: true, likeness: 0.9 });
  assert.throws(() => parseJsonLoose("no json here"));
});

function sse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

test("chat streams, keeps reasoning_details as received, and passes them back", async () => {
  const calls: Record<string, unknown>[] = [];
  const detail = { type: "reasoning.encrypted", data: "opaque==", id: "r1" };
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    calls.push(JSON.parse(String(init.body)));
    return sse([
      { model: "qwen/test", choices: [{ delta: { reasoning_details: [detail] } }] },
      { choices: [{ delta: { content: "Hel" } }] },
      { choices: [{ delta: { content: "lo" } }] },
    ]);
  }) as typeof fetch;
  const r = await chat({ agent: "check", messages: [{ role: "user", content: "hi" }] });
  assert.equal(r.content, "Hello");
  assert.equal(r.model, "qwen/test");
  assert.deepEqual(r.reasoning_details, [detail]);
  assert.equal(calls[0].stream, true);
  assert.deepEqual(calls[0].reasoning, { enabled: true });

  await chat({ agent: "check", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "Hello", reasoning_details: r.reasoning_details }, { role: "user", content: "again" }] });
  const sent = (calls[1].messages as { reasoning_details?: unknown }[])[1];
  assert.deepEqual(sent.reasoning_details, [detail]);
});

test("chat retries a reasoning 400 without passback, then without reasoning", async () => {
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body));
    bodies.push(b);
    if (b.reasoning) return new Response('{"error":"reasoning not supported"}', { status: 400 });
    return sse([{ choices: [{ delta: { content: "ok" } }] }]);
  }) as typeof fetch;
  const r = await chat({ agent: "check", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "x", reasoning_details: [{ a: 1 }] }] });
  assert.equal(r.content, "ok");
  assert.equal(bodies.length, 3);
  assert.ok((bodies[0].messages as { reasoning_details?: unknown }[])[1].reasoning_details);
  assert.equal((bodies[1].messages as { reasoning_details?: unknown }[])[1].reasoning_details, undefined);
  assert.equal(bodies[2].reasoning, undefined);
});
