import { config } from "../config.ts";
import { ProviderError, type ImageEditProvider, type ImageEditRequest, type ImageEditResult } from "./types.ts";

/** Google Gemini image editing ("Nano Banana", gemini-2.5-flash-image). */
export const geminiProvider: ImageEditProvider = {
  name: "gemini",
  isConfigured: () => Boolean(config.geminiKey),
  async edit(req: ImageEditRequest, signal?: AbortSignal): Promise<ImageEditResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-goog-api-key": config.geminiKey! },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: req.image.mimeType, data: Buffer.from(req.image.bytes).toString("base64") } },
              { text: req.prompt },
            ],
          },
        ],
        generationConfig: { responseModalities: ["IMAGE"], temperature: 0.4 },
        safetySettings: [
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError("gemini", `HTTP ${res.status}: ${body.slice(0, 300)}`, res.status >= 500 || res.status === 429);
    }
    const json = (await res.json()) as {
      candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    if (json.promptFeedback?.blockReason) {
      throw new ProviderError("gemini", `blocked: ${json.promptFeedback.blockReason}`, false);
    }
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) {
      throw new ProviderError("gemini", `no image returned (${json.candidates?.[0]?.finishReason ?? "unknown"})`);
    }
    return {
      bytes: new Uint8Array(Buffer.from(part.inlineData.data, "base64")),
      mimeType: part.inlineData.mimeType ?? "image/png",
      provider: "gemini",
    };
  },
};
