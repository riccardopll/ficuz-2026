import { readdirSync, readFileSync } from "node:fs";

import Database from "better-sqlite3";

import { createDb } from "../db";

const MIGRATIONS_DIR = new URL("../../drizzle/", import.meta.url);

/**
 * An in-memory database built by running the real migrations, for tests only. `beforeMigration`
 * runs right before the migration whose file name starts with the given prefix, which is how a
 * test puts data in place for a data migration.
 */
export function createTestDb(
  beforeMigration: Record<string, (sqlite: Database.Database) => void> = {},
) {
  const sqlite = new Database(":memory:");
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrations) {
    for (const [prefix, prepare] of Object.entries(beforeMigration)) {
      if (file.startsWith(prefix)) prepare(sqlite);
    }

    sqlite.exec(readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"));
  }

  const d1 = toD1(sqlite);

  return { sqlite, d1, db: createDb(d1) };
}

/** The slice of the D1 API that Drizzle uses, backed by SQLite. */
function toD1(sqlite: Database.Database) {
  const prepare = (query: string, params: unknown[] = []) => {
    const statement = sqlite.prepare(query);
    const write = () => {
      statement.run(...params);
      return [];
    };

    return {
      bind: (...values: unknown[]) => prepare(query, values),
      all: async () => ({
        success: true,
        meta: {},
        results: statement.reader ? statement.all(...params) : write(),
      }),
      raw: async () => (statement.reader ? statement.raw().all(...params) : write()),
      run: async () => ({ success: true, meta: {}, results: write() }),
    };
  };

  return { prepare } as unknown as D1Database;
}

export function addPlayer(
  sqlite: Database.Database,
  name: string,
  joined = "2026-01-01T00:00:00Z",
) {
  const { lastInsertRowid } = sqlite
    .prepare("INSERT INTO players (name, created_at) VALUES (?, ?)")
    .run(name, Date.parse(joined));

  return Number(lastInsertRowid);
}

export function addPoints(sqlite: Database.Database, playerId: number, at: string, points = 0.5) {
  sqlite
    .prepare("INSERT INTO point_transactions (player_id, points, created_at) VALUES (?, ?, ?)")
    .run(playerId, points, Date.parse(at));
}

export function countRows(sqlite: Database.Database, table: string) {
  return (sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number })
    .count;
}
