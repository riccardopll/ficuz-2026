import assert from "node:assert/strict";
import test from "node:test";

import { getPeriods, resolvePeriod } from "./leaderboard";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

test("stops at August 2026 even in later years", () => {
  for (const now of [new Date(2026, 8, 13), new Date(2027, 0, 15)]) {
    const periods = getPeriods(months, now);

    assert.equal(periods.length, 8);
    assert.deepEqual(periods.at(0), { value: "2026-01", label: "Jan 2026" });
    assert.deepEqual(periods.at(-1), { value: "2026-08", label: "Aug 2026" });
    for (const requested of [null, undefined, "2026-09", "2027-01", "invalid"]) {
      assert.equal(resolvePeriod(requested, now), "2026-08");
    }
    assert.equal(resolvePeriod("2026-07", now), "2026-07");
  }
});

test("does not expose future months before August", () => {
  const now = new Date(2026, 5, 15);

  assert.equal(getPeriods(months, now).at(-1)?.value, "2026-06");
  assert.equal(resolvePeriod("2026-08", now), "2026-06");
});

test("falls back when a period is unavailable", () => {
  const now = new Date(2026, 7, 5);

  assert.equal(resolvePeriod("2026-09", now), "2026-08");
  assert.equal(resolvePeriod("2025-12", now), "2026-08");
  assert.equal(resolvePeriod("not-a-period", now), "2026-08");
});
