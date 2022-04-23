CREATE TABLE public.favorites (
	id          BIGSERIAL            PRIMARY KEY,
	created_at  TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	user_id     INT                  NOT NULL REFERENCES public.users (id),
	post_id     INT                  NOT NULL
);

-- post_id constraint in create posts
CREATE UNIQUE INDEX ON public.favorites (user_id, post_id);

CREATE INDEX ON public.favorites (user_id);
CREATE INDEX ON public.favorites (post_id);
