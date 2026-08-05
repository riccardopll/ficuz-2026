import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_COOKIE_MAX_AGE,
  createAdminSessionValue,
  getSafeRedirectPath,
  redirect,
  verifyAdminSessionValue,
} from "./admin-auth";

test("keeps local redirect paths", () => {
  assert.equal(getSafeRedirectPath("/?period=2026-08#table"), "/?period=2026-08#table");
});

test("blocks redirects to another origin", () => {
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example"]) {
    assert.equal(getSafeRedirectPath(path), "/");
  }
});

test("uses a see-other response after form posts", () => {
  assert.equal(redirect("/").status, 303);
});

test("accepts only current signed sessions", () => {
  const secret = "test-secret";
  const now = 1_800_000_000_000;

  assert.equal(verifyAdminSessionValue(createAdminSessionValue(secret, now), secret, now), true);
  assert.equal(
    verifyAdminSessionValue(createAdminSessionValue(secret, now + 1), secret, now),
    false,
  );
  assert.equal(
    verifyAdminSessionValue(
      createAdminSessionValue(secret, now - ADMIN_COOKIE_MAX_AGE * 1000 - 1),
      secret,
      now,
    ),
    false,
  );
});
