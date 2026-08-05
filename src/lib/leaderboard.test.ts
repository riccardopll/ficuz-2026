import assert from "node:assert/strict";
import test from "node:test";

import { getPeriods, resolvePeriod } from "./leaderboard";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

test("builds distinct labels across years", () => {
  const periods = getPeriods(months, new Date(2027, 0, 15));

  assert.deepEqual(periods.at(0), { value: "2026-01", label: "Jan 2026" });
  assert.deepEqual(periods.at(-1), { value: "2027-01", label: "Jan 2027" });
});

test("falls back when a period is unavailable", () => {
  const now = new Date(2026, 7, 5);

  assert.equal(resolvePeriod("2026-09", now), "2026-08");
  assert.equal(resolvePeriod("2025-12", now), "2026-08");
  assert.equal(resolvePeriod("not-a-period", now), "2026-08");
});
