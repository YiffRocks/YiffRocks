CREATE TABLE `files` (
	`id`          INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
	`name`        TINYTEXT      NOT NULL,
	`post_count`  INT UNSIGNED  NOT NULL DEFAULT 0,
	`category`    TINYINT       NOT NULL DEFAULT 0,
	`created_at`  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at`  TIMESTAMP(3)  NULL,
	`locked`      BOOLEAN       NOT NULL DEFAULT FALSE,

	-- Indexes
	UNIQUE INDEX  `id`       (`id`),
	UNIQUE INDEX  `name`     (`name`)
)


ALTER TABLE `tag_versions`
	ADD CONSTRAINT `fk_tag_versions.tag_id`    FOREIGN KEY (`tag_id`)    REFERENCES `tags` (`id`),
