import { ACCESS_LOG_RETENTION_DAYS } from "./config";
import { eraseSession } from "./sessions";
import { store } from "./store";

export async function runCleanup() {
  let erased = 0;
  const failures: string[] = [];
  for (let batch = 0; batch < 20; batch++) {
    const expired = await store.listExpiredSessions(new Date(), 50);
    if (expired.length === 0) break;
    for (const s of expired) {
      try {
        await eraseSession(s, "system", "expiry");
        erased++;
      } catch (err) {
        failures.push(s.id);
        console.error("cleanup failed", s.id, err);
      }
    }
    if (failures.length) break;
  }
  const logsPurged = await store.purgeAccessLogs(new Date(Date.now() - ACCESS_LOG_RETENTION_DAYS * 86400_000));
  return { erased, failures, logsPurged };
}
