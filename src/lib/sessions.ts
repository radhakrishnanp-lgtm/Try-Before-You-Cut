import { cleanupProviders, editImage, prepareProviders, usingMockAi } from "./ai";
import { buildHairPrompt } from "./ai/prompt";
import { HttpError } from "./auth";
import { getPrivate, putPrivate, removePrivate, signedUrl } from "./blob";
import { CONSENT_VERSION, MAX_ROUNDS_PER_SESSION, MAX_STYLES_PER_ROUND, RETENTION_HOURS, config } from "./config";
import { keyedHash, randomToken, sha256 } from "./crypto";
import { usingMockIdentity, verifier } from "./identity";
import { sniffImage } from "./image-meta";
import { consentText } from "./legal";
import { store } from "./store";
import type { Result, Salon, SessionMode, Style, Texture, TryOnSession } from "./types";

const MIN_PHOTO_SIDE = 512;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_IDENTITY_ATTEMPTS = 2; // first try + one auto-retry

export async function stylesForSalon(salon: Salon): Promise<Style[]> {
  const all = await store.listStyles({ salonId: salon.id });
  const disabled = new Set(salon.disabledStyleIds);
  return all.filter((s) => !disabled.has(s.id));
}

export async function startSession(input: {
  salon: Salon;
  mode: SessionMode;
  startedBy: string | null;
  isMinor: boolean;
  guardianConsent: boolean;
  ip: string;
}): Promise<{ session: TryOnSession; token: string }> {
  if (!input.salon.active) throw new HttpError(403, "This salon's try-on is currently paused.");
  if (input.isMinor && !input.guardianConsent) throw new HttpError(400, "A parent or guardian must give consent for under-18s.");
  const token = randomToken();
  const session = await store.createSession({
    salonId: input.salon.id,
    mode: input.mode,
    startedBy: input.startedBy,
    tokenHash: keyedHash(token),
    expiresAt: new Date(Date.now() + RETENTION_HOURS * 3600_000).toISOString(),
  });
  await store.createConsent({
    sessionId: session.id,
    salonId: input.salon.id,
    version: CONSENT_VERSION,
    textHash: sha256(consentText(input.salon.name)),
    isMinor: input.isMinor,
    guardianConsent: input.guardianConsent,
    ipHash: keyedHash(input.ip),
  });
  await store.logAccess({ salonId: input.salon.id, sessionId: session.id, actor: input.startedBy ? `member:${input.startedBy}` : "customer", action: "consent.granted" });
  return { session, token };
}

/** Server-side photo checks; the client runs friendlier checks first. */
export async function savePhoto(session: TryOnSession, bytes: Uint8Array, actor: string): Promise<TryOnSession> {
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new HttpError(413, "That photo is too large. Please use one under 8 MB.");
  const meta = sniffImage(bytes);
  if (!meta) throw new HttpError(415, "Please upload a JPEG, PNG or WebP photo.");
  if (Math.min(meta.width, meta.height) < MIN_PHOTO_SIDE) {
    throw new HttpError(422, `This photo is too small (${meta.width}×${meta.height}). Please use a sharper photo, at least ${MIN_PHOTO_SIDE}px.`);
  }
  let face;
  try {
    face = await verifier().checkPhoto({ bytes, mimeType: meta.mime });
  } catch (err) {
    console.error("face analysis unavailable", err instanceof Error ? err.message : err);
    throw new HttpError(503, "Our photo check is temporarily unavailable. Please try again in a minute.");
  }
  if (face.faceCount === 0) throw new HttpError(422, "We couldn't find a face. Face the camera in good light, with your whole head in the frame.");
  if (face.faceCount > 1) throw new HttpError(422, "We found more than one face. Please make sure only you are in the photo.");
  if (face.faceWidthRatio !== null && face.faceWidthRatio < 0.12) throw new HttpError(422, "Your face is too small in the photo. Move a little closer.");
  if (face.problems?.length) console.info("photo check notes", face.problems);

  if (session.photoKey) {
    // Retake: replace the photo and drop results made from the old one.
    const old = await store.listResults(session.id);
    await removePrivate([session.photoKey, ...old.map((r) => r.imageKey ?? "")]);
    await Promise.all(old.filter((r) => r.imageKey).map((r) => store.updateResult(r.id, { imageKey: null })));
    await store.updateSession(session.id, { chosenResultIds: [] });
  }
  const key = `${session.salonId}/${session.id}/photo-${randomToken(6)}.${meta.mime.split("/")[1]}`;
  await putPrivate(key, bytes, meta.mime);
  await store.logAccess({ salonId: session.salonId, sessionId: session.id, actor, action: "photo.uploaded" });
  // A new photo must be re-uploaded to providers; keep their folders for cleanup.
  const providerState = session.providerState?.magnific
    ? { ...session.providerState, magnific: { folder: session.providerState.magnific.folder } }
    : session.providerState;
  return store.updateSession(session.id, { photoKey: key, photoEmbedding: face.embedding, providerState });
}

