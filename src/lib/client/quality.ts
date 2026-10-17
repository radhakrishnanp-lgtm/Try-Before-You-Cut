"use client";

/**
 * Client-side photo preparation and quality checks. Runs before upload so
 * customers get instant, friendly guidance. The server repeats the hard
 * checks (format, resolution, exactly one face).
 */
export type CheckLevel = "ok" | "warn" | "bad";
export interface QualityCheck {
  id: string;
  level: CheckLevel;
  label: string;
}
export interface QualityReport {
  checks: QualityCheck[];
  blocking: boolean;
  faceDetector: boolean;
}

const MAX_SIDE = 1280;
const MIN_SIDE = 512;
const MEDIAPIPE_VERSION = "1.1.1";

/** Downscale to MAX_SIDE, normalise orientation and strip EXIF by re-encoding. */
export async function prepareImage(source: Blob | HTMLCanvasElement): Promise<{ blob: Blob; canvas: HTMLCanvasElement; original: { w: number; h: number } }> {
  let bitmap: ImageBitmap | HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) bitmap = source;
  else bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const w0 = bitmap.width;
  const h0 = bitmap.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w0 * scale);
  canvas.height = Math.round(h0 * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.9));
  return { blob, canvas, original: { w: w0, h: h0 } };
}

type Detector = { detect(img: HTMLCanvasElement): { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number }; keypoints: { x: number; y: number }[] }[] } };
let detectorPromise: Promise<Detector | null> | null = null;

function loadDetector(): Promise<Detector | null> {
  detectorPromise ??= (async () => {
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`);
      return (await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      })) as unknown as Detector;
    } catch (err) {
      console.warn("face detector unavailable; skipping on-device face checks", err);
      return null;
    }
  })();
  return detectorPromise;
}

/** Warm the detector while the customer reads the consent screen. */
export function preloadDetector() {
  void loadDetector();
}

function luminanceStats(canvas: HTMLCanvasElement) {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, s, s);
  const { data } = ctx.getImageData(0, 0, s, s);
  let sum = 0;
  let sq = 0;
  const n = s * s;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += y;
    sq += y * y;
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
}

export async function checkQuality(canvas: HTMLCanvasElement, original: { w: number; h: number }): Promise<QualityReport> {
  const checks: QualityCheck[] = [];
  const shortSide = Math.min(original.w, original.h);
  checks.push(
    shortSide >= MIN_SIDE
      ? { id: "res", level: "ok", label: "Sharp enough" }
      : { id: "res", level: "bad", label: `Photo is too small (${original.w}×${original.h}). Use the camera or a larger photo.` },
  );

  const { mean, std } = luminanceStats(canvas);
  if (mean < 55) checks.push({ id: "light", level: "bad", label: "Too dark. Face a window or a bright light." });
  else if (mean < 80) checks.push({ id: "light", level: "warn", label: "A little dark. More light gives better results." });
  else if (mean > 215) checks.push({ id: "light", level: "warn", label: "Very bright. Step away from direct light." });
  else checks.push({ id: "light", level: "ok", label: "Good lighting" });
  if (std < 18) checks.push({ id: "contrast", level: "warn", label: "Low contrast. The photo may be blurry or washed out." });

  const detector = await loadDetector();
  if (detector) {
    const { detections } = detector.detect(canvas);
    if (detections.length === 0) {
      checks.push({ id: "face", level: "bad", label: "No face found. Look straight at the camera with your whole head in frame." });
    } else if (detections.length > 1) {
      checks.push({ id: "face", level: "bad", label: "More than one face. Only you should be in the photo." });
    } else {
      const d = detections[0];
      checks.push({ id: "face", level: "ok", label: "One face found" });
      const box = d.boundingBox;
      if (box) {
        const ratio = box.width / canvas.width;
        if (ratio < 0.15) checks.push({ id: "size", level: "bad", label: "Face is too far away. Move closer." });
        else if (ratio > 0.7) checks.push({ id: "size", level: "warn", label: "Very close. Step back so your hair is in the frame." });
        else checks.push({ id: "size", level: "ok", label: "Good distance" });
        if (box.originY < canvas.height * 0.06) checks.push({ id: "top", level: "warn", label: "Top of your head may be cut off. Leave space above your hair." });
      }
      // keypoints: 0 right eye, 1 left eye, 2 nose tip (normalised 0..1)
      const [re, le, nose] = d.keypoints;
      if (re && le && nose) {
        const eyeDist = Math.abs(le.x - re.x) || 1;
        const offset = Math.abs(nose.x - (le.x + re.x) / 2) / eyeDist;
        const tilt = Math.abs(le.y - re.y) / eyeDist;
        if (offset > 0.28 || tilt > 0.25) checks.push({ id: "pose", level: "warn", label: "Turn to face the camera straight on, chin level." });
        else checks.push({ id: "pose", level: "ok", label: "Facing forward" });
      }
    }
  }
  return { checks, blocking: checks.some((c) => c.level === "bad"), faceDetector: Boolean(detector) };
}
