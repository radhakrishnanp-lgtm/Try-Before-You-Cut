import { deflateSync } from "node:zlib";
import { providerChain } from "./ai";
import { createSessionFolder } from "./ai/magnific";
import { config } from "./config";
import { verifierName } from "./identity";
import { chat, dataUrl, llmConfigured, modelFor } from "./llm";
import { callTool, findStrings, magnificConfigured } from "./mcp/client";

export type CheckStep = "llm" | "vision" | "magnific" | "magnific_image" | "pipeline";
export interface CheckResult {
  ok: boolean;
  detail: string;
  ms: number;
}

/** A solid 64×64 PNG, built by hand so the vision check needs no image library. */
function solidPng(r: number, g: number, b: number): Uint8Array {
  const w = 64;
  const raw = Buffer.alloc((w * 3 + 1) * w);
  for (let y = 0; y < w; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(w, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return new Uint8Array(
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]),
  );
}

async function step(name: CheckStep): Promise<Omit<CheckResult, "ms">> {
  switch (name) {
    case "llm": {
      if (!llmConfigured()) return { ok: false, detail: "LLM_API_KEY (or OPENROUTER_API_KEY) is not set." };
      const r = await chat({ agent: "check", maxTokens: 20, messages: [{ role: "user", content: "Reply with exactly: OK" }] });
      return { ok: /ok/i.test(r.content), detail: `${r.model} answered "${r.content.trim().slice(0, 40)}"${r.reasoning_details ? " (reasoning on)" : ""}` };
    }
    case "vision": {
      if (!llmConfigured()) return { ok: false, detail: "LLM_API_KEY is not set." };
      const r = await chat({
        agent: "check",
        vision: true,
        maxTokens: 20,
        messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: dataUrl(solidPng(220, 30, 30), "image/png") } }, { type: "text", text: "What colour is this square? One word." }] }],
      });
      return { ok: /red/i.test(r.content), detail: `${modelFor("identity_check", true)} saw "${r.content.trim().slice(0, 40)}"` };
    }
    case "magnific": {
      if (!magnificConfigured()) return { ok: false, detail: "MAGNIFIC_MCP_TOKEN is not set." };
      const res = await callTool("images_models_list", { search: config.magnificImageModel });
      const slugs = findStrings(res, ["slug"]);
      return slugs.includes(config.magnificImageModel)
        ? { ok: true, detail: `Connected to ${config.magnificUrl}; model ${config.magnificImageModel} is available.` }
        : { ok: false, detail: `Connected, but model "${config.magnificImageModel}" was not found. Set MAGNIFIC_IMAGE_MODEL to one of: ${slugs.slice(0, 6).join(", ") || "none returned"}.` };
    }
    case "magnific_image": {
      // Uses Magnific credits: one small text-to-image, in a folder that is trashed afterwards.
      if (!magnificConfigured()) return { ok: false, detail: "MAGNIFIC_MCP_TOKEN is not set." };
      const folder = await createSessionFolder("check0000");
      try {
        const gen = await callTool("images_generate", { prompt: "a pair of silver salon scissors on white marble", mode: config.magnificImageModel, count: 1, aspectRatio: "1:1", folderReference: folder });
        const id = findStrings(gen, ["identifier", "creationIdentifier", "identifiers"])[0];
        if (!id) return { ok: false, detail: "images_generate returned no identifier" };
        const waited = await callTool("creations_wait", { identifiers: [id], timeoutSeconds: 50 }, 70_000);
        const url = findStrings(waited, ["url"])[0];
        return url ? { ok: true, detail: "Generated a test image (folder trashed afterwards)." } : { ok: false, detail: `Still running after 50 s: ${findStrings(waited, ["status"]).join(", ")}` };
      } finally {
        await callTool("folders_delete", { reference: folder }).catch(() => undefined);
      }
    }
    case "pipeline": {
      const chain = providerChain().map((p) => p.name);
      const identity = verifierName();
      const ok = chain.length > 0 && !chain.includes("mock") && identity !== "mock" && identity !== "none";
      return { ok, detail: `Image providers: ${chain.join(" → ") || "none"}. Identity check: ${identity}.` };
    }
  }
}

export async function runCheck(name: CheckStep): Promise<CheckResult> {
  const t = Date.now();
  try {
    return { ...(await step(name)), ms: Date.now() - t };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message.slice(0, 300) : String(err), ms: Date.now() - t };
  }
}
