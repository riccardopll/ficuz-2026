import assert from "node:assert/strict";
import test from "node:test";

import { getLeaderboardState, getLiveStandings, getPeriods, resolvePeriod } from "./leaderboard";
import { buildSeasonSnapshotSql } from "./season-snapshot";
import { SEASONS } from "./seasons";
import { addPlayer, addPoints, countRows, createTestDb } from "./test-db";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const [season1, season2] = SEASONS;
const duringSeason2 = new Date("2026-11-10T12:00:00Z");

function totals(entries: { name: string; total: number }[]) {
  return Object.fromEntries(entries.map(({ name, total }) => [name, total]));
}

test("season 1 stops at August 2026 even in later years", () => {
  for (const now of [new Date(2026, 8, 13), new Date(2027, 0, 15)]) {
    const periods = getPeriods(season1, months, now);

    assert.equal(periods.length, 8);
    assert.deepEqual(periods.at(0), { value: "2026-01", label: "Jan 2026" });
    assert.deepEqual(periods.at(-1), { value: "2026-08", label: "Aug 2026" });
    for (const requested of [null, undefined, "2026-09", "2027-01", "invalid"]) {
      assert.equal(resolvePeriod(season1, requested, now), "2026-08");
    }
    assert.equal(resolvePeriod(season1, "2026-07", now), "2026-07");
  }
});

test("does not expose future months of a season", () => {
  const now = new Date(2026, 5, 15);

  assert.equal(getPeriods(season1, months, now).at(-1)?.value, "2026-06");
  assert.equal(resolvePeriod(season1, "2026-08", now), "2026-06");
  assert.deepEqual(getPeriods(season2, months, duringSeason2), [
    { value: "2026-11", label: "Nov 2026" },
  ]);
  assert.equal(resolvePeriod(season2, "2026-12", duringSeason2), "2026-11");
});

test("falls back when a period is outside the season", () => {
  const now = new Date(2026, 7, 5);

  assert.equal(resolvePeriod(season1, "2026-09", now), "2026-08");
  assert.equal(resolvePeriod(season1, "2025-12", now), "2026-08");
  assert.equal(resolvePeriod(season1, "not-a-period", now), "2026-08");
  assert.equal(resolvePeriod(season2, "2026-08", duringSeason2), "2026-11");
});

test("counts points only in the season they were earned", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna");

  addPoints(sqlite, anna, "2026-01-01T00:00:00Z", 1);
  addPoints(sqlite, anna, "2026-08-31T23:59:59.999Z");
  addPoints(sqlite, anna, "2026-09-01T00:00:00Z", 4);
  addPoints(sqlite, anna, "2026-10-31T23:59:59.999Z", 8);
  addPoints(sqlite, anna, "2026-11-01T00:00:00Z", 16);

  assert.deepEqual(totals(await getLiveStandings(db, season1, "2026-08")), { Anna: 1.5 });
  assert.deepEqual(totals(await getLiveStandings(db, season2, "2026-11")), { Anna: 16 });
});

test("a new season starts from zero without deleting history", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna");
  const bruno = addPlayer(sqlite, "Bruno");

  addPoints(sqlite, anna, "2026-02-10T18:00:00Z", 3);
  addPoints(sqlite, bruno, "2026-08-20T18:00:00Z", 2);

  const state = await getLeaderboardState(db, { season: season2, now: duringSeason2 });

  assert.equal(state.status, "active");
  assert.equal(state.period, "2026-11");
  assert.deepEqual(
    state.leaderboard.map(({ name, total, periodPoints }) => ({ name, total, periodPoints })),
    [
      { name: "Anna", total: 0, periodPoints: 0 },
      { name: "Bruno", total: 0, periodPoints: 0 },
    ],
  );
  assert.equal(countRows(sqlite, "point_transactions"), 2);
  assert.deepEqual(totals(await getLiveStandings(db, season1, "2026-08")), { Anna: 3, Bruno: 2 });
});

test("shows the running season total and the points of the selected month", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna");
  const bruno = addPlayer(sqlite, "Bruno");
  const carla = addPlayer(sqlite, "Carla");

  addPoints(sqlite, anna, "2026-01-12T18:00:00Z", 1);
  addPoints(sqlite, anna, "2026-03-03T18:00:00Z", 0.5);
  addPoints(sqlite, anna, "2026-03-04T18:00:00Z", -0.5);
  addPoints(sqlite, bruno, "2026-02-20T18:00:00Z", 1);
  addPoints(sqlite, bruno, "2026-03-20T18:00:00Z", 1.5);
  addPoints(sqlite, carla, "2026-04-01T00:00:00Z", 9);

  assert.deepEqual(await getLiveStandings(db, season1, "2026-03"), [
    { playerId: bruno, name: "Bruno", total: 2.5, periodPoints: 1.5 },
    { playerId: anna, name: "Anna", total: 1, periodPoints: 0 },
    { playerId: carla, name: "Carla", total: 0, periodPoints: 0 },
  ]);
  assert.deepEqual(totals(await getLiveStandings(db, season1, "2026-01")), {
    Anna: 1,
    Bruno: 0,
    Carla: 0,
  });
});

