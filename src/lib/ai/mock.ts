import type { ImageEditProvider, ImageEditRequest, ImageEditResult } from "./types.ts";

/**
 * Demo provider: returns the original photo after a short delay so the whole
 * flow (progress, grid, compare, share) can be exercised without API keys.
 * The UI labels these results as demo output.
 */
export const mockProvider: ImageEditProvider = {
  name: "mock",
  isConfigured: () => true,
  async edit(req: ImageEditRequest): Promise<ImageEditResult> {
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 2200));
    return { bytes: req.image.bytes, mimeType: req.image.mimeType, provider: "mock" };
  },
};
