CREATE TABLE `posts` (
	`id`                   INT UNSIGNED                                           PRIMARY KEY AUTO_INCREMENT,
	`uploader_id`          INT UNSIGNED                                           NOT NULL,
	`uploader_ip_address`  VARCHAR(39)                                            NULL,
	`approver_id`          INT UNSIGNED                                           NULL,
	`created_at`           TIMESTAMP(3)                                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at`           TIMESTAMP(3)                                           NULL,
	`version`              INT UNSIGNED                                           NOT NULL,
	`versions`             TEXT                                                   NOT NULL,
	`revision`             INT UNSIGNED                                           NOT NULL DEFAULT 0,
	`score_up`             INT UNSIGNED                                           NOT NULL DEFAULT 0,
	`score_down`           INT UNSIGNED                                           NOT NULL DEFAULT 0,
	`sources`              TEXT                                                   NOT NULL DEFAULT '',
	`favorite_count`       INT UNSIGNED                                           NOT NULL DEFAULT 0,
	`tags`                 MEDIUMTEXT                                             NOT NULL DEFAULT '',
	`locked_tags`          MEDIUMTEXT                                             NOT NULL DEFAULT '',
	-- 1 (PENDING)
	`flags`                INT UNSIGNED                                           NOT NULL DEFAULT 1,
	`rating`               ENUM('safe', 'questionable', 'explicit')               NOT NULL DEFAULT 'explicit',
	`rating_lock`          ENUM('minimum', 'exact', 'maximum')                    NULL,
	`files`                TEXT                                                   NOT NULL DEFAULT '',
	`parent_id`            INT UNSIGNED                                           NULL,
	`childeren`            TEXT                                                   NULL,
	`pools`                TEXT                                                   NULL,
	`description`          TEXT                                                   NOT NULL DEFAULT '',
	`title`                TEXT                                                   NOT NULL DEFAULT '',
	`comment_count`        INT UNSIGNED                                           NOT NULL DEFAULT 0,
	`duration`             INT UNSIGNED                                           NULL,
	`type`                 ENUM('png', 'apng', 'jpg', 'gif', 'video', 'unknown')  NOT NULL DEFAULT 'unknown',

	-- Indexes
	UNIQUE INDEX  `id`                   (`id`),
	UNIQUE INDEX  `id_revision`          (`id`, `revision`),
	INDEX         `uploader_id`          (`uploader_id`),
	INDEX         `uploader_ip_address`  (`uploader_ip_address`),
	INDEX         `approver_id`          (`approver_id`),
	INDEX         `version`              (`version`),
	INDEX         `flags`                (`flags`),
	INDEX         `rating`               (`rating`),
	INDEX         `rating_lock`          (`rating_lock`),
	INDEX         `parent_id`            (`parent_id`),
	INDEX         `type`                 (`type`),

	-- Constraints
	CONSTRAINT `fk_posts.uploader_id` FOREIGN KEY (`uploader_id`) REFERENCES `users`         (`id`),
	CONSTRAINT `fk_posts.approver_id` FOREIGN KEY (`approver_id`) REFERENCES `users`         (`id`),
	CONSTRAINT `fk_posts.version`     FOREIGN KEY (`version`)     REFERENCES `post_versions` (`id`),
	CONSTRAINT `fk_posts.parent_id`   FOREIGN KEY (`parent_id`)   REFERENCES `posts`         (`id`)
);

-- Delayed Constraints
ALTER TABLE `users`
	ADD CONSTRAINT `fk_users.avatar_id` FOREIGN KEY (`avatar_id`)  REFERENCES `posts` (`id`);

ALTER TABLE `favorites`
	ADD CONSTRAINT `fk_favorites.post_id` FOREIGN KEY (`post_id`)  REFERENCES `posts` (`id`);

ALTER TABLE `post_votes`
	ADD CONSTRAINT `fk_post_votes.post_id` FOREIGN KEY (`post_id`)  REFERENCES `posts` (`id`);

ALTER TABLE `post_versions`
	ADD CONSTRAINT `fk_post_versions.post_id`       FOREIGN KEY (`post_id`)       REFERENCES `posts` (`id`),
	ADD CONSTRAINT `fk_post_versions.parent_id`     FOREIGN KEY (`parent_id`)     REFERENCES `posts` (`id`),
	ADD CONSTRAINT `fk_post_versions.old_parent_id` FOREIGN KEY (`old_parent_id`) REFERENCES `posts` (`id`);
