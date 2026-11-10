import { and, desc, eq, exists, gte, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import type { createDb } from "../db";
import { players, pointTransactions, seasonStandings } from "../db/schema";
import {
  formatPeriod,
  getLatestPeriod,
  getPeriodRange,
  getSeasonPeriods,
  getSeasonRange,
  getSeasonStatus,
  isPeriod,
  type Season,
} from "./seasons";

type Db = ReturnType<typeof createDb>;

export interface LeaderboardEntry {
  playerId: number;
  name: string;
  /** Points accumulated in the season up to the end of the selected month. */
  total: number;
  /** Points earned in the selected month alone. */
  periodPoints: number;
}

export async function getLeaderboardState(
  db: Db,
  options: { season: Season; period?: string | null; now?: Date },
) {
  const { season, now = new Date() } = options;
  const period = resolvePeriod(season, options.period, now);
  const status = getSeasonStatus(season, now);
  const snapshot = status === "archived" ? await getSnapshotStandings(db, season, period) : [];
  const isSnapshot = snapshot.length > 0;

  return {
    season,
    status,
    period,
    /** Whether the standings come from the frozen snapshot rather than the transactions. */
    isSnapshot,
    leaderboard: isSnapshot ? snapshot : await getLiveStandings(db, season, period),
  };
}

/**
 * Standings computed from the transactions of one season. Points earned before the season starts
 * are ignored, which is what makes a new season begin from zero without deleting anything.
 */
export async function getLiveStandings(
  db: Db,
  season: Season,
  period: string,
): Promise<LeaderboardEntry[]> {
  const seasonRange = getSeasonRange(season);
  const periodRange = getPeriodRange(period);
  const played = alias(pointTransactions, "played");
  const total = sql<number>`coalesce(sum(${pointTransactions.points}), 0)`;
  const periodPoints = sql<number>`coalesce(sum(case when ${pointTransactions.createdAt} >= ${periodRange.start.getTime()} then ${pointTransactions.points} else 0 end), 0)`;

  const rows = await db
    .select({
      playerId: players.id,
      name: players.name,
      total: total.as("total"),
      periodPoints: periodPoints.as("period_points"),
    })
    .from(players)
    .leftJoin(
      pointTransactions,
      and(
        eq(pointTransactions.playerId, players.id),
        gte(pointTransactions.createdAt, seasonRange.start),
        lt(pointTransactions.createdAt, periodRange.end),
      ),
    )
    // The roster: players who joined after the season ended only appear if they scored in it.
    .where(
      or(
        lt(players.createdAt, seasonRange.end),
        exists(
          db
            .select({ id: played.id })
            .from(played)
            .where(
              and(
                eq(played.playerId, players.id),
                gte(played.createdAt, seasonRange.start),
                lt(played.createdAt, seasonRange.end),
              ),
            ),
        ),
      ),
    )
    .groupBy(players.id)
    .orderBy(desc(total), desc(periodPoints), players.name);

  return rows.map(toEntry);
}

/** Standings read from the frozen snapshot of a season; empty if it was never snapshotted. */
export async function getSnapshotStandings(
  db: Db,
  season: Season,
  period: string,
): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      playerId: seasonStandings.playerId,
      name: seasonStandings.playerName,
      total: seasonStandings.total,
      periodPoints: seasonStandings.periodPoints,
    })
    .from(seasonStandings)
    .where(and(eq(seasonStandings.seasonId, season.id), eq(seasonStandings.period, period)))
    .orderBy(
      desc(seasonStandings.total),
      desc(seasonStandings.periodPoints),
      seasonStandings.playerName,
    );

  return rows.map(toEntry);
}

export function getPeriods(season: Season, monthNames: readonly string[], now = new Date()) {
  return getSeasonPeriods(season, now).map((value) => ({
    value,
    label: formatPeriod(value, monthNames),
  }));
}

export function resolvePeriod(
  season: Season,
  requestedPeriod: string | null | undefined,
  now = new Date(),
) {
  const latest = getLatestPeriod(season, now);
  const isAvailable =
    isPeriod(requestedPeriod) && requestedPeriod >= season.start && requestedPeriod <= latest;

  return isAvailable ? requestedPeriod : latest;
}

function toEntry(row: LeaderboardEntry): LeaderboardEntry {
  return {
    playerId: row.playerId,
    name: row.name,
    total: Number(row.total),
    periodPoints: Number(row.periodPoints),
  };
}
