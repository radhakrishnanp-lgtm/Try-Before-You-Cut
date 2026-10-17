import { z } from "zod";
import { config } from "@/lib/config";
import { randomToken } from "@/lib/crypto";
import { handler, json } from "@/lib/http";
import { authorizeSession } from "@/lib/session-access";
import { store } from "@/lib/store";

const Body = z.object({ channel: z.enum(["whatsapp", "native", "download", "board", "link"]) });

/** Log a share and return the session's expiring Stylist Board link. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { session, actor } = await authorizeSession(req, id);
  const { channel } = Body.parse(await req.json());
  let token = session.shareToken;
  if (!token) {
    token = randomToken(12);
    await store.updateSession(session.id, { shareToken: token });
  }
  await store.addShareEvent({ sessionId: session.id, salonId: session.salonId, channel });
  await store.logAccess({ salonId: session.salonId, sessionId: session.id, actor, action: `share.${channel}` });
  return json({ shareUrl: `${config.appUrl.replace(/\/$/, "")}/b/${token}` });
});
