import type { PublicSalon, PublicStyle } from "@/lib/public";
import type { SessionView } from "@/lib/sessions";

export type { PublicSalon, PublicStyle, SessionView };
export type ResultView = SessionView["results"][number];
export type Step = "consent" | "capture" | "styles" | "results" | "compare" | "share" | "deleted";
