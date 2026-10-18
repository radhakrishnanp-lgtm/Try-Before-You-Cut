import { isDemo } from "../config";
import { memoryStore } from "./memory";
import { postgresStore } from "./postgres";
import type { Store } from "./types";

export const store: Store = isDemo ? memoryStore : postgresStore;
export { DuplicateError } from "./types";
export type { Store, UsageStats } from "./types";
