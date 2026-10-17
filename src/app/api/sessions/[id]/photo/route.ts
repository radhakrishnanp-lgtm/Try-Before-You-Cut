import { HttpError } from "@/lib/auth";
import { handler, json } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { authorizeSession } from "@/lib/session-access";
import { savePhoto, viewSession } from "@/lib/sessions";

export const maxDuration = 30;

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!rateLimit(`photo:${clientIp(req)}`, 30, 60 * 60_000)) throw new HttpError(429, "Too many uploads. Please wait a little.");
  const { session, actor } = await authorizeSession(req, id);
  const bytes = new Uint8Array(await req.arrayBuffer());
  const updated = await savePhoto(session, bytes, actor);
  return json(await viewSession(updated));
});