export async function startRound(session: TryOnSession, styleIds: string[], actor: string): Promise<Result[]> {
  const ids = [...new Set(styleIds)];
  if (ids.length === 0) throw new HttpError(400, "Pick at least one style.");
  if (ids.length > MAX_STYLES_PER_ROUND) throw new HttpError(400, `Pick up to ${MAX_STYLES_PER_ROUND} styles at a time.`);
  if (!session.photoKey) throw new HttpError(409, "Add a photo first.");
  if (session.rounds >= MAX_ROUNDS_PER_SESSION) throw new HttpError(429, "You've reached the try-on limit for this session. Ask your stylist to start a new one.");

  const salon = await store.getSalon(session.salonId);
  if (!salon) throw new HttpError(404, "Salon not found");
  const allowed = new Set((await stylesForSalon(salon)).map((s) => s.id));
  if (!ids.every((id) => allowed.has(id))) throw new HttpError(400, "One of those styles isn't available at this salon.");

  // Upload the photo to providers that keep remote state (Magnific), once per photo.
  if (!session.providerState?.magnific?.photo) {
    const photo = await getPrivate(session.photoKey);
    if (!photo) throw new HttpError(410, "Your photo is no longer available. Please retake it.");
    const providerState = await prepareProviders({ id: session.id, state: session.providerState ?? {} }, { bytes: photo.bytes, mimeType: photo.mime });
    if (Object.keys(providerState).length) await store.updateSession(session.id, { providerState });
  }

  const cost = ids.length * config.creditsPerImage;
  if (!(await store.reserveCredits(salon.id, cost))) {
    const left = Math.floor(Math.max(0, salon.creditsTotal - salon.creditsUsed) / config.creditsPerImage);
    throw new HttpError(
      402,
      left > 0
        ? `Only ${left} look${left === 1 ? "" : "s"} left on this salon's credits. Pick ${left === 1 ? "one style" : `up to ${left} styles`}.`
        : "This salon has used all of its credits. Please ask the salon team to top up.",
    );
  }
  await store.updateSession(session.id, { rounds: session.rounds + 1 });
  const rows = await store.createResults(ids.map((styleId) => ({ sessionId: session.id, salonId: salon.id, styleId })));
  await store.logAccess({ salonId: salon.id, sessionId: session.id, actor, action: `round.started:${ids.length}:${cost}cr` });
  return rows;
}

/** Generate one result with an identity check and a single strict retry. */
export async function runResult(result: Result, session: TryOnSession, texture: Texture | null): Promise<Result> {
  if (!(await store.claimResult(result.id))) {
    const current = await store.getResult(result.id);
    if (!current) throw new HttpError(404, "Result not found");
    return current;
  }
  const fail = async (message: string, attempts: number) => {
    await store.refundCredits(result.salonId, config.creditsPerImage);
    return store.updateResult(result.id, { status: "failed", error: message, attempts, completedAt: new Date().toISOString() });
  };

  const style = await store.getStyle(result.styleId);
  const photo = session.photoKey ? await getPrivate(session.photoKey) : null;
  if (!style || !photo) return fail("The photo or style is no longer available.", 0);

  let lastSimilarity: number | null = null;
  let lastReason: string | undefined;
  for (let attempt = 1; attempt <= MAX_IDENTITY_ATTEMPTS; attempt++) {
    let edited;
    try {
      edited = await editImage({
        image: { bytes: photo.bytes, mimeType: photo.mime },
        prompt: buildHairPrompt({ stylePrompt: style.prompt, texture, strict: attempt > 1 }),
        session: { id: session.id, state: session.providerState ?? {} },
      });
    } catch (err) {
      console.error("generation failed", result.id, err instanceof Error ? err.message : err);
      return fail("We couldn't create this look right now. Your try-on credit was returned.", attempt);
    }

    const original = { photo: { bytes: photo.bytes, mimeType: photo.mime }, embedding: session.photoEmbedding };
    const verdict = await Promise.resolve()
      .then(() => verifier().compare(original, { bytes: edited.bytes, mimeType: edited.mimeType }, style.name))
      .catch((err) => {
        console.error("identity check failed", err);
        return null;
      });
    if (!verdict) return fail("We couldn't verify this result, so we didn't show it. Your credit was returned.", attempt);
    lastSimilarity = verdict.similarity;
    lastReason = verdict.reason;
    if (verdict.passed) {
      const ext = edited.mimeType.includes("png") ? "png" : edited.mimeType.includes("webp") ? "webp" : "jpg";
      const key = `${session.salonId}/${session.id}/result-${result.id}.${ext}`;
      await putPrivate(key, edited.bytes, edited.mimeType);
      return store.updateResult(result.id, {
        status: "ready", imageKey: key, provider: edited.provider, similarity: verdict.similarity,
        attempts: attempt, error: null, completedAt: new Date().toISOString(),
      });
    }
    console.warn(`identity check failed on ${result.id} attempt ${attempt}: ${verdict.reason} (${verdict.similarity})`);
  }
  await store.updateResult(result.id, { similarity: lastSimilarity });
  return fail(
    lastReason === "style not applied"
      ? "The AI didn't manage this style on your photo, so we didn't show it. Try another style. Your credit was returned."
      : "This look changed your face too much, so we didn't show it. Try another style. Your credit was returned.",
    MAX_IDENTITY_ATTEMPTS,
  );
}

