import assert from "node:assert/strict";
import test from "node:test";

import type Database from "better-sqlite3";

import { getLiveStandings, getSnapshotStandings } from "./leaderboard";
import { buildSeasonSnapshotSql } from "./season-snapshot";
import { getSeasonPeriods, getSeasonRange, SEASONS } from "./seasons";
import { addPlayer, addPoints, countRows, createTestDb } from "./test-db";

const [season1, season2] = SEASONS;
const later = new Date("2030-01-01T00:00:00Z");

/** What production looks like when the snapshot migration runs: season 1 is over. */
function addSeasonOneHistory(sqlite: Database.Database) {
  const anna = addPlayer(sqlite, "Anna", "2026-01-02T09:00:00Z");
  const bruno = addPlayer(sqlite, "Bruno", "2026-01-02T09:00:00Z");
  const carla = addPlayer(sqlite, "Carla", "2026-04-10T09:00:00Z");
  const marta = addPlayer(sqlite, "Marta", "2026-11-02T09:00:00Z");

  addPlayer(sqlite, "Dario", "2026-01-02T09:00:00Z");
  addPoints(sqlite, anna, "2026-01-01T00:00:00Z", 1);
  addPoints(sqlite, anna, "2026-03-15T18:00:00Z", 0.5);
  addPoints(sqlite, anna, "2026-03-16T18:00:00Z", -0.5);
  addPoints(sqlite, anna, "2026-08-31T23:59:59.999Z", 2);
  addPoints(sqlite, bruno, "2026-02-28T23:59:59.999Z", 1.5);
  addPoints(sqlite, bruno, "2026-07-01T00:00:00Z", 0.5);
  addPoints(sqlite, carla, "2026-05-20T18:00:00Z", 3);
  // Not season 1: between seasons, and season 2.
  addPoints(sqlite, anna, "2026-09-01T00:00:00Z", 50);
  addPoints(sqlite, bruno, "2026-10-10T18:00:00Z", 50);
  addPoints(sqlite, marta, "2026-11-05T18:00:00Z", 50);

  return { anna, bruno, carla, marta };
}

test("the migration snapshots season 1 exactly as the live leaderboard shows it", async () => {
  const { sqlite, db } = createTestDb({ "0007": addSeasonOneHistory });
  const periods = getSeasonPeriods(season1, later);

  assert.equal(periods.length, 8);
  assert.equal(countRows(sqlite, "season_standings"), 8 * 4);

  for (const period of periods) {
    assert.deepEqual(
      await getSnapshotStandings(db, season1, period),
      await getLiveStandings(db, season1, period),
      period,
    );
  }
});

test("the snapshot holds the final season 1 standings", async () => {
  const { db } = createTestDb({ "0007": addSeasonOneHistory });
  const standings = await getSnapshotStandings(db, season1, "2026-08");

  assert.deepEqual(
    standings.map(({ name, total, periodPoints }) => [name, total, periodPoints]),
    [
      ["Anna", 3, 2],
      ["Carla", 3, 0],
      ["Bruno", 2, 0],
      ["Dario", 0, 0],
    ],
  );
  assert.deepEqual(
    (await getSnapshotStandings(db, season1, "2026-02")).map(({ name, total }) => [name, total]),
    [
      ["Bruno", 1.5],
      ["Anna", 1],
      ["Carla", 0],
      ["Dario", 0],
    ],
  );
});

test("the snapshot migration changes no historical row", () => {
  const dump = (database: Database.Database) => ({
    players: database.prepare("SELECT * FROM players ORDER BY id").all(),
    transactions: database.prepare("SELECT * FROM point_transactions ORDER BY id").all(),
  });
  let before: ReturnType<typeof dump> | undefined;
  const { sqlite } = createTestDb({
    "0007": (database) => {
      addSeasonOneHistory(database);
      before = dump(database);
    },
  });

  assert.equal(before?.players.length, 5);
  assert.equal(before?.transactions.length, 10);
  assert.deepEqual(dump(sqlite), before);
});

test("the snapshot migration is a no-op on an empty database", () => {
  const { sqlite } = createTestDb();

  assert.equal(countRows(sqlite, "season_standings"), 0);
});

test("a snapshot survives later changes to players and points", async () => {
  const { sqlite, db } = createTestDb({ "0007": addSeasonOneHistory });
  const before = await getSnapshotStandings(db, season1, "2026-08");
  const { anna, bruno } = { anna: before[0].playerId, bruno: before[2].playerId };

  sqlite.prepare("UPDATE players SET name = 'Annina' WHERE id = ?").run(anna);
  sqlite.pragma("foreign_keys = ON");
  sqlite.prepare("DELETE FROM players WHERE id = ?").run(bruno);
  addPoints(sqlite, anna, "2026-06-06T18:00:00Z", 20);

  assert.deepEqual(await getSnapshotStandings(db, season1, "2026-08"), before);
  assert.notDeepEqual(await getLiveStandings(db, season1, "2026-08"), before);
});

test("a season cannot be snapshotted twice", () => {
  const { sqlite } = createTestDb({ "0007": addSeasonOneHistory });

  assert.throws(() => sqlite.exec(buildSeasonSnapshotSql(season1)), /UNIQUE constraint failed/);
  assert.equal(countRows(sqlite, "season_standings"), 8 * 4);
});

test("snapshots a season that spans two years", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna");
  const lastDay = new Date(getSeasonRange(season2).end.getTime() - 1).toISOString();

  addPoints(sqlite, anna, "2026-08-08T18:00:00Z", 9);
  addPoints(sqlite, anna, "2026-11-01T00:00:00Z", 1);
  addPoints(sqlite, anna, "2027-01-10T18:00:00Z", 0.5);
  addPoints(sqlite, anna, lastDay, 2);
  sqlite.exec(buildSeasonSnapshotSql(season2));

  const periods = getSeasonPeriods(season2, later);
  const snapshotted = sqlite
    .prepare("SELECT DISTINCT period FROM season_standings WHERE season_id = ? ORDER BY period")
    .pluck()
    .all(season2.id);

  assert.deepEqual(snapshotted, periods);
  assert.equal(countRows(sqlite, "season_standings"), periods.length);

  for (const period of periods) {
    assert.deepEqual(
      await getSnapshotStandings(db, season2, period),
      await getLiveStandings(db, season2, period),
      period,
    );
  }

  assert.deepEqual(await getSnapshotStandings(db, season2, season2.end), [
    { playerId: anna, name: "Anna", total: 3.5, periodPoints: 2 },
  ]);
});
