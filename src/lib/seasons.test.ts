import assert from "node:assert/strict";
import test from "node:test";

import {
  defineSeasons,
  formatSeasonRange,
  getCurrentSeason,
  getEditableSeason,
  getLatestPeriod,
  getPeriodRange,
  getSeasonForDate,
  getSeasonHref,
  getSeasonPeriods,
  getSeasonRange,
  getSeasonStatus,
  getStartedSeasons,
  resolveSeason,
  SEASONS,
  toPeriod,
} from "./seasons";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const [season1, season2] = SEASONS;
const utc = (value: string) => new Date(`${value}Z`);
// Season 2's last month is tentative, so tests derive dates from the config instead of fixing it.
const afterSeason2 = getSeasonRange(season2).end;
const lastInstantOfSeason2 = new Date(afterSeason2.getTime() - 1);

test("configures season 1 and season 2", () => {
  assert.deepEqual(season1, { id: 1, start: "2026-01", end: "2026-08" });
  assert.equal(season2.id, 2);
  assert.equal(season2.start, "2026-11");
  assert.ok(season2.end >= "2027-01", "season 2 runs into 2027");
  assert.equal(formatSeasonRange(season1, months), "Jan 2026 – Aug 2026");
  assert.equal(
    formatSeasonRange({ id: 2, start: "2026-11", end: "2027-06" }, months),
    "Nov 2026 – Jun 2027",
  );
});

test("rejects an inconsistent season configuration", () => {
  const invalid = [
    [],
    [{ id: 0, start: "2026-01", end: "2026-08" }],
    [{ id: 1, start: "2026-1", end: "2026-08" }],
    [{ id: 1, start: "2026-01", end: "2026-13" }],
    [{ id: 1, start: "2026-09", end: "2026-08" }],
    [
      { id: 1, start: "2026-01", end: "2026-08" },
      { id: 1, start: "2026-11", end: "2027-06" },
    ],
    [
      { id: 1, start: "2026-01", end: "2026-08" },
      { id: 2, start: "2026-08", end: "2027-06" },
    ],
    [
      { id: 2, start: "2026-11", end: "2027-06" },
      { id: 1, start: "2026-01", end: "2026-08" },
    ],
  ];

  for (const seasons of invalid) {
    assert.throws(() => defineSeasons(seasons), JSON.stringify(seasons));
  }

  assert.doesNotThrow(() => defineSeasons([{ id: 1, start: "2026-01", end: "2026-01" }]));
});

test("uses UTC month boundaries", () => {
  assert.equal(toPeriod(utc("2026-08-31T23:59:59.999")), "2026-08");
  assert.equal(toPeriod(utc("2026-09-01T00:00:00")), "2026-09");
  assert.deepEqual(getPeriodRange("2026-12"), {
    start: utc("2026-12-01T00:00:00"),
    end: utc("2027-01-01T00:00:00"),
  });
  assert.deepEqual(getSeasonRange(season1), {
    start: utc("2026-01-01T00:00:00"),
    end: utc("2026-09-01T00:00:00"),
  });
  assert.deepEqual(getSeasonRange(season2).start, utc("2026-11-01T00:00:00"));
});

test("resolves the season a date falls in", () => {
  assert.equal(getSeasonForDate(utc("2025-12-31T23:59:59")), undefined);
  assert.equal(getSeasonForDate(utc("2026-01-01T00:00:00")), season1);
  assert.equal(getSeasonForDate(utc("2026-08-31T23:59:59.999")), season1);
  assert.equal(getSeasonForDate(utc("2026-09-01T00:00:00")), undefined);
  assert.equal(getSeasonForDate(utc("2026-10-31T23:59:59.999")), undefined);
  assert.equal(getSeasonForDate(utc("2026-11-01T00:00:00")), season2);
  assert.equal(getSeasonForDate(utc("2027-01-15T12:00:00")), season2);
  assert.equal(getSeasonForDate(lastInstantOfSeason2), season2);
  assert.equal(getSeasonForDate(afterSeason2), undefined);
});

test("reports whether a season is upcoming, active or archived", () => {
  assert.equal(getSeasonStatus(season1, utc("2026-05-10T00:00:00")), "active");
  assert.equal(getSeasonStatus(season1, utc("2026-09-01T00:00:00")), "archived");
  assert.equal(getSeasonStatus(season2, utc("2026-10-31T23:59:59")), "upcoming");
  assert.equal(getSeasonStatus(season2, utc("2026-11-10T00:00:00")), "active");
  assert.equal(getSeasonStatus(season2, afterSeason2), "archived");
});

