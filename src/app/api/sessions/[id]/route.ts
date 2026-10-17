import { z } from "zod";
import { HttpError } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { authorizeSession } from "@/lib/session-access";
import { eraseSession, viewSession } from "@/lib/sessions";
import { store } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { session, actor } = await authorizeSession(req, id);
  await store.logAccess({ salonId: session.salonId, sessionId: session.id, actor, action: "session.viewed" });
  return json(await viewSession(session));
});

const Patch = z.object({
  stylistNote: z.string().max(500).nullable().optional(),
  chosenResultIds: z.array(z.string()).max(4).optional(),
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { session } = await authorizeSession(req, id);
  const body = Patch.parse(await req.json());
  if (body.chosenResultIds) {
    const ids = new Set((await store.listResults(session.id)).filter((r) => r.status === "ready").map((r) => r.id));
    if (!body.chosenResultIds.every((r) => ids.has(r))) throw new HttpError(400, "Unknown result");
  }
  const updated = await store.updateSession(session.id, {
    ...(body.stylistNote !== undefined ? { stylistNote: body.stylistNote?.trim() || null } : {}),
    ...(body.chosenResultIds ? { chosenResultIds: body.chosenResultIds } : {}),
  });
  return json(await viewSession(updated));
});

/** "Delete my data now": erases photo, results and note; withdraws consent. */
export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const session = await store.getSession(id);
  if (session?.deletedAt) return json({ deleted: true });
  const { session: s, actor } = await authorizeSession(req, id);
  await eraseSession(s, actor, "user");
  return json({ deleted: true });
});
