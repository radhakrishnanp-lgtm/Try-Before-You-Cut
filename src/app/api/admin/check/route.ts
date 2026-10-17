import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { runCheck } from "@/lib/connection-check";
import { handler, json } from "@/lib/http";

export const maxDuration = 120;

const Body = z.object({ step: z.enum(["llm", "vision", "magnific", "magnific_image", "pipeline"]) });

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const { step } = Body.parse(await req.json());
  return json(await runCheck(step));
});
