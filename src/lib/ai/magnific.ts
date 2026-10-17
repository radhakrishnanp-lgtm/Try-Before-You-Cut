import { config } from "../config";
import { sniffImage } from "../image-meta";
import { callTool, findStrings, magnificConfigured } from "../mcp/client";
import { ProviderError, type ImageEditProvider, type ImageEditRequest, type ImageEditResult, type ImageInput, type ProviderState } from "./types";

/**
 * Magnific (Freepik) MCP adapter. Each try-on session gets its own Magnific
 * folder; the customer photo is uploaded into it once and used as the image
 * reference for every look. Erasing the session trashes the folder, so
 * nothing outlives our 24h retention on Magnific's side either.
 */

const RATIOS = ["1:1", "4:5", "3:4", "2:3", "9:16", "5:4", "4:3", "3:2", "16:9"] as const;

function nearestRatio(image: ImageInput): string {
  const meta = sniffImage(image.bytes);
  if (!meta) return "3:4";
  const r = meta.width / meta.height;
  let best: string = "3:4";
  let diff = Infinity;
  for (const s of RATIOS) {
    const [w, h] = s.split(":").map(Number);
    const d = Math.abs(Math.log(r / (w / h)));
    if (d < diff) {
      diff = d;
      best = s;
    }
  }
  return best;
}

const first = (obj: unknown, keys: string[]) => findStrings(obj, keys)[0];

export async function createSessionFolder(sessionId: string): Promise<string> {
  const res = await callTool("folders_create", {
    name: `keshkala-${new Date().toISOString().slice(0, 10)}-${sessionId.slice(0, 8)}`,
    ...(config.magnificParentFolder ? { parentReference: config.magnificParentFolder } : {}),
  });
  const ref = first(res, ["reference", "folderReference"]);
  if (!ref) throw new ProviderError("magnific", "folders_create returned no reference");
  return ref;
}

export async function uploadImage(image: ImageInput, folder: string | undefined, fileName: string): Promise<string> {
  const slot = await callTool<{ proxyUploadUrl?: string; path?: string }>("creations_request_upload", { mimeType: image.mimeType });
  if (!slot.proxyUploadUrl || !slot.path) throw new ProviderError("magnific", "no upload slot returned");
  const put = await fetch(slot.proxyUploadUrl, {
    method: "PUT",
    headers: { "content-type": image.mimeType },
    body: Buffer.from(image.bytes),
    signal: AbortSignal.timeout(30_000),
  });
  if (!put.ok) throw new ProviderError("magnific", `upload PUT failed (${put.status})`);
  const done = await callTool("creations_finalize_upload", {
    path: slot.path,
    fileName,
    visible: false,
    ...(folder ? { folderReference: folder } : {}),
  });
  const id = first(done, ["identifier", "creationIdentifier", "identifiers"]) ?? first(done, ["id"]);
  if (!id) throw new ProviderError("magnific", "finalize_upload returned no creation identifier");
  return id;
}

/** Wait for a creation to finish and return its full-resolution URL. */
async function waitForUrl(id: string, deadline: number): Promise<string> {
  while (Date.now() < deadline) {
    const left = Math.max(1, Math.min(50, Math.floor((deadline - Date.now()) / 1000) - 5));
    const res = await callTool("creations_wait", { identifiers: [id], timeoutSeconds: left }, (left + 15) * 1000);
    const statuses = findStrings(res, ["status", "state"]).map((s) => s.toLowerCase());
    if (statuses.some((s) => /fail|error|cancel|reject|moderat/.test(s))) {
      const reason = first(res, ["error", "message", "reason"]);
      throw new ProviderError("magnific", `generation ${statuses.join(",")}${reason ? `: ${reason}` : ""}`, !/moderat|reject/.test(statuses.join()));
    }
    const url = first(res, ["url"]);
    if (url) return url;
    if (statuses.some((s) => /complete|done|ready|success/.test(s))) {
      const full = await callTool("creations_get", { creationIdentifier: id });
      const u = first(full, ["url", "previewUrl"]);
      if (u) return u;
    }
  }
  throw new ProviderError("magnific", "timed out waiting for the image");
}

export const magnificProvider: ImageEditProvider = {
  name: "magnific",
  isConfigured: magnificConfigured,

  async prepare(session, image): Promise<ProviderState["magnific"]> {
    const existing = session.state.magnific?.folder;
    const folder = existing ?? (await createSessionFolder(session.id));
    try {
      const photo = await uploadImage(image, folder, `photo-${session.id.slice(0, 8)}.${image.mimeType.split("/")[1]}`);
      return { folder, photo };
    } catch (err) {
      if (!existing) await callTool("folders_delete", { reference: folder }).catch(() => undefined);
      throw err;
    }
  },

  async edit(req: ImageEditRequest): Promise<ImageEditResult> {
    const deadline = Date.now() + 100_000; // route maxDuration is 120s
    const state = req.session?.state.magnific;
    // Never upload outside a session folder: the folder is what we delete.
    if (!state?.photo || !state.folder) throw new ProviderError("magnific", "session was not prepared (no folder/photo)", false);
    const photo = state.photo;
    const gen = await callTool("images_generate", {
      prompt: req.prompt,
      mode: config.magnificImageModel,
      references: [{ type: "image", identifier: photo }],
      aspectRatio: nearestRatio(req.image),
      count: 1,
      folderReference: state.folder,
    });
    const id = first(gen, ["identifier", "creationIdentifier", "identifiers"]);
    if (!id) throw new ProviderError("magnific", `images_generate returned no identifier: ${JSON.stringify(gen).slice(0, 200)}`);
    const url = await waitForUrl(id, deadline);
    const img = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!img.ok) throw new ProviderError("magnific", `could not download result (${img.status})`);
    return { bytes: new Uint8Array(await img.arrayBuffer()), mimeType: img.headers.get("content-type") ?? "image/jpeg", provider: "magnific" };
  },

  async cleanup(state) {
    if (state.magnific?.folder) await callTool("folders_delete", { reference: state.magnific.folder });
  },
};
