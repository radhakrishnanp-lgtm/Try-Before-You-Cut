import { config, isDemo } from "../config.ts";
import { chatJson, dataUrl, llmConfigured } from "../llm.ts";
import { cosineSimilarity } from "./similarity.ts";

export interface Img {
  bytes: Uint8Array;
  mimeType: string;
}

export interface PhotoCheck {
  faceCount: number;
  /** Largest face box as a fraction of image width (0..1), when known. */
  faceWidthRatio: number | null;
  /** Baseline for later comparisons (ArcFace embedding), when the verifier uses one. */
  embedding: number[] | null;
  problems?: string[];
}

export interface IdentityVerdict {
  passed: boolean;
  /** 0..1: cosine similarity (InsightFace) or the vision model's likeness score. */
  similarity: number | null;
  reason?: string;
}

export interface IdentityVerifier {
  readonly name: "insightface" | "llm-vision" | "mock";
  checkPhoto(photo: Img): Promise<PhotoCheck>;
  compare(original: { photo: Img; embedding: number[] | null }, result: Img, styleName: string): Promise<IdentityVerdict>;
}

// ---------------------------------------------------------------- InsightFace
async function analyse(img: Img) {
  const form = new FormData();
  form.append("image", new Blob([img.bytes as BlobPart], { type: img.mimeType }), "image");
  const res = await fetch(`${config.faceServiceUrl!.replace(/\/$/, "")}/analyse`, {
    method: "POST",
    body: form,
    headers: config.faceServiceToken ? { authorization: `Bearer ${config.faceServiceToken}` } : {},
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`face service HTTP ${res.status}`);
  const json = (await res.json()) as { faces: { embedding: number[]; bbox: number[] }[]; width: number };
  const faces = [...json.faces].sort((a, b) => b.bbox[2] - b.bbox[0] - (a.bbox[2] - a.bbox[0]));
  return { faces, width: json.width };
}

const insightface: IdentityVerifier = {
  name: "insightface",
  async checkPhoto(photo) {
    const { faces, width } = await analyse(photo);
    const top = faces[0];
    return { faceCount: faces.length, embedding: top?.embedding ?? null, faceWidthRatio: top ? (top.bbox[2] - top.bbox[0]) / width : null };
  },
  async compare(original, result) {
    if (!original.embedding) return { passed: false, similarity: null, reason: "no baseline face" };
    const { faces } = await analyse(result);
    if (!faces[0]) return { passed: false, similarity: 0, reason: "no face in result" };
    const sim = Math.round(cosineSimilarity(original.embedding, faces[0].embedding) * 1000) / 1000;
    return { passed: sim >= config.identityThreshold, similarity: sim, reason: sim >= config.identityThreshold ? undefined : "face drifted" };
  },
};

// ------------------------------------------------- OpenAI-compatible vision
/** Vision models don't need 2K: send a 1024px JPEG to keep checks fast and cheap. */
async function forVision(i: Img): Promise<Img> {
  try {
    const sharp = (await import("sharp")).default;
    const bytes = await sharp(i.bytes).rotate().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return { bytes: new Uint8Array(bytes), mimeType: "image/jpeg" };
  } catch {
    return i;
  }
}
const img = async (i: Img) => {
  const small = await forVision(i);
  return { type: "image_url" as const, image_url: { url: dataUrl(small.bytes, small.mimeType) } };
};

const llmVision: IdentityVerifier = {
  name: "llm-vision",
  async checkPhoto(photo) {
    const r = await chatJson<{ faceCount?: number; faceWidthRatio?: number; problems?: string[] }>({
      agent: "photo_check",
      vision: true,
      maxTokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You check customer photos for a salon hairstyle preview. Reply with JSON only: " +
            '{"faceCount": number of clearly visible human faces, "faceWidthRatio": width of the largest face divided by image width (0-1), ' +
            '"problems": short customer-friendly fixes, e.g. "Turn to face the camera" or "Hair is cut off at the top"}. ' +
            "Do not describe or judge the person's appearance.",
        },
        { role: "user", content: [await img(photo), { type: "text", text: "Check this photo." }] },
      ],
    });
    return {
      faceCount: Math.max(0, Math.round(Number(r.faceCount ?? 0))),
      faceWidthRatio: typeof r.faceWidthRatio === "number" ? r.faceWidthRatio : null,
      embedding: null,
      problems: Array.isArray(r.problems) ? r.problems.slice(0, 3).map(String) : [],
    };
  },
  async compare(original, result, styleName) {
    const r = await chatJson<{ samePerson?: boolean; likeness?: number; hairChanged?: boolean; faceChanges?: string[] }>({
      agent: "identity_check",
      vision: true,
      maxTokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You verify AI hairstyle previews. Image 1 is the customer's original photo; image 2 is the edited preview. " +
            "Only the hair may change. Judge whether image 2 is still clearly the same person: face shape, eyes, nose, lips, " +
            "skin tone, age and expression must match. Reply with JSON only: " +
            '{"samePerson": boolean, "likeness": 0-1 (1 = identical face), "hairChanged": boolean (the hairstyle visibly changed toward the requested style), ' +
            '"faceChanges": list of any face/skin changes you see}.',
        },
        { role: "user", content: [await img(original.photo), await img(result), { type: "text", text: `Requested style: ${styleName}.` }] },
      ],
    });
    const likeness = Math.max(0, Math.min(1, Number(r.likeness ?? 0)));
    const passed = r.samePerson === true && likeness >= config.llmIdentityThreshold && r.hairChanged !== false;
    return {
      passed,
      similarity: Math.round(likeness * 1000) / 1000,
      reason: passed ? undefined : r.hairChanged === false ? "style not applied" : "face drifted",
    };
  },
};

// ------------------------------------------------------------------ mock
const mock: IdentityVerifier = {
  name: "mock",
  async checkPhoto() {
    return { faceCount: 1, embedding: null, faceWidthRatio: 0.4 };
  },
  async compare() {
    return { passed: true, similarity: 1 };
  },
};

export class IdentityUnavailableError extends Error {
  constructor() {
    super("No identity check configured (FACE_SERVICE_URL or LLM_API_KEY); refusing to generate unverified results.");
  }
}

/**
 * InsightFace when deployed (strongest), otherwise the OpenAI-compatible
 * vision model. The mock is only for demo mode or an explicit bake-off flag.
 */
export function verifier(): IdentityVerifier {
  if (config.faceServiceUrl) return insightface;
  if (llmConfigured()) return llmVision;
  if (isDemo || process.env.ALLOW_UNVERIFIED_RESULTS === "true") return mock;
  throw new IdentityUnavailableError();
}

export function verifierName(): IdentityVerifier["name"] | "none" {
  try {
    return verifier().name;
  } catch {
    return "none";
  }
}

export function usingMockIdentity(): boolean {
  return verifierName() === "mock" || verifierName() === "none";
}
