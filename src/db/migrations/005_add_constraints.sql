-- Users
ALTER TABLE `users` ADD CONSTRAINT `fk_users_avatar_id` FOREIGN KEY (`avatar_id`)  REFERENCES `posts` (`id`);

-- Post Versions
ALTER TABLE `post_versions` ADD CONSTRAINT `fk_post_versions.updater`    FOREIGN KEY (`updater`)    REFERENCES `users` (`id`);
ALTER TABLE `post_versions` ADD CONSTRAINT `fk_post_versions.parent`     FOREIGN KEY (`parent`)     REFERENCES `posts` (`id`);
ALTER TABLE `post_versions` ADD CONSTRAINT `fk_post_versions.old_parent` FOREIGN KEY (`old_parent`) REFERENCES `posts` (`id`);

-- Posts
ALTER TABLE `posts` ADD CONSTRAINT `fk_posts.uploader` FOREIGN KEY (`uploader`) REFERENCES `users`         (`id`);
ALTER TABLE `posts` ADD CONSTRAINT `fk_posts.approver` FOREIGN KEY (`approver`) REFERENCES `users`         (`id`);
ALTER TABLE `posts` ADD CONSTRAINT `fk_posts.version`  FOREIGN KEY (`version`) REFERENCES  `post_versions` (`id`);
ALTER TABLE `posts` ADD CONSTRAINT `fk_posts.parent`   FOREIGN KEY (`parent`) REFERENCES   `posts`         (`id`);

-- Files
ALTER TABLE `files` ADD CONSTRAINT `fk_files.post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`);
