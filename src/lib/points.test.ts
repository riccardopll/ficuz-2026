import assert from "node:assert/strict";
import test from "node:test";

import { isPointChange, POINT_CHANGES } from "./points";

test("allows each point control value", () => {
  for (const points of POINT_CHANGES) {
    assert.equal(isPointChange(points), true);
  }
});

test("blocks point values outside the controls", () => {
  for (const points of [-1, 0, 1, 2, Number.NaN]) {
    assert.equal(isPointChange(points), false);
  }
});
