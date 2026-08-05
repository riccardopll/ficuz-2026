import { and, desc, eq, lt, sql } from "drizzle-orm";

import type { createDb } from "../db";
import { players, pointTransactions } from "../db/schema";

export interface LeaderboardEntry {
  playerId: number;
  name: string;
  cumulative: number;
  delta: number;
}

const START_YEAR = 2026;

export function resolvePeriod(rawPeriod: string | null | undefined, now = new Date()) {
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (!rawPeriod || !/^\d{4}-\d{2}$/.test(rawPeriod)) {
    return fallback;
  }

  const [year, month] = rawPeriod.split("-").map(Number);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (
    year < START_YEAR ||
    year > currentYear ||
    month < 1 ||
    month > 12 ||
    (year === currentYear && month > currentMonth)
  ) {
    return fallback;
  }

  return rawPeriod;
}

export function getPeriods(localeMonths: string[], now = new Date()) {
  const periods: { value: string; label: string }[] = [];
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (let year = START_YEAR; year <= currentYear; year++) {
    const maxMonth = year === currentYear ? currentMonth : 11;

    for (let month = 0; month <= maxMonth; month++) {
      periods.push({
        value: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: `${localeMonths[month]} ${year}`,
      });
    }
  }

  return periods;
}

export async function getLeaderboardState(
  db: ReturnType<typeof createDb>,
  rawPeriod: string | null | undefined,
) {
  const period = resolvePeriod(rawPeriod);
  const [year, month] = period.split("-").map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 1);

  const cumulativePoints = sql<number>`coalesce(sum(${pointTransactions.points}), 0)`;
  const monthlyDelta = sql<number>`coalesce(sum(case when ${pointTransactions.createdAt} >= ${startOfMonth.getTime()} then ${pointTransactions.points} else 0 end), 0)`;

  const leaderboardRows = await db
    .select({
      playerId: players.id,
      name: players.name,
      cumulative: cumulativePoints.as("cumulative"),
      delta: monthlyDelta.as("delta"),
    })
    .from(players)
    .leftJoin(
      pointTransactions,
      and(eq(pointTransactions.playerId, players.id), lt(pointTransactions.createdAt, endOfMonth)),
    )
    .groupBy(players.id)
    .orderBy(desc(cumulativePoints), desc(monthlyDelta), players.name);

  return {
    period,
    leaderboard: leaderboardRows.map((row) => ({
      playerId: row.playerId,
      name: row.name,
      cumulative: Number(row.cumulative),
      delta: Number(row.delta),
    })),
  };
}
