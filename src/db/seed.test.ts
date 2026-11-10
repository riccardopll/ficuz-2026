import assert from "node:assert/strict";
import test from "node:test";

import { getLeaderboardState, getLiveStandings, getSnapshotStandings } from "../lib/leaderboard";
import { getSeasonPeriods, getSeasonRange, SEASONS } from "../lib/seasons";
import { addPlayer, addPoints, countRows, createTestDb } from "../lib/test-db";
import { buildSeedSql } from "./seed";

const [season1, season2] = SEASONS;
const now = new Date("2026-11-10T12:00:00Z");

function createSeededDb() {
  const database = createTestDb();

  database.sqlite.exec(buildSeedSql());

  return database;
}

test("the seed is deterministic and replaces existing rows", () => {
  const { sqlite } = createSeededDb();
  const players = countRows(sqlite, "players");
  const transactions = countRows(sqlite, "point_transactions");

  addPoints(sqlite, addPlayer(sqlite, "Extra"), "2026-11-09T10:00:00Z");
  sqlite.exec(buildSeedSql());

  assert.equal(buildSeedSql(), buildSeedSql());
  assert.equal(countRows(sqlite, "players"), players);
  assert.equal(countRows(sqlite, "point_transactions"), transactions);
});

test("seeds a full season 1 with its snapshot", async () => {
  const { sqlite, db } = createSeededDb();
  const state = await getLeaderboardState(db, { season: season1, now });

  assert.equal(state.isSnapshot, true);
  assert.equal(state.period, "2026-08");
  assert.equal(state.leaderboard.length, 7);
  assert.ok(!state.leaderboard.some(({ name }) => name === "Marta"));
  assert.ok(state.leaderboard[0].total >= 5, "season 1 has a clear leader");

  for (const period of getSeasonPeriods(season1, now)) {
    const snapshot = await getSnapshotStandings(db, season1, period);

    assert.deepEqual(snapshot, await getLiveStandings(db, season1, period), period);
    assert.ok(
      snapshot.some(({ periodPoints }) => periodPoints !== 0),
      `${period} has points`,
    );
  }

  // Every seeded row sits before "now", in season 1, between seasons or in season 2.
  const { start, end } = getSeasonRange(season1);
  const count = (from: number, to: number) =>
    sqlite
      .prepare("SELECT count(*) FROM point_transactions WHERE created_at >= ? AND created_at < ?")
      .pluck()
      .get(from, to) as number;
  const season2Start = getSeasonRange(season2).start.getTime();

  assert.ok(count(start.getTime(), end.getTime()) > 50);
  assert.equal(count(end.getTime(), season2Start), 2);
  assert.equal(count(season2Start, now.getTime()), 9);
  assert.equal(count(0, start.getTime()) + count(now.getTime(), Number.MAX_SAFE_INTEGER), 0);
});

test("seeds a fresh season 2 with a few entries", async () => {
  const { db } = createSeededDb();
  const state = await getLeaderboardState(db, { season: season2, now });

  assert.equal(state.status, "active");
  assert.equal(state.isSnapshot, false);
  assert.deepEqual(
    state.leaderboard.map(({ name, total }) => [name, total]),
    [
      ["Alessio", 1],
      ["Davide", 1],
      ["Carlo", 0.5],
      ["Fede", 0.5],
      ["Marta", 0.5],
      ["Bea", 0],
      ["Elena", 0],
      ["Giulia", 0],
    ],
  );
});
