CREATE TABLE public.tag_versions (
	id                  SERIAL        PRIMARY KEY,
	-- this shouldn't practically be null but db limitations require it to be nullable
	tag_id              INT           NULL,
	name                VARCHAR       NOT NULL,
	created_at          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	updated_at          TIMESTAMP(3)  NULL,
	updater_id          INT           NOT NULL REFERENCES users (id),
	updater_ip_address  INET          NULL,
	category            SMALLINT      NOT NULL,
	old_category        SMALLINT      NULL,
	locked              BOOLEAN       NOT NULL DEFAULT FALSE,
	old_locked          BOOLEAN       NULL
);

-- tag_id constraint is in 008_create_tags.sql
CREATE INDEX ON public.tag_versions (tag_id);
CREATE INDEX ON public.tag_versions (updater_id);
CREATE INDEX ON public.tag_versions (updater_ip_address);
