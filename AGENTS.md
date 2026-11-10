# AGENTS.md

Leaderboard app (Astro + Cloudflare D1) for tracking player points and penalties, split into seasons.

## Commands

```bash
npm run db:migrate        # Apply migrations to remote D1
npm run db:migrate:local  # Apply migrations to local D1
npm run db:seed:local     # Replace the local D1 content with sample data (never touches remote)
npm run db:snapshot:sql   # Print the SQL that archives a finished season, e.g. `-- 2`
npm run fix               # Format, lint, and type-check the project
npm test                  # Run the unit tests
```

Local admin controls need `ADMIN_PASSWORD` and `ADMIN_COOKIE_SECRET` in `.dev.vars`.

## Seasons

- Seasons are configured in one place: `SEASONS` in `src/lib/seasons.ts` (id, first month, last month, both inclusive, UTC). Labels are derived from the dates.
- A point transaction belongs to the season whose months contain its `created_at`. A new season therefore starts from zero and nothing is ever deleted; rows dated between seasons count nowhere.
- Only the season in progress accepts points (`getEditableSeason`, enforced in `src/pages/api/points.ts`).
- A finished season is read from its frozen copy in `season_standings` when there is one, otherwise it is computed from its transactions.
- To archive a finished season: `npx drizzle-kit generate --custom --name=snapshot_season_<id>`, paste the output of `npm run --silent db:snapshot:sql -- <id>` into the new file, then apply the migrations.
