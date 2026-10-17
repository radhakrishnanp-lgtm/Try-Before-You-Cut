export interface ImageInput {
  bytes: Uint8Array;
  mimeType: string;
}

export interface ImageEditRequest {
  image: ImageInput;
  prompt: string;
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
}

export class ProviderError extends Error {
  constructor(public provider: string, message: string, public retryable = true) {
    super(`[${provider}] ${message}`);
  }
}
