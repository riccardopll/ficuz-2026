import { buildSeasonSnapshotSql } from "../lib/season-snapshot";
import { SEASONS } from "../lib/seasons";

const DAY = 24 * 60 * 60 * 1000;

/** Sample players. `joined` is the UTC day they were added to the group. */
const PLAYERS = [
  { id: 1, name: "Alessio", joined: "2026-01-02" },
  { id: 2, name: "Bea", joined: "2026-01-02" },
  { id: 3, name: "Carlo", joined: "2026-01-02" },
  { id: 4, name: "Davide", joined: "2026-01-02" },
  { id: 5, name: "Elena", joined: "2026-01-02" },
  { id: 6, name: "Fede", joined: "2026-01-02" },
  { id: 7, name: "Giulia", joined: "2026-03-09" },
  // Joins for season 2, so she must not show up in the season 1 archive.
  { id: 8, name: "Marta", joined: "2026-11-02" },
];

/** How penalty-prone each season 1 player is: the chance of a half point on any given week. */
const SEASON_1_RATES: Record<number, number> = {
  1: 0.5,
  2: 0.15,
  3: 0.35,
  4: 0.6,
  5: 0.1,
  6: 0.25,
  7: 0.4,
};

/** Hand-picked rows: [player, UTC timestamp, points]. */
const EXTRA_TRANSACTIONS: [number, string, number][] = [
  // The last points of season 1, minutes before it ends.
  [4, "2026-08-31T23:40:00Z", 0.5],
  // Between seasons: stored, but counted by neither season.
  [1, "2026-09-16T18:00:00Z", 0.5],
  [3, "2026-10-21T18:00:00Z", 0.5],
  // Season 2 so far.
  [4, "2026-11-02T19:10:00Z", 0.5],
  [1, "2026-11-03T18:45:00Z", 0.5],
  [8, "2026-11-04T20:05:00Z", 0.5],
  [4, "2026-11-05T19:30:00Z", 0.5],
  [4, "2026-11-05T19:31:00Z", -0.5],
  [6, "2026-11-06T18:20:00Z", 0.5],
  [1, "2026-11-08T10:15:00Z", 0.5],
  [3, "2026-11-09T19:00:00Z", 0.5],
  [4, "2026-11-09T19:02:00Z", 0.5],
];

/**
 * SQL that replaces the content of a database with sample data: a full season 1 (Jan–Aug 2026)
 * with its snapshot, a couple of rows between seasons and the first days of season 2. It deletes
 * existing rows, so it is meant for the local database only. The output is deterministic.
 */
export function buildSeedSql() {
  const transactions = [...buildSeasonOneTransactions(), ...EXTRA_TRANSACTIONS].map(
    ([playerId, createdAt, points]) =>
      `(${playerId}, ${points}, '${points > 0 ? "manual_increment" : "manual_decrement"}', ${Date.parse(createdAt)})`,
  );
  const players = PLAYERS.map(
    ({ id, name, joined }) => `(${id}, '${name}', ${Date.parse(`${joined}T09:00:00Z`)})`,
  );

  return [
    "DELETE FROM season_standings;",
    "DELETE FROM point_transactions;",
    "DELETE FROM players;",
    "DELETE FROM sqlite_sequence WHERE name IN ('players', 'point_transactions');",
    `INSERT INTO players (id, name, created_at) VALUES\n  ${players.join(",\n  ")};`,
    `INSERT INTO point_transactions (player_id, points, reason, created_at) VALUES\n  ${transactions.join(",\n  ")};`,
    buildSeasonSnapshotSql(SEASONS[0]),
  ].join("\n\n");
}

/** One possible half point per player and week of season 1, from a fixed pseudo-random sequence. */
function buildSeasonOneTransactions() {
  const random = createRandom(2026);
  const start = Date.parse("2026-01-05T18:30:00Z");
  const end = Date.parse("2026-08-31T00:00:00Z");
  const rows: [number, string, number][] = [];

  for (let week = start; week < end; week += 7 * DAY) {
    for (const player of PLAYERS) {
      const createdAt = week + Math.floor(random() * 5) * DAY + Math.floor(random() * 180) * 60_000;
      const isPenalised = random() < (SEASON_1_RATES[player.id] ?? 0);

      if (isPenalised && createdAt > Date.parse(`${player.joined}T09:00:00Z`) && createdAt < end) {
        rows.push([player.id, new Date(createdAt).toISOString(), 0.5]);
      }
    }
  }

  return rows;
}

function createRandom(seed: number) {
  let state = seed;

  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}
