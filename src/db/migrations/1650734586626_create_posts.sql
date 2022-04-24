CREATE TABLE public.posts (
	id                   SERIAL        PRIMARY KEY,
	uploader_id          INT           NOT NULL REFERENCES public.users (id),
	uploader_ip_address  INET          NULL,
	approver_id          INT           NULL REFERENCES public.users (id),
	created_at           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at           TIMESTAMP(3)  NULL,
	version              INT           NOT NULL REFERENCES public.post_versions (id),
	versions             INT[]         NOT NULL,
	revision             INT           NOT NULL DEFAULT 0,
	sources              TEXT[]        NOT NULL DEFAULT '{}',
	tags                 TEXT[]        NOT NULL DEFAULT '{}',
	locked_tags          TEXT[]        NOT NULL DEFAULT '{}',
	-- 1 (PENDING)
	flags                BIGINT        NOT NULL DEFAULT 1,
	rating               RATING        NOT NULL DEFAULT 'explicit',
	rating_lock          RATING_LOCK   NULL,
	files                INT[]         NOT NULL DEFAULT '{}',
	filesize             INT           NOT NULL DEFAULT 0,
	parent_id            INT           NULL REFERENCES public.posts (id),
	children             INT[]         NOT NULL DEFAULT '{}',
	pools                INT[]         NOT NULL DEFAULT '{}',
	description          TEXT          NOT NULL DEFAULT '',
	title                TEXT          NOT NULL DEFAULT '',
	duration             INT           NULL,
	type                 FILE_TYPE     NOT NULL DEFAULT 'unknown',
	-- stats
	score_up             INT           NOT NULL DEFAULT 0,
	score_down           INT           NOT NULL DEFAULT 0,
	score                INT           NOT NULL DEFAULT 0,
	favorite_count       INT           NOT NULL DEFAULT 0,
	comment_count        INT           NOT NULL DEFAULT 0,
	tag_count            INT           NOT NULL DEFAULT 0,
	tag_count_general    INT           NOT NULL DEFAULT 0,
	tag_count_artist     INT           NOT NULL DEFAULT 0,
	tag_count_copyright  INT           NOT NULL DEFAULT 0,
	tag_count_character  INT           NOT NULL DEFAULT 0,
	tag_count_species    INT           NOT NULL DEFAULT 0,
	tag_count_invalid    INT           NOT NULL DEFAULT 0,
	tag_count_lore       INT           NOT NULL DEFAULT 0,
	tag_count_meta       INT           NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX ON public.posts (id, revision);
CREATE INDEX ON        public.posts (uploader_id);
CREATE INDEX ON        public.posts (uploader_ip_address);
CREATE INDEX ON        public.posts (approver_id);
CREATE INDEX ON        public.posts (version);
CREATE INDEX ON        public.posts (flags);
CREATE INDEX ON        public.posts (rating);
CREATE INDEX ON        public.posts (rating_lock);
CREATE INDEX ON        public.posts (parent_id);
CREATE INDEX ON        public.posts (type);

-- Delayed Constraints
ALTER TABLE public.users
	ADD CONSTRAINT "fk_users.avatar_id" FOREIGN KEY (avatar_id)  REFERENCES public.posts (id);

ALTER TABLE public.favorites
	ADD CONSTRAINT "fk_favorites.post_id" FOREIGN KEY (post_id)  REFERENCES public.posts (id);

ALTER TABLE public.post_votes
	ADD CONSTRAINT "fk_post_votes.post_id" FOREIGN KEY (post_id)  REFERENCES public.posts (id);

ALTER TABLE public.post_versions
	ADD CONSTRAINT "fk_post_versions.post_id"       FOREIGN KEY (post_id)       REFERENCES public.posts (id),
	ADD CONSTRAINT "fk_post_versions.parent_id"     FOREIGN KEY (parent_id)     REFERENCES public.posts (id),
	ADD CONSTRAINT "fk_post_versions.old_parent_id" FOREIGN KEY (old_parent_id) REFERENCES public.posts (id);
