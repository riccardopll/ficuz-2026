-- Data migration: freeze the Season 1 standings (Jan 2026 – Aug 2026, UTC months) into
-- `season_standings`. It only reads `players` and `point_transactions`; no historical row is
-- changed or deleted. Generated with `npm run db:snapshot:sql -- 1`.
WITH RECURSIVE months(first_day) AS (
  SELECT '2026-01-01'
  UNION ALL
  SELECT date(first_day, '+1 month') FROM months WHERE first_day < '2026-08-01'
),
periods AS (
  SELECT
    strftime('%Y-%m', first_day) AS period,
    CAST(strftime('%s', first_day) AS INTEGER) * 1000 AS starts_at,
    CAST(strftime('%s', first_day, '+1 month') AS INTEGER) * 1000 AS ends_at
  FROM months
),
season AS (
  SELECT min(starts_at) AS starts_at, max(ends_at) AS ends_at FROM periods
)
INSERT INTO season_standings (season_id, period, player_id, player_name, total, period_points)
SELECT
  1,
  periods.period,
  players.id,
  players.name,
  coalesce(sum(tx.points), 0),
  coalesce(sum(CASE WHEN tx.created_at >= periods.starts_at THEN tx.points ELSE 0 END), 0)
FROM periods
CROSS JOIN season
CROSS JOIN players
LEFT JOIN point_transactions AS tx
  ON tx.player_id = players.id
  AND tx.created_at >= season.starts_at
  AND tx.created_at < periods.ends_at
WHERE players.created_at < season.ends_at
  OR EXISTS (
    SELECT 1
    FROM point_transactions AS played
    WHERE played.player_id = players.id
      AND played.created_at >= season.starts_at
      AND played.created_at < season.ends_at
  )
GROUP BY periods.period, players.id;
