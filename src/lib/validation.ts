import { z } from "zod";

export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,39}$/, "3–40 characters: letters, numbers, dot, dash or underscore");
export const Password = z.string().min(8, "Password must be at least 8 characters").max(128);
