import { isDemo } from "../config";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export const store: Store = isDemo ? memoryStore : supabaseStore;
export type { Store, UsageStats } from "./types";
