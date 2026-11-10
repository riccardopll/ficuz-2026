import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%s', 'now') * 1000)`;

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
});

export const pointTransactions = sqliteTable(
  "point_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    points: real("points").notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [
    index("idx_transactions_player_date").on(table.playerId, table.createdAt),
    index("idx_transactions_date").on(table.createdAt),
  ],
);

/**
 * Frozen standings of a finished season, one row per player and month. Player names are copied and
 * `player_id` is deliberately not a foreign key, so an archive survives later renames and deletions.
 */
export const seasonStandings = sqliteTable(
  "season_standings",
  {
    seasonId: integer("season_id").notNull(),
    period: text("period").notNull(),
    playerId: integer("player_id").notNull(),
    playerName: text("player_name").notNull(),
    total: real("total").notNull(),
    periodPoints: real("period_points").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [primaryKey({ columns: [table.seasonId, table.period, table.playerId] })],
);
