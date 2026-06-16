import fs from "node:fs";
import path from "node:path";

let pool;
let postgresUnavailableReason = "";

async function createPool() {
  if (!process.env.DATABASE_URL) return null;
  if (pool) return pool;
  try {
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
    });
    await ensureSchema(pool);
    return pool;
  } catch (error) {
    postgresUnavailableReason = error.message || String(error);
    console.warn(`PostgreSQL indisponivel, usando JSON temporario: ${postgresUnavailableReason}`);
    return null;
  }
}

async function ensureSchema(pgPool) {
  await pgPool.query(`
    create table if not exists app_state (
      id integer primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists receipt_events (
      client_event_id text primary key,
      event_type text not null,
      receipt_id text,
      receipt_number text,
      user_login text,
      payload jsonb not null,
      created_at timestamptz not null default now()
    );

    create index if not exists receipt_events_receipt_idx on receipt_events (receipt_id);
    create index if not exists receipt_events_created_idx on receipt_events (created_at desc);
  `);
}

export async function storageInfo() {
  const pgPool = await createPool();
  return {
    mode: pgPool ? "postgres" : "json",
    postgresConfigured: Boolean(process.env.DATABASE_URL),
    postgresUnavailableReason
  };
}

export async function readAppState(dbPath) {
  const pgPool = await createPool();
  if (pgPool) {
    const result = await pgPool.query("select data from app_state where id = 1");
    return result.rows[0]?.data || null;
  }
  if (!fs.existsSync(dbPath)) return null;
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

export async function writeAppState({ dbPath, data, writeJsonBackup, events = [] }) {
  const pgPool = await createPool();
  if (!pgPool) {
    writeJsonBackup(data);
    return { mode: "json" };
  }

  const client = await pgPool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(100400)");
    await client.query(
      `insert into app_state (id, data, updated_at)
       values (1, $1::jsonb, now())
       on conflict (id) do update set data = excluded.data, updated_at = now()`,
      [JSON.stringify(data)]
    );
    for (const event of events) {
      await client.query(
        `insert into receipt_events
          (client_event_id, event_type, receipt_id, receipt_number, user_login, payload)
         values ($1, $2, $3, $4, $5, $6::jsonb)
         on conflict (client_event_id) do nothing`,
        [
          event.clientEventId,
          event.eventType,
          event.receiptId || null,
          event.receiptNumber || null,
          event.userLogin || null,
          JSON.stringify(event.payload || {})
        ]
      );
    }
    await client.query("commit");
    writeJsonBackup(data);
    return { mode: "postgres" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function withAppStateLock(dbPath, callback) {
  const pgPool = await createPool();
  if (!pgPool) return callback(await readAppState(dbPath), null);

  const client = await pgPool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(100400)");
    const result = await client.query("select data from app_state where id = 1 for update");
    const current = result.rows[0]?.data || null;
    const next = await callback(current, client);
    await client.query("commit");
    return next;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function persistLockedAppState({ client, data, events = [] }) {
  if (!client) return;
  await client.query(
    `insert into app_state (id, data, updated_at)
     values (1, $1::jsonb, now())
     on conflict (id) do update set data = excluded.data, updated_at = now()`,
    [JSON.stringify(data)]
  );
  for (const event of events) {
    await client.query(
      `insert into receipt_events
        (client_event_id, event_type, receipt_id, receipt_number, user_login, payload)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (client_event_id) do nothing`,
      [
        event.clientEventId,
        event.eventType,
        event.receiptId || null,
        event.receiptNumber || null,
        event.userLogin || null,
        JSON.stringify(event.payload || {})
      ]
    );
  }
}

export function ensureDirectoryFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
