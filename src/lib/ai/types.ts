export interface ImageInput {
  bytes: Uint8Array;
  mimeType: string;
}

/** Per-session remote state a provider keeps (e.g. Magnific folder + uploaded photo). */
export interface ProviderState {
  magnific?: { folder?: string; photo?: string };
}

export interface ProviderSession {
  id: string;
  state: ProviderState;
}

export interface ImageEditRequest {
  image: ImageInput;
  prompt: string;
  session?: ProviderSession;
}

export interface ImageEditResult {
  bytes: Uint8Array;
  mimeType: string;
  provider: string;
}

/** Any image-edit backend (Gemini, FLUX Kontext, a future self-hosted model). */
export interface ImageEditProvider {
  readonly name: string;
  isConfigured(): boolean;
  edit(req: ImageEditRequest, signal?: AbortSignal): Promise<ImageEditResult>;
  /** Called once per photo before a round; returns this provider's slice of ProviderState. */
  prepare?(session: ProviderSession, image: ImageInput): Promise<ProviderState[keyof ProviderState]>;
  /** Delete everything the provider stored for the session. Must throw on failure so cleanup retries. */
  cleanup?(state: ProviderState): Promise<void>;
}

export class ProviderError extends Error {
  constructor(public provider: string, message: string, public retryable = true) {
    super(`[${provider}] ${message}`);
  }
}
