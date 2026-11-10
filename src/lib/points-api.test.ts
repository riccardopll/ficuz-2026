import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type { APIContext } from "astro";

import { POST } from "../pages/api/points";
import { ADMIN_COOKIE_NAME, createAdminSessionValue } from "./admin-auth";
import { getLiveStandings } from "./leaderboard";
import { getSeasonRange, SEASONS } from "./seasons";
import { addPlayer, addPoints, countRows, createTestDb } from "./test-db";

const SECRET = "test-secret";
const [season1, season2] = SEASONS;
const duringSeason2 = "2026-11-10T12:00:00Z";

function setup(t: TestContext, now: string | Date) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(now) });

  const database = createTestDb();
  const anna = addPlayer(database.sqlite, "Anna");

  addPoints(database.sqlite, anna, "2026-03-03T18:00:00Z", 2);

  return { ...database, anna };
}

async function post(
  d1: D1Database,
  fields: Record<string, string>,
  { admin = true, session = createAdminSessionValue(SECRET) } = {},
) {
  const request = new Request("https://ficuz.invalid/api/points", {
    method: "POST",
    body: new URLSearchParams({ next: "/?period=2026-11", ...fields }),
  });
  const cookies = {
    get: (name: string) => (admin && name === ADMIN_COOKIE_NAME ? { value: session } : undefined),
  };
  const locals = { runtime: { env: { DB: d1, ADMIN_COOKIE_SECRET: SECRET } } };
  const response = await POST({ request, cookies, locals } as unknown as APIContext);

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "https://ficuz.invalid/?period=2026-11");
}

test("adds points to the season in progress", async (t) => {
  const { sqlite, d1, db, anna } = setup(t, duringSeason2);

  await post(d1, { season: "2", playerId: String(anna), points: "0.5" });
  await post(d1, { season: "2", playerId: String(anna), points: "0.5" });
  await post(d1, { season: "2", playerId: String(anna), points: "-0.5" });

  const rows = sqlite
    .prepare(
      "SELECT points, reason, created_at FROM point_transactions ORDER BY id LIMIT -1 OFFSET 1",
    )
    .all();

  assert.deepEqual(
    rows,
    [0.5, 0.5, -0.5].map((points) => ({
      points,
      reason: points > 0 ? "manual_increment" : "manual_decrement",
      created_at: Date.parse(duringSeason2),
    })),
  );
  assert.deepEqual(await getLiveStandings(db, season2, "2026-11"), [
    { playerId: anna, name: "Anna", total: 0.5, periodPoints: 0.5 },
  ]);
  // Season 1 is untouched.
  assert.deepEqual(await getLiveStandings(db, season1, "2026-08"), [
    { playerId: anna, name: "Anna", total: 2, periodPoints: 0 },
  ]);
});

test("requires an admin session", async (t) => {
  const { sqlite, d1, anna } = setup(t, duringSeason2);
  const fields = { season: "2", playerId: String(anna), points: "0.5" };

  await post(d1, fields, { admin: false });
  await post(d1, fields, { session: createAdminSessionValue("another-secret") });
  await post(d1, fields, { session: "" });

  assert.equal(countRows(sqlite, "point_transactions"), 1);
});

test("never adds points to an archived season", async (t) => {
  const { sqlite, d1, anna } = setup(t, duringSeason2);

  for (const season of ["1", "3", "0", "", "abc"]) {
    await post(d1, { season, playerId: String(anna), points: "0.5" });
  }
  // A form without a season, like the ones from before seasons existed.
  await post(d1, { playerId: String(anna), points: "0.5" });

  assert.equal(countRows(sqlite, "point_transactions"), 1);
});

test("adds no points between seasons", async (t) => {
  const { sqlite, d1, anna } = setup(t, "2026-09-15T12:00:00Z");

  for (const season of ["1", "2"]) {
    await post(d1, { season, playerId: String(anna), points: "0.5" });
  }

  assert.equal(countRows(sqlite, "point_transactions"), 1);
});

test("adds no points once the season is over", async (t) => {
  const { sqlite, d1, anna } = setup(t, getSeasonRange(season2).end);

  await post(d1, { season: "2", playerId: String(anna), points: "0.5" });

  assert.equal(countRows(sqlite, "point_transactions"), 1);
});

test("accepts points until the last instant of the season", async (t) => {
  const { sqlite, d1, anna } = setup(t, new Date(getSeasonRange(season2).end.getTime() - 1));

  await post(d1, { season: "2", playerId: String(anna), points: "0.5" });

  assert.equal(countRows(sqlite, "point_transactions"), 2);
});

test("ignores unknown players and point values outside the controls", async (t) => {
  const { sqlite, d1, anna } = setup(t, duringSeason2);

  await post(d1, { season: "2", playerId: "999", points: "0.5" });
  await post(d1, { season: "2", playerId: "1.5", points: "0.5" });
  await post(d1, { season: "2", playerId: String(anna), points: "5" });
  await post(d1, { season: "2", playerId: String(anna), points: "" });

  assert.equal(countRows(sqlite, "point_transactions"), 1);
});
