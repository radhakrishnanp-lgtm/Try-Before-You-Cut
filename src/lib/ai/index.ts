import { config, isDemo } from "../config.ts";
import { fluxProvider } from "./flux.ts";
import { geminiProvider } from "./gemini.ts";
import { magnificProvider } from "./magnific";
import { mockProvider } from "./mock.ts";
import { ProviderError, type ImageEditProvider, type ImageEditRequest, type ImageEditResult, type ImageInput, type ProviderSession, type ProviderState } from "./types.ts";

const REGISTRY: Record<string, ImageEditProvider> = {
  magnific: magnificProvider,
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

/**
 * Let providers that keep remote state (Magnific) set up the session before a
 * round. A provider that fails to prepare refuses to edit, so the chain
 * falls through to the next provider.
 */
export async function prepareProviders(session: ProviderSession, image: ImageInput): Promise<ProviderState> {
  const state: ProviderState = { ...session.state };
  for (const p of providerChain()) {
    if (!p.prepare) continue;
    try {
      const slice = await p.prepare({ ...session, state }, image);
      (state as Record<string, unknown>)[p.name] = slice;
    } catch (err) {
      console.warn(`provider ${p.name} prepare failed`, err instanceof Error ? err.message : err);
    }
  }
  return state;
}

/** Remove remote copies for every provider that has state. Throws if any fails. */
export async function cleanupProviders(state: ProviderState | null): Promise<void> {
  if (!state) return;
  for (const p of Object.values(REGISTRY)) {
    if (p.cleanup && (state as Record<string, unknown>)[p.name]) await p.cleanup(state);
  }
}
