import { config, isDemo } from "../config.ts";
import { fluxProvider } from "./flux.ts";
import { geminiProvider } from "./gemini.ts";
import { mockProvider } from "./mock.ts";
import { ProviderError, type ImageEditProvider, type ImageEditRequest, type ImageEditResult } from "./types.ts";

const REGISTRY: Record<string, ImageEditProvider> = {
  gemini: geminiProvider,
  flux: fluxProvider,
  mock: mockProvider,
};

/** Configured providers in priority order. Falls back to mock only in demo/dev. */
export function providerChain(): ImageEditProvider[] {
  const chain = config.aiProviders.map((n) => REGISTRY[n]).filter((p): p is ImageEditProvider => Boolean(p?.isConfigured()));
  if (chain.length === 0 && (isDemo || process.env.NODE_ENV !== "production")) return [mockProvider];
  return chain;
}

export function usingMockAi(): boolean {
  const chain = providerChain();
  return chain.length === 1 && chain[0].name === "mock";
}

/** Try each provider in order until one returns an image. */
export async function editImage(req: ImageEditRequest, opts: { skip?: string[]; signal?: AbortSignal } = {}): Promise<ImageEditResult> {
  const chain = providerChain().filter((p) => !opts.skip?.includes(p.name));
  if (chain.length === 0) throw new ProviderError("none", "no AI provider is configured", false);
  let lastErr: unknown;
  for (const provider of chain) {
    try {
      return await provider.edit(req, opts.signal);
    } catch (err) {
      lastErr = err;
      console.warn(`image provider ${provider.name} failed`, err instanceof Error ? err.message : err);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
