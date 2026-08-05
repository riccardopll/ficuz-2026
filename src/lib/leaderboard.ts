import { and, desc, eq, lt, sql } from "drizzle-orm";

import type { createDb } from "../db";
import { players, pointTransactions } from "../db/schema";

const START_YEAR = 2026;

export async function getLeaderboardState(
  db: ReturnType<typeof createDb>,
  requestedPeriod: string | null | undefined,
) {
  const period = resolvePeriod(requestedPeriod);
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const total = sql<number>`coalesce(sum(${pointTransactions.points}), 0)`;
  const periodPoints = sql<number>`coalesce(sum(case when ${pointTransactions.createdAt} >= ${start.getTime()} then ${pointTransactions.points} else 0 end), 0)`;

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
      and(eq(pointTransactions.playerId, players.id), lt(pointTransactions.createdAt, end)),
    )
    .groupBy(players.id)
    .orderBy(desc(total), desc(periodPoints), players.name);

  return {
    period,
    leaderboard: rows.map((row) => ({
      playerId: row.playerId,
      name: row.name,
      total: Number(row.total),
      periodPoints: Number(row.periodPoints),
    })),
  };
}

export function getPeriods(monthNames: string[], now = new Date()) {
  const periods: { value: string; label: string }[] = [];
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (let year = START_YEAR; year <= currentYear; year++) {
    const lastMonth = year === currentYear ? currentMonth : 11;

    for (let month = 0; month <= lastMonth; month++) {
      periods.push({
        value: `${year}-${String(month + 1).padStart(2, "0")}`,
        label: `${monthNames[month]} ${year}`,
      });
    }
  }

  return periods;
}

export function resolvePeriod(requestedPeriod: string | null | undefined, now = new Date()) {
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (!requestedPeriod || !/^\d{4}-\d{2}$/.test(requestedPeriod)) {
    return fallback;
  }

  const [year, month] = requestedPeriod.split("-").map(Number);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isOutOfRange =
    year < START_YEAR ||
    year > currentYear ||
    month < 1 ||
    month > 12 ||
    (year === currentYear && month > currentMonth);

  return isOutOfRange ? fallback : requestedPeriod;
}