test("the running total restarts with the season, not with the year", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna");

  addPoints(sqlite, anna, "2026-06-10T18:00:00Z", 5);
  addPoints(sqlite, anna, "2026-11-20T18:00:00Z", 1);
  addPoints(sqlite, anna, "2026-12-20T18:00:00Z", 2);
  addPoints(sqlite, anna, "2027-01-05T18:00:00Z", 0.5);

  assert.deepEqual(await getLiveStandings(db, season2, "2027-01"), [
    { playerId: anna, name: "Anna", total: 3.5, periodPoints: 0.5 },
  ]);
});

test("ranks by total, then by the month's points, then by name", async () => {
  const { sqlite, db } = createTestDb();
  const [dario, carla, bruno, anna] = ["Dario", "Carla", "Bruno", "Anna"].map((name) =>
    addPlayer(sqlite, name),
  );

  addPoints(sqlite, anna, "2026-11-02T18:00:00Z", 1);
  addPoints(sqlite, bruno, "2026-11-02T18:00:00Z", 1);
  addPoints(sqlite, carla, "2026-11-02T18:00:00Z", 2);
  addPoints(sqlite, dario, "2026-12-02T18:00:00Z", 1);

  const standings = await getLiveStandings(db, season2, "2026-12");

  assert.deepEqual(
    standings.map(({ name }) => name),
    ["Carla", "Dario", "Anna", "Bruno"],
  );
});

test("leaves players who joined later out of earlier seasons", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna", "2026-01-02T09:00:00Z");

  addPlayer(sqlite, "Marta", "2026-11-02T09:00:00Z");
  addPoints(sqlite, anna, "2026-05-05T18:00:00Z");

  assert.deepEqual(totals(await getLiveStandings(db, season1, "2026-08")), { Anna: 0.5 });
  assert.deepEqual(totals(await getLiveStandings(db, season2, "2026-11")), { Anna: 0, Marta: 0 });
});

test("keeps anyone who scored in a season, whatever their join date says", async () => {
  const { sqlite, db } = createTestDb();
  const zoe = addPlayer(sqlite, "Zoe", "2026-12-01T09:00:00Z");

  addPoints(sqlite, zoe, "2026-07-07T18:00:00Z", 2);

  assert.deepEqual(totals(await getLiveStandings(db, season1, "2026-01")), { Zoe: 0 });
  assert.deepEqual(totals(await getLiveStandings(db, season1, "2026-08")), { Zoe: 2 });
});

test("an archived season is read from its snapshot", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna");

  addPoints(sqlite, anna, "2026-04-04T18:00:00Z", 1);
  sqlite.exec(buildSeasonSnapshotSql(season1));
  // Tampering with the past no longer changes the archive.
  addPoints(sqlite, anna, "2026-04-05T18:00:00Z", 10);

  const state = await getLeaderboardState(db, {
    season: season1,
    period: "2026-04",
    now: duringSeason2,
  });

  assert.equal(state.status, "archived");
  assert.equal(state.isSnapshot, true);
  assert.deepEqual(state.leaderboard, [
    { playerId: anna, name: "Anna", total: 1, periodPoints: 1 },
  ]);
});

test("an archived season without a snapshot is computed from its transactions", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna");

  addPoints(sqlite, anna, "2026-04-04T18:00:00Z", 1);
  addPoints(sqlite, anna, "2026-11-04T18:00:00Z", 7);

  const state = await getLeaderboardState(db, { season: season1, now: duringSeason2 });

  assert.equal(state.period, "2026-08");
  assert.equal(state.isSnapshot, false);
  assert.deepEqual(totals(state.leaderboard), { Anna: 1 });
});

test("the season in progress is always computed live", async () => {
  const { sqlite, db } = createTestDb();
  const anna = addPlayer(sqlite, "Anna");

  addPoints(sqlite, anna, "2026-11-04T18:00:00Z", 1);
  sqlite.exec(buildSeasonSnapshotSql(season2));
  addPoints(sqlite, anna, "2026-11-05T18:00:00Z", 0.5);

  const state = await getLeaderboardState(db, { season: season2, now: duringSeason2 });

  assert.equal(state.isSnapshot, false);
  assert.deepEqual(totals(state.leaderboard), { Anna: 1.5 });
});
