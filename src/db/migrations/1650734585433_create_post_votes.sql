CREATE TABLE public.post_votes (
	id          BIGSERIAL     PRIMARY KEY,
	created_at  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at  TIMESTAMP(3)  NULL,
	user_id     INT           NOT NULL REFERENCES public.users (id),
	post_id     INT           NOT NULL,
	type        VOTE_TYPE     NOT NULL DEFAULT 'none',
	ip_address  INET          NULL
);

-- post_id constraint in create posts
CREATE UNIQUE INDEX ON public.post_votes (user_id, post_id);
CREATE INDEX ON        public.post_votes (user_id);
CREATE INDEX ON        public.post_votes (post_id);
CREATE INDEX ON        public.post_votes (ip_address);
