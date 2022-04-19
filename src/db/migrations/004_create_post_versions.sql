CREATE TABLE `post_versions` (
	`id`                  INT UNSIGNED                              PRIMARY KEY AUTO_INCREMENT,
	`created_at`          TIMESTAMP(3)                              NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	-- this shouldn't practically be null but db limitations require it to be nullable
	`post_id`             INT UNSIGNED                              NULL,
	`updater_id`          INT UNSIGNED                              NOT NULL,
	`updater_ip_address`  VARCHAR(39)                               NOT NULL,
	`revision`            INT UNSIGNED                              NOT NULL DEFAULT 1,
	`sources`             TEXT                                      NOT NULL DEFAULT '',
	`old_sources`         TEXT                                      NOT NULL DEFAULT '',
	`tags`                TEXT                                      NOT NULL DEFAULT '',
	`old_tags`            TEXT                                      NOT NULL DEFAULT '',
	`locked_tags`         TEXT                                      NOT NULL DEFAULT '',
	`old_locked_tags`     TEXT                                      NOT NULL DEFAULT '',
	`rating`              ENUM('safe', 'questionable', 'explicit')  NOT NULL DEFAULT 'explicit',
	`old_rating`          ENUM('safe', 'questionable', 'explicit')  NULL,
	`rating_lock`         ENUM('minimum', 'exact', 'maximum')       NULL,
	`old_rating_lock`     ENUM('minimum', 'exact', 'maximum')       NULL,
	`parent`              INT UNSIGNED                              NULL,
	`old_parent`          INT UNSIGNED                              NULL,
	`description`         TEXT                                      NOT NULL DEFAULT '',
	`old_description`     TEXT                                      NOT NULL DEFAULT '',
	`title`               TEXT                                      NOT NULL DEFAULT '',
	`old_title`           TEXT                                      NOT NULL DEFAULT '',

	-- Indexes
	UNIQUE INDEX  `id`                  (`id`),
	UNIQUE INDEX  `post_id_revision`    (`post_id`, `revision`),
	INDEX         `post_id`             (`post_id`),
	INDEX         `updater_id`          (`updater_id`),
	INDEX         `updater_ip_address`  (`updater_ip_address`)
	INDEX         `revision`            (`revision`),

	-- Constraints
    CONSTRAINT `fk_post_versions.updater` FOREIGN KEY (`updater`) REFERENCES `users` (`id`)
	-- post_id, parent, old_parent constraints in 005_create_posts.sql
)