test("shows the latest started season by default", () => {
  assert.equal(getCurrentSeason(utc("2025-06-01T00:00:00")), season1);
  assert.equal(getCurrentSeason(utc("2026-03-01T00:00:00")), season1);
  // Between seasons the finished one stays on the home page until the next one starts.
  assert.equal(getCurrentSeason(utc("2026-10-15T00:00:00")), season1);
  assert.equal(getCurrentSeason(utc("2026-11-10T00:00:00")), season2);
  assert.equal(getCurrentSeason(utc("2030-01-01T00:00:00")), season2);
});

test("lists only seasons that have started", () => {
  assert.deepEqual(getStartedSeasons(utc("2026-10-15T00:00:00")), [season1]);
  assert.deepEqual(getStartedSeasons(utc("2026-11-10T00:00:00")), [season1, season2]);
});

test("resolves the requested season", () => {
  const now = utc("2026-11-10T00:00:00");

  assert.equal(resolveSeason({}, now), season2);
  assert.equal(resolveSeason({ season: "1" }, now), season1);
  assert.equal(resolveSeason({ season: "2" }, now), season2);
  // Links from before seasons existed only carry a month.
  assert.equal(resolveSeason({ period: "2026-08" }, now), season1);
  assert.equal(resolveSeason({ period: "2026-11" }, now), season2);
  // An explicit season wins over the month.
  assert.equal(resolveSeason({ season: "1", period: "2026-11" }, now), season1);

  for (const season of ["0", "3", "1.0", "abc", "", null]) {
    assert.equal(resolveSeason({ season }, now), season2);
  }
  for (const period of ["2026-09", "2025-12", "2026-13", "nope", null]) {
    assert.equal(resolveSeason({ period }, now), season2);
  }
});

test("does not expose a season before it starts", () => {
  const now = utc("2026-10-15T00:00:00");

  assert.equal(resolveSeason({ season: "2" }, now), season1);
  assert.equal(resolveSeason({ period: "2026-11" }, now), season1);
});

test("lists the months of a season up to the current one", () => {
  assert.deepEqual(getSeasonPeriods(season1, utc("2026-03-20T00:00:00")), [
    "2026-01",
    "2026-02",
    "2026-03",
  ]);
  assert.equal(getSeasonPeriods(season1, utc("2026-11-10T00:00:00")).length, 8);
  assert.deepEqual(getSeasonPeriods(season2, utc("2026-11-10T00:00:00")), ["2026-11"]);
  // Seasons can span two calendar years.
  assert.deepEqual(getSeasonPeriods(season2, utc("2027-02-01T00:00:00")), [
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
  ]);
  assert.equal(getSeasonPeriods(season2, afterSeason2).at(-1), season2.end);
  assert.equal(getLatestPeriod(season2, utc("2026-10-01T00:00:00")), "2026-11");
});

test("only the season in progress is editable", () => {
  const now = utc("2026-11-10T00:00:00");

  assert.equal(getEditableSeason("2", now), season2);
  assert.equal(getEditableSeason(2, now), season2);

  for (const requested of ["1", 1, "3", "", null, undefined, "2 ", "02"]) {
    assert.equal(getEditableSeason(requested, now), undefined);
  }
});

test("nothing is editable outside a season", () => {
  for (const now of [utc("2026-09-01T00:00:00"), utc("2026-10-31T23:59:59"), afterSeason2]) {
    assert.equal(getEditableSeason("1", now), undefined);
    assert.equal(getEditableSeason("2", now), undefined);
  }

  assert.equal(getEditableSeason("1", utc("2026-08-31T23:59:59")), season1);
  assert.equal(getEditableSeason("2", lastInstantOfSeason2), season2);
});

test("links to the current season without a season parameter", () => {
  const now = utc("2026-11-10T00:00:00");

  assert.equal(getSeasonHref(season2, undefined, now), "/");
  assert.equal(getSeasonHref(season2, "2026-11", now), "/?period=2026-11");
  assert.equal(getSeasonHref(season1, undefined, now), "/?season=1");
  assert.equal(getSeasonHref(season1, "2026-03", now), "/?season=1&period=2026-03");

  // Every link resolves back to the season it points to.
  for (const season of SEASONS) {
    for (const period of [undefined, ...getSeasonPeriods(season, now)]) {
      const params = new URL(getSeasonHref(season, period, now), "https://ficuz.invalid")
        .searchParams;

      assert.equal(
        resolveSeason({ season: params.get("season"), period: params.get("period") }, now),
        season,
      );
    }
  }
});
