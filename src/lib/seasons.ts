export interface Season {
  /** Stable identifier used in URLs and in the `season_standings` table. Never reuse or renumber. */
  readonly id: number;
  /** First month of the season, inclusive, as "YYYY-MM". */
  readonly start: string;
  /** Last month of the season, inclusive, as "YYYY-MM". */
  readonly end: string;
}

export type SeasonStatus = "upcoming" | "active" | "archived";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * The single source of truth for seasons. Months are inclusive and in UTC.
 *
 * A point transaction belongs to the season whose months contain its `created_at`, so changing a
 * date here is all it takes to move a season boundary. Transactions outside every season are kept
 * in the database but count toward no leaderboard.
 */
export const SEASONS: readonly Season[] = defineSeasons([
  { id: 1, start: "2026-01", end: "2026-08" },
  // The end of season 2 is tentative: adjust `end` when the final month is decided.
  { id: 2, start: "2026-11", end: "2027-06" },
]);

export function defineSeasons(seasons: readonly Season[]): readonly Season[] {
  if (seasons.length === 0) {
    throw new Error("At least one season is required");
  }

  seasons.forEach((season, index) => {
    const previous = seasons[index - 1];

    if (!Number.isInteger(season.id) || season.id < 1) {
      throw new Error(`Season id must be a positive integer, got ${season.id}`);
    }
    if (seasons.findIndex(({ id }) => id === season.id) !== index) {
      throw new Error(`Season id ${season.id} is used more than once`);
    }
    if (!isPeriod(season.start) || !isPeriod(season.end)) {
      throw new Error(`Season ${season.id} must use "YYYY-MM" months`);
    }
    if (season.start > season.end) {
      throw new Error(`Season ${season.id} ends before it starts`);
    }
    if (previous && season.start <= previous.end) {
      throw new Error(`Season ${season.id} must start after season ${previous.id} ends`);
    }
  });

  return seasons;
}

export function isPeriod(value: unknown): value is string {
  return typeof value === "string" && PERIOD_PATTERN.test(value);
}

export function toPeriod(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The half-open `[start, end)` instant range covered by a month. */
export function getPeriodRange(period: string) {
  const [year, month] = period.split("-").map(Number);

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/** The half-open `[start, end)` instant range covered by a season. */
export function getSeasonRange(season: Season) {
  return {
    start: getPeriodRange(season.start).start,
    end: getPeriodRange(season.end).end,
  };
}

export function getSeasonStatus(season: Season, now = new Date()): SeasonStatus {
  const current = toPeriod(now);

  if (current < season.start) {
    return "upcoming";
  }

  return current > season.end ? "archived" : "active";
}

/** The season a date falls in, if any: the only season that can receive points at that time. */
export function getSeasonForDate(date: Date, seasons = SEASONS) {
  return seasons.find((season) => getSeasonStatus(season, date) === "active");
}

/** Seasons that can be browsed: everything that has already started. */
export function getStartedSeasons(now = new Date(), seasons = SEASONS) {
  return seasons.filter((season) => getSeasonStatus(season, now) !== "upcoming");
}

/** The season shown by default: the one in progress, or the latest one between seasons. */
export function getCurrentSeason(now = new Date(), seasons = SEASONS) {
  return getStartedSeasons(now, seasons).at(-1) ?? seasons[0];
}

/**
 * Picks the season for a page request. An explicit season wins, then the season a requested month
 * belongs to (so links from before seasons existed keep working), then the current season.
 */
export function resolveSeason(
  requested: { season?: string | null; period?: string | null },
  now = new Date(),
  seasons = SEASONS,
) {
  const started = getStartedSeasons(now, seasons);
  const { season, period } = requested;

  return (
    started.find(({ id }) => String(id) === season) ??
    (isPeriod(period)
      ? started.find(({ start, end }) => period >= start && period <= end)
      : undefined) ??
    getCurrentSeason(now, seasons)
  );
}

/**
 * Returns the season that may receive points right now, but only when it is the one the request
 * targets. Archived, upcoming and unknown seasons are never editable.
 */
export function getEditableSeason(requestedSeasonId: unknown, now = new Date(), seasons = SEASONS) {
  const active = getSeasonForDate(now, seasons);

  return active && String(active.id) === String(requestedSeasonId) ? active : undefined;
}

/** The most recent month of a season that has data to show. */
export function getLatestPeriod(season: Season, now = new Date()) {
  const current = toPeriod(now);

  if (current < season.start) {
    return season.start;
  }

  return current > season.end ? season.end : current;
}

/** Every month of a season up to the latest one, oldest first. */
export function getSeasonPeriods(season: Season, now = new Date()) {
  const latest = getLatestPeriod(season, now);
  const periods: string[] = [];

  for (let period = season.start; period <= latest; period = getNextPeriod(period)) {
    periods.push(period);
  }

  return periods;
}

export function formatPeriod(period: string, monthNames: readonly string[]) {
  const [year, month] = period.split("-").map(Number);

  return `${monthNames[month - 1]} ${year}`;
}

export function formatSeasonRange(season: Season, monthNames: readonly string[]) {
  return `${formatPeriod(season.start, monthNames)} – ${formatPeriod(season.end, monthNames)}`;
}

/** Link to a season's leaderboard. The current season lives at `/`, as it did before seasons. */
export function getSeasonHref(
  season: Season,
  period?: string,
  now = new Date(),
  seasons = SEASONS,
) {
  const params = new URLSearchParams();

  if (season.id !== getCurrentSeason(now, seasons).id) {
    params.set("season", String(season.id));
  }
  if (period) {
    params.set("period", period);
  }

  const query = params.toString();

  return query ? `/?${query}` : "/";
}

function getNextPeriod(period: string) {
  return toPeriod(getPeriodRange(period).end);
}
