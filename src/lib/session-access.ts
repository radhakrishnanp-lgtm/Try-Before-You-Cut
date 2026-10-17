import { HttpError, staffContext } from "./auth";
import { keyedHash, safeEqual } from "./crypto";
import { store } from "./store";
import type { TryOnSession } from "./types";

export const SESSION_HEADER = "x-session-token";

/**
 * A try-on session may be accessed by the customer holding its token, or by
 * a signed-in member of the salon (in-salon studio mode).
 */
export async function authorizeSession(req: Request, sessionId: string): Promise<{ session: TryOnSession; actor: string }> {
  const session = await store.getSession(sessionId);
  if (!session) throw new HttpError(404, "Session not found");
  const token = req.headers.get(SESSION_HEADER);
  if (token && safeEqual(keyedHash(token), session.tokenHash)) {
    assertLive(session);
    return { session, actor: "customer" };
  }
  const ctx = await staffContext();
  const member = ctx?.memberships.find((m) => m.salonId === session.salonId);
  if (member) {
    assertLive(session);
    return { session, actor: `member:${member.id}` };
  }
  throw new HttpError(403, "Not allowed");
}

export function assertLive(session: TryOnSession) {
  if (session.deletedAt || new Date(session.expiresAt) < new Date()) {
    throw new HttpError(410, "This session has expired and its photos were deleted.");
  }
}
