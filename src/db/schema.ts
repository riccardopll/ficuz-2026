import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const currentTimestamp = sql`(strftime('%s', 'now') * 1000)`;

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(currentTimestamp),
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
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(currentTimestamp),
  },
  (table) => [
    index("idx_transactions_player_date").on(table.playerId, table.createdAt),
    index("idx_transactions_date").on(table.createdAt),
  ],
);
