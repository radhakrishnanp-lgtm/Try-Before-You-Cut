import { z } from "zod";
import { HttpError } from "@/lib/auth";
import { signedUrl } from "@/lib/blob";
import { handler, json } from "@/lib/http";
import { authorizeSession } from "@/lib/session-access";
import { runResult } from "@/lib/sessions";
import { store } from "@/lib/store";

// One serverless invocation per style so results stream in as they finish.
export const maxDuration = 120;

const Body = z.object({ texture: z.enum(["straight", "wavy", "curly"]).nullable().optional() });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const result = await store.getResult(id);
  if (!result) throw new HttpError(404, "Result not found");
  const { session } = await authorizeSession(req, result.sessionId);
  const { texture } = Body.parse(await req.json().catch(() => ({})));
  const done = await runResult(result, session, texture ?? null);
  return json({
    id: done.id, styleId: done.styleId, status: done.status, error: done.error, similarity: done.similarity, provider: done.provider,
    imageUrl: done.imageKey ? await signedUrl(done.imageKey) : null,
  });
});
