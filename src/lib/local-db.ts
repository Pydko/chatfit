import * as SQLite from 'expo-sqlite';

export type QueueOp = 'insert_set_log' | 'delete_set_log';

export type QueueItem = {
  id: number;
  op: QueueOp;
  payload: string;
  created_at: number;
  attempts: number;
  last_error: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('chatfit.db').then(async (db) => {
      await db.execAsync(`
        pragma journal_mode = WAL;

        create table if not exists outbox (
          id integer primary key autoincrement,
          op text not null,
          payload text not null,
          created_at integer not null,
          attempts integer not null default 0,
          last_error text
        );

        create table if not exists pending_sets (
          local_id text primary key,
          session_id text not null,
          exercise_id text not null,
          set_index integer not null,
          weight_kg real not null,
          reps integer not null,
          rpe real,
          is_warmup integer not null default 0,
          performed_at text not null
        );

        create index if not exists pending_sets_session_idx
          on pending_sets (session_id);
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function enqueue(op: QueueOp, payload: unknown): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    'insert into outbox (op, payload, created_at) values (?, ?, ?)',
    op,
    JSON.stringify(payload),
    Date.now(),
  );
  return result.lastInsertRowId;
}

export async function peekQueue(limit = 20): Promise<QueueItem[]> {
  const db = await getDb();
  return db.getAllAsync<QueueItem>(
    'select * from outbox order by created_at asc limit ?',
    limit,
  );
}

export async function dequeue(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('delete from outbox where id = ?', id);
}

export async function markFailed(id: number, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'update outbox set attempts = attempts + 1, last_error = ? where id = ?',
    error.slice(0, 300),
    id,
  );
}

export async function queueSize(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('select count(*) as n from outbox');
  return row?.n ?? 0;
}

// --- Bekleyen setler (arayuzde gostermek icin) ---

export async function savePendingSet(row: {
  local_id: string;
  session_id: string;
  exercise_id: string;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  performed_at: string;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `insert or replace into pending_sets
     (local_id, session_id, exercise_id, set_index, weight_kg, reps, rpe, is_warmup, performed_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.local_id, row.session_id, row.exercise_id, row.set_index,
    row.weight_kg, row.reps, row.rpe, row.is_warmup ? 1 : 0, row.performed_at,
  );
}

export async function getPendingSets(sessionId: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'select * from pending_sets where session_id = ? order by performed_at',
    sessionId,
  );
  return rows.map((r) => ({
    id: r.local_id,
    session_id: r.session_id,
    exercise_id: r.exercise_id,
    set_index: r.set_index,
    weight_kg: r.weight_kg,
    reps: r.reps,
    rpe: r.rpe,
    is_warmup: r.is_warmup === 1,
    performed_at: r.performed_at,
    is_pending: true as const,
  }));
}

export async function removePendingSet(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('delete from pending_sets where local_id = ?', localId);
}

export async function clearAllLocal(): Promise<void> {
  const db = await getDb();
  await db.execAsync('delete from outbox; delete from pending_sets;');
}
