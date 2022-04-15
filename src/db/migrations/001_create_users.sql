CREATE TABLE `users` (
	`id`                       INT UNSIGNED        NOT NULL PRIMARY KEY AUTO_INCREMENT,
	`name`                     TINYTEXT            NOT NULL,
	`password`                 TINYTEXT            NULL,
	`email`                    TINYTEXT            NULL,
	`email_verification`       TEXT                NULL,
	`created_at`               TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at`               TIMESTAMP(3)        NULL,
	`last_login`               TIMESTAMP(3)        NULL,
	`flags`                    INT UNSIGNED        NOT NULL DEFAULT 0,
	`level`                    TINYINT UNSIGNED    NOT NULL DEFAULT 2,
	`base_upload_limit`        MEDIUMINT UNSIGNED  NOT NULL DEFAULT 5,
	`avatar_id`                INT UNSIGNED        NULL,
	`blacklist`                MEDIUMTEXT          NOT NULL DEFAULT '',
	`profile`                  MEDIUMTEXT          NOT NULL DEFAULT '',
	-- stats
	`artist_change_count`      MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`comment_count`            MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`flag_count`               MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`note_change_count`        MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`pool_change_count`        MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`post_change_count`        MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`post_approvals_count`     MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`upload_count`             MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`favorite_count`           MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`positive_feedback_count`  MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`neutral_feedback_count`   MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	`negative_feedback_count`  MEDIUMINT UNSIGNED  NOT NULL DEFAULT 0,
	-- settings
	-- 2 (HIDE_BLACKLISTED_AVATARS), 8 (HIDE_COMMENTS), 16 (EMAIL_NOTIFICATIONS), 64 (AUTOCOMPLETE)
	`settings`                 INT UNSIGNED       NOT NULL DEFAULT 90,
	`default_image_size`       TINYTEXT           NOT NULL DEFAULT 'fitv',
	-- -12 - +14
	`timezone`                 TINYINT            NOT NULL DEFAULT 0,
	-- 255 max
	`posts_per_page`           SMALLINT UNSIGNED  NOT NULL DEFAULT 75,
	`comment_threshold`        TINYINT            NOT NULL DEFAULT -10,
	-- internal
	`ip_addresses`             TEXT  NOT NULL DEFAULT '',

	-- Indexes
	UNIQUE INDEX  `id`                  (`id`),
	UNIQUE INDEX  `name`                (`name`),
	UNIQUE INDEX  `email`               (`email`),
	UNIQUE INDEX  `email_verification`  (`email_verification`),
	-- should this (ip addresses) be made a table on its own for easier lookups?
	INDEX         `ip_addresses`        (`ip_addresses`),
	INDEX         `level`               (`level`)	
)
