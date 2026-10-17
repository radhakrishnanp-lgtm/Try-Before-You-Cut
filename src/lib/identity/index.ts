import { config, isDemo } from "../config.ts";
import { cosineSimilarity } from "./similarity.ts";

export interface FaceAnalysis {
  faceCount: number;
  /** Embedding of the largest face, if any. */
  embedding: number[] | null;
  /** Largest face box as a fraction of image width (0..1). */
  faceWidthRatio: number | null;
}

export interface IdentityVerifier {
  readonly name: string;
  analyse(bytes: Uint8Array, mimeType: string): Promise<FaceAnalysis>;
}

/**
 * Talks to the face-embedding microservice in services/face-embed
 * (InsightFace buffalo_l / ArcFace, MIT-licensed code; check model licence
 * for your deployment).
 */
const httpVerifier: IdentityVerifier = {
  name: "insightface",
  async analyse(bytes, mimeType) {
    const form = new FormData();
    form.append("image", new Blob([bytes as BlobPart], { type: mimeType }), "image");
    const res = await fetch(`${config.faceServiceUrl!.replace(/\/$/, "")}/analyse`, {
      method: "POST",
      body: form,
      headers: config.faceServiceToken ? { authorization: `Bearer ${config.faceServiceToken}` } : {},
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`face service HTTP ${res.status}`);
    const json = (await res.json()) as { faces: { embedding: number[]; bbox: number[] }[]; width: number };
    const faces = [...json.faces].sort((a, b) => b.bbox[2] - b.bbox[0] - (a.bbox[2] - a.bbox[0]));
    const top = faces[0];
    return {
      faceCount: faces.length,
      embedding: top?.embedding ?? null,
      faceWidthRatio: top ? (top.bbox[2] - top.bbox[0]) / json.width : null,
    };
  },
};

/** Dev/demo verifier: assumes one face and a perfect match. */
const mockVerifier: IdentityVerifier = {
  name: "mock",
  async analyse() {
    return { faceCount: 1, embedding: [1, 0, 0, 0], faceWidthRatio: 0.4 };
  },
};

/**
 * The identity check is mandatory outside demo mode. ALLOW_UNVERIFIED_RESULTS
 * exists only for an internal provider bake-off, never for customer traffic.
 */
export function verifier(): IdentityVerifier {
  if (config.faceServiceUrl) return httpVerifier;
  if (isDemo || process.env.ALLOW_UNVERIFIED_RESULTS === "true") return mockVerifier;
  throw new IdentityUnavailableError();
}

export class IdentityUnavailableError extends Error {
  constructor() {
    super("FACE_SERVICE_URL is not configured; refusing to generate unverified results.");
  }
}

export function usingMockIdentity(): boolean {
  return !config.faceServiceUrl;
}

export interface IdentityVerdict {
  passed: boolean;
  similarity: number | null;
  reason?: string;
}

export function compareIdentity(original: number[] | null, result: FaceAnalysis): IdentityVerdict {
  if (!original) return { passed: false, similarity: null, reason: "no baseline face" };
  if (result.faceCount === 0 || !result.embedding) return { passed: false, similarity: 0, reason: "no face in result" };
  const similarity = cosineSimilarity(original, result.embedding);
  return {
    passed: similarity >= config.identityThreshold,
    similarity: Math.round(similarity * 1000) / 1000,
    reason: similarity >= config.identityThreshold ? undefined : "face drifted",
  };
}
