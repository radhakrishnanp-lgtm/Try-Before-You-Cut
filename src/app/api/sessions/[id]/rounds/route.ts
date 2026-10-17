import { z } from "zod";
import { handler, json } from "@/lib/http";
import { authorizeSession } from "@/lib/session-access";
import { startRound } from "@/lib/sessions";

const Body = z.object({ styleIds: z.array(z.string()).min(1).max(4) });

/** Reserve credits and create pending results; the client then runs each in parallel. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { session, actor } = await authorizeSession(req, id);
  const { styleIds } = Body.parse(await req.json());
  const results = await startRound(session, styleIds, actor);
  return json({ results: results.map((r) => ({ id: r.id, styleId: r.styleId, status: r.status })) });
});
