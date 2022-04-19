CREATE TABLE `tag_versions` (
	`id`                  INT UNSIGNED      PRIMARY KEY AUTO_INCREMENT,
	`tag_id`              INT UNSIGNED      NULL,
	`name`                TINYTEXT          NOT NULL,
	`created_at`          TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updater_id`          INT UNSIGNED      NOT NULL,
	`updater_ip_address`  VARCHAR(39)       NULL,
	`category`            TINYINT UNSIGNED  NOT NULL,
	`old_category`        TINYINT UNSIGNED  NULL,
	`locked`              BOOLEAN           NOT NULL DEFAULT FALSE,
	`old_locked`          BOOLEAN           NULL,

	-- Indexes
	UNIQUE INDEX  `id`                  (`id`),
	INDEX         `tag_id`              (`tag_id`),
	INDEX         `updater_id`          (`updater_id`),
	INDEX         `updater_ip_address`  (`updater_ip_address`)
	-- tag_id constraint is in 008_create_tags.sql
)
