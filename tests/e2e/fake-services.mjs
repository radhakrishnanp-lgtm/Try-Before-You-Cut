// Local stand-ins for Magnific MCP and an OpenAI-compatible LLM, so the full
// pipeline can be exercised without spending credits.
//   node tests/e2e/fake-services.mjs        → MCP on :4010/mcp, LLM on :4011/v1
// Responses mirror shapes captured from the real Magnific server (JSON for
// most tools, TOON text for creations_get). GET :4010/__log returns the calls.
import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const MCP_PORT = 4010;
const LLM_PORT = 4011;
const log = [];
const folders = new Map(); // ref -> Set(creation ids)
const blobs = new Map(); // creation id -> { bytes, mime }
let n = 0;

const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }] });

function tool(name, args) {
  log.push({ name, args });
  switch (name) {
    case "folders_create": {
      const ref = `folder-${++n}`;
      folders.set(ref, new Set());
      return text({ reference: ref, name: args.name, type: "project" });
    }
    case "creations_request_upload": {
      const path = `temp-files/${++n}.jpg`;
      return text({ proxyUploadUrl: `http://localhost:${MCP_PORT}/upload?path=${encodeURIComponent(path)}`, path, mimeType: args.mimeType });
    }
    case "creations_finalize_upload": {
      const id = `up${++n}`;
      blobs.set(id, uploads.get(args.path));
      folders.get(args.folderReference)?.add(id);
      return text({ identifier: id, status: "completed" });
    }
    case "images_generate": {
      if (!args.folderReference || !folders.has(args.folderReference)) return { isError: true, ...text("unknown folder") };
      const src = blobs.get(args.references?.[0]?.identifier);
      if (!src) return { isError: true, ...text("unknown reference") };
      const id = `gen${++n}`;
      blobs.set(id, src); // "edited" = same image
      folders.get(args.folderReference).add(id);
      return text({ creations: [{ identifier: id, status: "queued" }] });
    }
    case "creations_wait":
      return text({
        results: args.identifiers.map((id) => ({ identifier: id, status: "completed", results: { url: `http://localhost:${MCP_PORT}/file/${id}` } })),
        allTerminal: true,
      });
    case "creations_get":
      return text(`identifier: ${args.creationIdentifier}\nstatus: completed\nurl: "http://localhost:${MCP_PORT}/file/${args.creationIdentifier}"`);
    case "folders_delete": {
      const files = folders.get(args.reference);
      folders.delete(args.reference);
      return text({ reference: args.reference, deletedFilesCount: files?.size ?? 0 });
    }
    case "images_models_list":
      return text({ models: [{ slug: "imagen-nano-banana-2-lite", name: "Google Nano Banana 2 Lite" }] });
    default:
      return { isError: true, ...text(`unknown tool ${name}`) };
  }
}

const uploads = new Map();

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${MCP_PORT}`);
    if (url.pathname === "/__log") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ log, folders: [...folders.keys()] }));
    }
    if (url.pathname === "/upload" && req.method === "PUT") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      uploads.set(url.searchParams.get("path"), { bytes: Buffer.concat(chunks), mime: req.headers["content-type"] });
      return res.end('{"success":true}');
    }
    if (url.pathname.startsWith("/file/")) {
      const b = blobs.get(url.pathname.slice(6));
      if (!b) return res.writeHead(404).end();
      res.setHeader("content-type", b.mime);
      return res.end(b.bytes);
    }
    if (url.pathname === "/mcp") {
      if (req.headers.authorization !== "Bearer fake-token") return res.writeHead(401).end("unauthorized");
      const server = new Server({ name: "fake-magnific", version: "1.0.0" }, { capabilities: { tools: {} } });
      server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
      server.setRequestHandler(CallToolRequestSchema, async (r) => tool(r.params.name, r.params.arguments ?? {}));
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => transport.close());
      await server.connect(transport);
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      return transport.handleRequest(req, res, body);
    }
    res.writeHead(404).end();
  })
  .listen(MCP_PORT, () => console.log(`fake magnific mcp on :${MCP_PORT}`));

// OpenAI-compatible LLM: answers the photo and identity checks.
http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    const system = body.messages?.find((m) => m.role === "system")?.content ?? "";
    const images = JSON.stringify(body.messages).match(/image_url/g)?.length ?? 0;
    log.push({ name: "llm", model: body.model, images, stream: body.stream });
    const answer = /verify AI hairstyle previews/.test(system)
      ? { samePerson: true, likeness: 0.92, hairChanged: true, faceChanges: [] }
      : /check customer photos/.test(system)
        ? { faceCount: 1, faceWidthRatio: 0.35, problems: [] }
        : "OK";
    const content = typeof answer === "string" ? answer : JSON.stringify(answer);
    res.setHeader("content-type", "text/event-stream");
    res.write(`data: ${JSON.stringify({ model: body.model, choices: [{ delta: { reasoning_details: [{ type: "reasoning.text", text: "…" }] } }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
    res.end("data: [DONE]\n\n");
  })
  .listen(LLM_PORT, () => console.log(`fake llm on :${LLM_PORT}/v1`));
