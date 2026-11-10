// Fills the LOCAL D1 database (.wrangler/state) with sample data. It replaces existing rows, so it
// always runs wrangler with --local and can never reach the production database.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildSeedSql } from "../src/db/seed";

const DATABASE = "ficuz-2026-db";

if (process.argv.length > 2) {
  console.error("db:seed:local takes no arguments: it only ever seeds the local database.");
  process.exit(1);
}

const directory = mkdtempSync(join(tmpdir(), "ficuz-seed-"));
const file = join(directory, "seed.sql");

try {
  writeFileSync(file, buildSeedSql());

  const { status, stdout, stderr } = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", DATABASE, "--local", "--yes", "--file", file],
    { encoding: "utf8" },
  );

  if (status === 0) {
    console.log("Local database seeded: season 1 (Jan–Aug 2026, with snapshot), season 2 so far.");
  } else {
    console.error(stdout, stderr);
    console.error("Seeding failed. Run `npm run db:migrate:local` first to create the tables.");
    process.exitCode = status ?? 1;
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
