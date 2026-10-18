import pg from "pg";
import { config } from "../config";
import { CATALOGUE } from "../styles/catalogue";
import { MIGRATIONS } from "./migrations";

// Timestamps as ISO strings, like the rest of the app expects.
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz
pg.types.setTypeParser(1114, (v) => new Date(`${v}Z`).toISOString()); // timestamp

const g = globalThis as unknown as { __tbycPool?: pg.Pool; __tbycReady?: Promise<pg.Pool> };

async function migrate(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(727274)"); // one migrator at a time
    await client.query("create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())");
    const done = new Set((await client.query<{ id: string }>("select id from schema_migrations")).rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await client.query("begin");
      try {
        await client.query(m.sql);
        await client.query("insert into schema_migrations (id) values ($1)", [m.id]);
        await client.query("commit");
        console.info(`[db] applied migration ${m.id}`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
    // Seed the global catalogue; existing rows (possibly edited by the admin) are left alone.
    for (const [i, s] of CATALOGUE.entries()) {
      await client.query(
        `insert into styles (id, salon_id, name, gender, length, textures, description, prompt, art, active, sort_order)
         values ($1, null, $2, $3, $4, $5, $6, $7, $8, true, $9) on conflict (id) do nothing`,
        [s.id, s.name, s.gender, s.length, s.textures, s.description, s.prompt, JSON.stringify(s.art), i],
      );
    }
  } finally {
    await client.query("select pg_advisory_unlock(727274)").catch(() => undefined);
    client.release();
  }
}

/** Pool, after migrations have run. */
export function db(): Promise<pg.Pool> {
  if (!g.__tbycReady) {
    g.__tbycPool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
    g.__tbycReady = migrate(g.__tbycPool)
      .then(() => g.__tbycPool!)
      .catch((err) => {
        g.__tbycReady = undefined;
        throw err;
      });
  }
  return g.__tbycReady;
}
