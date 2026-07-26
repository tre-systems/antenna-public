-- Everything the squashed baseline predates. Kept as a separate migration
-- rather than folded into 0001 so an instance that already applied 0001 picks
-- these up instead of silently skipping them.

-- Shared upstream snapshots: N users tracking the same thing cost one fetch.
-- A row is one adapter result, keyed by template plus the exact config that
-- produced it. Only public-cloud sources are stored — those depend on their
-- config alone, with no per-user credentials and no owner-scoped data — so
-- serving one user's result to another leaks nothing. Pure cache; deleting it
-- costs one refetch.
CREATE TABLE IF NOT EXISTS `upstream_snapshots` (
  `cache_key` text PRIMARY KEY NOT NULL,
  `template_id` text NOT NULL,
  `points` text NOT NULL,
  `fetched_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `upstream_snapshots_fetched_at_idx` ON `upstream_snapshots` (`fetched_at`);

-- Recurring problems derived from the reddit-problems payload archive. Both
-- tables are rebuildable: the clustering job clears and rewrites a collection's
-- rows on each run, so nothing here is a source of truth.
CREATE TABLE IF NOT EXISTS `problem_clusters` (
  `id` text PRIMARY KEY NOT NULL,
  `collection_id` text NOT NULL REFERENCES `collections`(`id`) ON DELETE cascade,
  `label` text NOT NULL,
  `distinct_posts` integer NOT NULL,
  `subreddits` text NOT NULL,
  `first_seen_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL,
  `computed_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `problem_clusters_collection_idx` ON `problem_clusters` (`collection_id`);
CREATE INDEX IF NOT EXISTS `problem_clusters_rank_idx` ON `problem_clusters` (`collection_id`, `distinct_posts`);

CREATE TABLE IF NOT EXISTS `problem_cluster_members` (
  `cluster_id` text NOT NULL REFERENCES `problem_clusters`(`id`) ON DELETE cascade,
  `post_id` text NOT NULL,
  `subreddit` text NOT NULL,
  `title` text NOT NULL,
  `permalink` text NOT NULL,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`cluster_id`, `post_id`)
);
CREATE INDEX IF NOT EXISTS `problem_cluster_members_cluster_idx` ON `problem_cluster_members` (`cluster_id`);

-- Indexes for the columns every request and every cron tick filters on.
-- `collections.owner_id` is the tenant key, so without it each authenticated
-- request scans the whole table; `signals.collection_id` backs the dispatch
-- join and every collection read. The Better Auth columns are hit on sign-in.
CREATE INDEX IF NOT EXISTS `collections_owner_id_idx` ON `collections` (`owner_id`);
CREATE INDEX IF NOT EXISTS `signals_collection_position_idx` ON `signals` (`collection_id`, `position`);
CREATE INDEX IF NOT EXISTS `collection_plans_collection_id_idx` ON `collection_plans` (`collection_id`);
CREATE INDEX IF NOT EXISTS `connector_requests_collection_id_idx` ON `connector_requests` (`collection_id`);
CREATE INDEX IF NOT EXISTS `session_user_id_idx` ON `session` (`user_id`);
CREATE INDEX IF NOT EXISTS `account_user_id_idx` ON `account` (`user_id`);
CREATE INDEX IF NOT EXISTS `account_provider_account_idx` ON `account` (`provider_id`, `account_id`);
CREATE INDEX IF NOT EXISTS `verification_identifier_idx` ON `verification` (`identifier`);
