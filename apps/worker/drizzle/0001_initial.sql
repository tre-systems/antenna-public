CREATE TABLE `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `email_verified` integer DEFAULT false NOT NULL,
  `image` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `first_seen_at` integer,
  `onboarded_at` integer
);
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);

CREATE TABLE `account` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user` (`id`) ON DELETE cascade,
  `account_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `access_token` text,
  `refresh_token` text,
  `id_token` text,
  `access_token_expires_at` integer,
  `refresh_token_expires_at` integer,
  `scope` text,
  `password` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `session` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user` (`id`) ON DELETE cascade,
  `token` text NOT NULL,
  `expires_at` integer NOT NULL,
  `ip_address` text,
  `user_agent` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);

CREATE TABLE `verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `collections` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `visibility` text DEFAULT 'private' NOT NULL,
  `refresh_mode` text DEFAULT 'scheduled' NOT NULL,
  `slug` text,
  `forked_from_collection_id` text,
  `layout` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `collections_slug_unique` ON `collections` (`slug`);

CREATE TABLE `user_collection_visits` (
  `user_id` text NOT NULL,
  `collection_id` text NOT NULL REFERENCES `collections` (`id`) ON DELETE cascade,
  `last_seen_at` integer NOT NULL,
  PRIMARY KEY (`user_id`, `collection_id`)
);
CREATE INDEX `user_collection_visits_collection_id_idx`
  ON `user_collection_visits` (`collection_id`);

CREATE TABLE `collection_template_publications` (
  `collection_id` text PRIMARY KEY NOT NULL
    REFERENCES `collections` (`id`) ON DELETE cascade,
  `label` text NOT NULL,
  `description` text,
  `summary` text NOT NULL,
  `published_by` text NOT NULL,
  `published_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `collection_template_publications_published_by_idx`
  ON `collection_template_publications` (`published_by`);
CREATE INDEX `collection_template_publications_updated_at_idx`
  ON `collection_template_publications` (`updated_at`);

CREATE TABLE `signals` (
  `id` text PRIMARY KEY NOT NULL,
  `collection_id` text NOT NULL REFERENCES `collections` (`id`),
  `template_id` text NOT NULL,
  `title` text NOT NULL,
  `config` text NOT NULL,
  `refresh_seconds` integer NOT NULL,
  `position` integer NOT NULL,
  `visibility` text DEFAULT 'private' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE `dismissed_starter_signals` (
  `collection_id` text NOT NULL REFERENCES `collections` (`id`) ON DELETE cascade,
  `signal_signature` text NOT NULL,
  `dismissed_at` integer NOT NULL,
  PRIMARY KEY (`collection_id`, `signal_signature`)
);

CREATE TABLE `signal_points` (
  `signal_id` text NOT NULL REFERENCES `signals` (`id`) ON DELETE cascade,
  `fetched_at` integer NOT NULL,
  `observed_at` integer NOT NULL,
  `metric_key` text NOT NULL,
  `dimensions` text,
  `value` real,
  `value_text` text,
  `unit` text,
  `source_url` text,
  `raw_payload_id` text,
  PRIMARY KEY (`signal_id`, `observed_at`, `metric_key`)
);
CREATE INDEX `signal_points_signal_fetched_idx`
  ON `signal_points` (`signal_id`, `fetched_at`, `observed_at`, `metric_key`);

CREATE TABLE `signal_status` (
  `signal_id` text PRIMARY KEY NOT NULL REFERENCES `signals` (`id`) ON DELETE cascade,
  `status` text NOT NULL,
  `last_ok_at` integer,
  `last_error` text,
  `last_manual_request_at` integer,
  `next_attempt_at` integer,
  `last_data_hash` text,
  `last_data_at` integer,
  `updated_at` integer NOT NULL
);
CREATE INDEX `signal_status_last_ok_at_idx` ON `signal_status` (`last_ok_at`);

CREATE TABLE `signal_alerts` (
  `id` text PRIMARY KEY NOT NULL,
  `collection_id` text NOT NULL REFERENCES `collections` (`id`) ON DELETE cascade,
  `signal_id` text NOT NULL REFERENCES `signals` (`id`) ON DELETE cascade,
  `rule_id` text NOT NULL,
  `rule_label` text NOT NULL,
  `metric_key` text NOT NULL,
  `observed_at` integer NOT NULL,
  `triggered_at` integer NOT NULL,
  `value` real NOT NULL,
  `previous_value` real NOT NULL,
  `unit` text,
  `source_url` text
);
CREATE INDEX `signal_alerts_collection_triggered_idx`
  ON `signal_alerts` (`collection_id`, `triggered_at`);
CREATE INDEX `signal_alerts_signal_observed_idx`
  ON `signal_alerts` (`signal_id`, `observed_at`);

CREATE TABLE `collection_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `collection_id` text NOT NULL REFERENCES `collections` (`id`),
  `prompt` text NOT NULL,
  `proposed` text NOT NULL,
  `status` text DEFAULT 'proposed' NOT NULL,
  `created_at` integer NOT NULL,
  `resolved_at` integer
);

CREATE TABLE `plan_confirmation_claims` (
  `plan_id` text PRIMARY KEY NOT NULL
    REFERENCES `collection_plans` (`id`) ON DELETE cascade,
  `claimed_at` integer NOT NULL
);
CREATE TRIGGER `plan_confirmation_claim_must_be_proposed`
BEFORE INSERT ON `plan_confirmation_claims`
WHEN NOT EXISTS (
  SELECT 1
  FROM `collection_plans`
  WHERE `id` = NEW.`plan_id` AND `status` = 'proposed'
)
BEGIN
  SELECT RAISE(ABORT, 'plan is not proposed');
END;

CREATE TABLE `connector_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `collection_id` text REFERENCES `collections` (`id`),
  `prompt` text NOT NULL,
  `requested_by` text NOT NULL,
  `notes` text,
  `status` text DEFAULT 'requested' NOT NULL,
  `created_at` integer NOT NULL,
  `resolved_at` integer
);

