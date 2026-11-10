CREATE TABLE `season_standings` (
	`season_id` integer NOT NULL,
	`period` text NOT NULL,
	`player_id` integer NOT NULL,
	`player_name` text NOT NULL,
	`total` real NOT NULL,
	`period_points` real NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	PRIMARY KEY(`season_id`, `period`, `player_id`)
);
