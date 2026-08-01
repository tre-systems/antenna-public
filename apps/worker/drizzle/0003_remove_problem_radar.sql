-- Remove the retired Reddit experiment and its rebuildable derived data.
DELETE FROM `signal_alerts`
WHERE `signal_id` IN (
  SELECT `id` FROM `signals` WHERE `template_id` = 'reddit-problems'
);
--> statement-breakpoint
DELETE FROM `signal_points`
WHERE `signal_id` IN (
  SELECT `id` FROM `signals` WHERE `template_id` = 'reddit-problems'
);
--> statement-breakpoint
DELETE FROM `signal_status`
WHERE `signal_id` IN (
  SELECT `id` FROM `signals` WHERE `template_id` = 'reddit-problems'
);
--> statement-breakpoint
DELETE FROM `signals` WHERE `template_id` = 'reddit-problems';
--> statement-breakpoint
DELETE FROM `dismissed_starter_signals`
WHERE `signal_signature` LIKE 'reddit-problems|%';
--> statement-breakpoint
DROP TABLE IF EXISTS `problem_cluster_members`;
--> statement-breakpoint
DROP TABLE IF EXISTS `problem_clusters`;
