CREATE TABLE public.files (
	id          SERIAL        PRIMARY KEY,
	created_at  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at  TIMESTAMP(3)  NULL,
	post_id     INT           NOT NULL REFERENCES public.posts (id),
	-- this might be able to be optimized by using UUID / BYTEA
	md5         TEXT          NOT NULL,
	is_primary  BOOLEAN       NOT NULL DEFAULT FALSE,
	type        FILE_TYPE     NOT NULL DEFAULT 'unknown',
	mime        MIME_TYPE     NOT NULL,
	ext         EXT_TYPE      NOT NULL,
	width       SMALLINT      NOT NULL, 
	height      SMALLINT      NOT NULL,
	flags       BIGINT        NOT NULL DEFAULT 0,
	parent_id   INT           NULL REFERENCES public.files (id),
	size        INT           NOT NULL
);

CREATE INDEX ON public.files (post_id);
CREATE INDEX ON public.files (md5);
