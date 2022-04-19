CREATE TABLE `post_votes` (
	`id`          BIGINT UNSIGNED             PRIMARY KEY AUTO_INCREMENT,
	`created_at`  TIMESTAMP(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at`  TIMESTAMP(3)                NULL,
	`user_id`     INT UNSIGNED                NOT NULL,
	`post_id`     INT UNSIGNED                NOT NULL,
	`type`        ENUM('down', 'none', 'up')  NOT NULL DEFAULT 'none',
	`ip_address`  VARCHAR(39)                 NULL,

	-- Indexes
	UNIQUE INDEX  `id`         (`id`),
	UNIQUE INDEX  `user_post`  (`user_id`, `post_id`),
	INDEX         `user_id`    (`user_id`),
	INDEX         `post_id`    (`post_id`),
	INDEX         `ip_address` (`ip_address`),

	-- Constraints
    CONSTRAINT `fk_post_votes.user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
	-- post_id constraint in 005_create_posts.sql
)
