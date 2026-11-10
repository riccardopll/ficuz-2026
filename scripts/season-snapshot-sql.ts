// Prints the SQL that snapshots a finished season into `season_standings`. It only prints: paste
// the output into a migration created with `npx drizzle-kit generate --custom`.
import { buildSeasonSnapshotSql } from "../src/lib/season-snapshot";
import { getSeasonStatus, SEASONS } from "../src/lib/seasons";

const season = SEASONS.find(({ id }) => String(id) === process.argv[2]);

if (!season) {
  console.error(
    `Usage: npm run --silent db:snapshot:sql -- <${SEASONS.map(({ id }) => id).join("|")}>`,
  );
  process.exit(1);
}

if (getSeasonStatus(season) !== "archived") {
  console.error(`Season ${season.id} is not over yet (it ends with ${season.end}).`);
  process.exit(1);
}

console.log(buildSeasonSnapshotSql(season));