export interface SessionView {
  id: string;
  mode: SessionMode;
  expiresAt: string;
  photoUrl: string | null;
  stylistNote: string | null;
  chosenResultIds: string[];
  shareToken: string | null;
  rounds: number;
  demo: { ai: boolean; identity: boolean };
  results: (Pick<Result, "id" | "styleId" | "status" | "error" | "similarity" | "provider"> & { imageUrl: string | null })[];
}

export async function viewSession(session: TryOnSession): Promise<SessionView> {
  const results = await store.listResults(session.id);
  return {
    id: session.id,
    mode: session.mode,
    expiresAt: session.expiresAt,
    photoUrl: session.photoKey ? await signedUrl(session.photoKey) : null,
    stylistNote: session.stylistNote,
    chosenResultIds: session.chosenResultIds,
    shareToken: session.shareToken,
    rounds: session.rounds,
    demo: { ai: usingMockAi(), identity: usingMockIdentity() },
    results: await Promise.all(
      // Results whose image was removed (photo retaken) are hidden.
      results.filter((r) => !(r.status === "ready" && !r.imageKey)).map(async (r) => ({
        id: r.id, styleId: r.styleId, status: r.status, error: r.error, similarity: r.similarity, provider: r.provider,
        imageUrl: r.imageKey ? await signedUrl(r.imageKey) : null,
      })),
    ),
  };
}

/** Erase all personal data for a session (manual delete or expiry). */
export async function eraseSession(session: TryOnSession, actor: string, reason: "user" | "expiry"): Promise<void> {
  const results = await store.listResults(session.id);
  await removePrivate([session.photoKey ?? "", ...results.map((r) => r.imageKey ?? "")]);
  await Promise.all(results.map((r) => (r.imageKey ? store.updateResult(r.id, { imageKey: null }) : null)));
  await store.updateSession(session.id, {
    photoKey: null, photoEmbedding: null, stylistNote: null, shareToken: null, chosenResultIds: [],
    deletedAt: new Date().toISOString(),
  });
  if (reason === "user") await store.withdrawConsent(session.id);
  await store.logAccess({ salonId: session.salonId, sessionId: session.id, actor, action: reason === "user" ? "data.deleted_by_request" : "data.expired" });
  await eraseRemoteCopies({ ...session, deletedAt: new Date().toISOString() });
}

/**
 * Delete provider copies (Magnific folder). On failure the state is kept and
 * the hourly cleanup retries, so a provider outage never blocks local erasure.
 */
export async function eraseRemoteCopies(session: TryOnSession): Promise<boolean> {
  if (!session.providerState) return true;
  try {
    await cleanupProviders(session.providerState);
    await store.updateSession(session.id, { providerState: null });
    await store.logAccess({ salonId: session.salonId, sessionId: session.id, actor: "system", action: "remote.deleted" });
    return true;
  } catch (err) {
    console.error("remote cleanup failed", session.id, err instanceof Error ? err.message : err);
    await store.logAccess({ salonId: session.salonId, sessionId: session.id, actor: "system", action: "remote.delete_failed" });
    return false;
  }
}
