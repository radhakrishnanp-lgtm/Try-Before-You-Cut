/**
 * Runs once when the Node server starts (self-hosted VPS): applies database
 * migrations and schedules the hourly 24h-retention cleanup in-process, so no
 * external cron is needed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __tbycCron?: NodeJS.Timeout };
  if (g.__tbycCron) return;
  const { isDemo } = await import("./lib/config");
  const { runCleanup } = await import("./lib/cleanup");
  if (!isDemo) {
    const { db } = await import("./lib/db/pool");
    await db().then(
      () => console.info("[boot] database ready"),
      (err) => console.error("[boot] database not ready yet; will retry on first request", err),
    );
  }
  const tick = () =>
    runCleanup()
      .then((r) => (r.erased || r.remoteRetried || r.logsPurged) && console.info("[cleanup]", JSON.stringify(r)))
      .catch((err) => console.error("[cleanup] failed", err));
  g.__tbycCron = setInterval(tick, 15 * 60_000); // every 15 minutes keeps deletion close to 24h
  setTimeout(tick, 30_000);
}
