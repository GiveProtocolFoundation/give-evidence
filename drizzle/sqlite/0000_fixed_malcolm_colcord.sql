CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`grantee_id` text NOT NULL,
	`source` text NOT NULL,
	`source_event_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL,
	`url` text,
	`payload_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`collected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`grantee_id`) REFERENCES `grantees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `evidence_grantee_id_idx` ON `evidence` (`grantee_id`);--> statement-breakpoint
CREATE INDEX `evidence_occurred_at_idx` ON `evidence` (`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_idempotency_idx` ON `evidence` (`grantee_id`,`source`,`source_event_id`,`content_hash`);--> statement-breakpoint
CREATE TABLE `grantees` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`project_name` text NOT NULL,
	`github_urls` text DEFAULT '[]' NOT NULL,
	`deploy_urls` text DEFAULT '[]' NOT NULL,
	`oso_project_id` text,
	`awarded_amount` text NOT NULL,
	`contact_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `grantees_round_id_idx` ON `grantees` (`round_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`run_after` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`locked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_ready_idx` ON `jobs` (`run_after`,`locked_at`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`grantee_id` text NOT NULL,
	`title` text NOT NULL,
	`due_at` text,
	`status` text NOT NULL,
	`evidence_summary` text,
	`attested_by` text,
	`attested_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`grantee_id`) REFERENCES `grantees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestones_grantee_id_idx` ON `milestones` (`grantee_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`slug` text NOT NULL,
	`published_at` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_round_slug_idx` ON `reports` (`round_id`,`slug`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`funder` text NOT NULL,
	`name` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`currency` text NOT NULL,
	`total_awarded` text NOT NULL,
	`public_slug` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
