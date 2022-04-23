CREATE TABLE public.post_versions (
	id                  SERIAL        PRIMARY KEY,
	created_at          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at          TIMESTAMP(3)  NULL,
	-- this shouldn't practically be null but db limitations require it to be nullable
	post_id             INT           NULL,
	updater_id          INT           NOT NULL REFERENCES public.users (id),
	updater_ip_address  VARCHAR(39)   NULL,
	revision            INT           NOT NULL DEFAULT 1,
	sources             TEXT[]        NOT NULL DEFAULT '{}',
	old_sources         TEXT[]        NOT NULL DEFAULT '{}',
	tags                TEXT[]        NOT NULL DEFAULT '{}',
	old_tags            TEXT[]        NOT NULL DEFAULT '{}',
	locked_tags         TEXT[]        NOT NULL DEFAULT '{}',
	old_locked_tags     TEXT[]        NOT NULL DEFAULT '{}',
	rating              RATING        NOT NULL DEFAULT 'explicit',
	old_rating          RATING        NULL,
	rating_lock         RATING_LOCK   NULL,
	old_rating_lock     RATING_LOCK   NULL,
	parent_id           INT           NULL,
	old_parent_id       INT           NULL,
	description         TEXT          NOT NULL DEFAULT '',
	old_description     TEXT          NOT NULL DEFAULT '',
	title               TEXT          NOT NULL DEFAULT '',
	old_title           TEXT          NOT NULL DEFAULT ''
);

-- post_id, parent, old_parent constraints in create posts
CREATE UNIQUE INDEX ON public.post_versions (post_id, revision);
CREATE INDEX ON        public.post_versions (post_id);
CREATE INDEX ON        public.post_versions (updater_id);
CREATE INDEX ON        public.post_versions (updater_ip_address);
CREATE INDEX ON        public.post_versions (revision);
