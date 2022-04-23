CREATE TABLE public.tags (
	id          SERIAL        PRIMARY KEY,
	name        VARCHAR       NOT NULL UNIQUE,
	category    SMALLINT      NOT NULL DEFAULT 0,
	creator_id  INT           NOT NULL REFERENCES users (id),
	created_at  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at  TIMESTAMP(3)  NULL,
	version     INT           NOT NULL REFERENCES public.tag_versions (id),
	versions    INT[]         NOT NULL,
	revision    INT           NOT NULL DEFAULT 1,
	post_count  INT           NOT NULL DEFAULT 0,
	locked      BOOLEAN       NOT NULL DEFAULT FALSE
);

-- Delayed Constraints
ALTER TABLE public.tag_versions
	ADD CONSTRAINT "fk_tag_versions.tag_id" FOREIGN KEY (tag_id)  REFERENCES public.tags (id);