CREATE TABLE `public_collection_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `collection_id` text NOT NULL REFERENCES `collections` (`id`) ON DELETE cascade,
  `category` text NOT NULL,
  `message` text,
  `requester_hash` text NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX `public_collection_reports_collection_id_idx`
  ON `public_collection_reports` (`collection_id`);
CREATE INDEX `public_collection_reports_created_at_idx`
  ON `public_collection_reports` (`created_at`);

CREATE TABLE `notification_prefs` (
  `user_id` text NOT NULL REFERENCES `user` (`id`) ON DELETE cascade,
  `scope` text NOT NULL,
  `collection_id` text REFERENCES `collections` (`id`) ON DELETE cascade,
  `channel` text NOT NULL,
  `enabled` integer DEFAULT false NOT NULL,
  `frequency` text DEFAULT 'daily' NOT NULL,
  `quiet_hours_start` text,
  `quiet_hours_end` text,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`user_id`, `scope`, `channel`)
);
CREATE INDEX `notification_prefs_collection_idx`
  ON `notification_prefs` (`collection_id`);

CREATE TABLE `notification_deliveries` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user` (`id`) ON DELETE cascade,
  `collection_id` text NOT NULL REFERENCES `collections` (`id`) ON DELETE cascade,
  `channel` text NOT NULL,
  `period_start` integer NOT NULL,
  `period_end` integer NOT NULL,
  `sent_at` integer,
  `status` text NOT NULL,
  `error` text
);
CREATE INDEX `notification_deliveries_collection_idx`
  ON `notification_deliveries` (`collection_id`);
CREATE INDEX `notification_deliveries_user_period_idx`
  ON `notification_deliveries` (`user_id`, `period_end`);

CREATE TABLE `mcp_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user` (`id`) ON DELETE cascade,
  `token_hash` text NOT NULL UNIQUE,
  `label` text,
  `created_at` integer NOT NULL,
  `last_used_at` integer,
  `revoked_at` integer
);
CREATE INDEX `mcp_tokens_user_id_idx` ON `mcp_tokens` (`user_id`);

CREATE TABLE `oauth_application` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `icon` text,
  `metadata` text,
  `client_id` text NOT NULL UNIQUE,
  `client_secret` text,
  `redirect_urls` text NOT NULL,
  `type` text NOT NULL,
  `disabled` integer DEFAULT false NOT NULL,
  `user_id` text REFERENCES `user` (`id`) ON DELETE cascade,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `oauth_application_user_id_idx` ON `oauth_application` (`user_id`);

CREATE TABLE `oauth_access_token` (
  `id` text PRIMARY KEY NOT NULL,
  `access_token` text NOT NULL UNIQUE,
  `refresh_token` text NOT NULL UNIQUE,
  `access_token_expires_at` integer NOT NULL,
  `refresh_token_expires_at` integer NOT NULL,
  `client_id` text NOT NULL
    REFERENCES `oauth_application` (`client_id`) ON DELETE cascade,
  `user_id` text REFERENCES `user` (`id`) ON DELETE cascade,
  `scopes` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX `oauth_access_token_client_id_idx`
  ON `oauth_access_token` (`client_id`);
CREATE INDEX `oauth_access_token_user_id_idx`
  ON `oauth_access_token` (`user_id`);
CREATE INDEX `oauth_access_token_refresh_expires_idx`
  ON `oauth_access_token` (`refresh_token_expires_at`);

CREATE TABLE `oauth_consent` (
  `id` text PRIMARY KEY NOT NULL,
  `client_id` text NOT NULL
    REFERENCES `oauth_application` (`client_id`) ON DELETE cascade,
  `user_id` text NOT NULL REFERENCES `user` (`id`) ON DELETE cascade,
  `scopes` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `consent_given` integer NOT NULL
);
CREATE INDEX `oauth_consent_client_id_idx` ON `oauth_consent` (`client_id`);
CREATE INDEX `oauth_consent_user_id_idx` ON `oauth_consent` (`user_id`);
