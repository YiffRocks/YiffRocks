CREATE TABLE `files` (
	`id`          INT UNSIGNED                                           PRIMARY KEY AUTO_INCREMENT,
	`created_at`  TIMESTAMP(3)                                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at`  TIMESTAMP(3)                                           NULL,
	`post_id`     INT UNSIGNED                                           NOT NULL,
	`md5`         TINYTEXT                                               NOT NULL,
	`is_primary`  BOOLEAN                                                NOT NULL DEFAULT FALSE,
	`type`        ENUM('png', 'apng', 'jpg', 'gif', 'video', 'unknown')  NOT NULL DEFAULT 'unknown',
	`mime`        TINYTEXT                                               NOT NULL,
	`ext`         TINYTEXT                                               NOT NULL,
	`width`       SMALLINT UNSIGNED                                      NOT NULL, 
	`height`      SMALLINT UNSIGNED                                      NOT NULL,
	`flags`       INT UNSIGNED                                           NOT NULL DEFAULT 0,
	`parent_id`   INT UNSIGNED                                           NULL,

	-- Indexes
	UNIQUE INDEX  `id`       (`id`),
	INDEX         `post_id`  (`post_id`),
	INDEX         `md5`      (`md5`),

	-- Constraints
	CONSTRAINT `fk_files.parent_id` FOREIGN KEY (`parent_id`) REFERENCES `files` (`id`),
	CONSTRAINT `fk_files.post_id`   FOREIGN KEY (`post_id`)   REFERENCES `posts` (`id`)
)
