import { config } from "../config.ts";
import { ProviderError, type ImageEditProvider, type ImageEditRequest, type ImageEditResult } from "./types.ts";

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get: string };
}

/** FLUX.1 Kontext Pro via Replicate. Fallback provider. */
export const fluxProvider: ImageEditProvider = {
  name: "flux",
  isConfigured: () => Boolean(config.replicateToken),
  async edit(req: ImageEditRequest, signal?: AbortSignal): Promise<ImageEditResult> {
    const headers = {
      authorization: `Bearer ${config.replicateToken}`,
      "content-type": "application/json",
    };
    const dataUri = `data:${req.image.mimeType};base64,${Buffer.from(req.image.bytes).toString("base64")}`;
    const res = await fetch(`https://api.replicate.com/v1/models/${config.fluxModel}/predictions`, {
      method: "POST",
      signal,
      headers: { ...headers, prefer: "wait=50" },
      body: JSON.stringify({
        input: {
          prompt: req.prompt,
          input_image: dataUri,
          aspect_ratio: "match_input_image",
          output_format: "jpg",
          safety_tolerance: 2,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError("flux", `HTTP ${res.status}: ${body.slice(0, 300)}`, res.status >= 500 || res.status === 429);
    }
    let pred = (await res.json()) as Prediction;
    // `Prefer: wait` usually returns a finished prediction; poll briefly if not.
    for (let i = 0; i < 20 && (pred.status === "starting" || pred.status === "processing"); i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const poll = await fetch(pred.urls?.get ?? `https://api.replicate.com/v1/predictions/${pred.id}`, { headers, signal });
      pred = (await poll.json()) as Prediction;
    }
    if (pred.status !== "succeeded" || !pred.output) {
      throw new ProviderError("flux", `prediction ${pred.status}: ${pred.error ?? "no output"}`);
    }
    const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    const img = await fetch(outUrl, { signal });
    if (!img.ok) throw new ProviderError("flux", `could not download output (${img.status})`);
    return {
      bytes: new Uint8Array(await img.arrayBuffer()),
      mimeType: img.headers.get("content-type") ?? "image/jpeg",
      provider: "flux",
    };
  },
};
