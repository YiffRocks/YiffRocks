CREATE TABLE public.users (
    id                       SERIAL         PRIMARY KEY,
    name                     VARCHAR(32)    NOT NULL UNIQUE,
    email                    TEXT           UNIQUE,
    email_verification       TEXT           UNIQUE,
    CREATEd_at               TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at               TIMESTAMP(3),
    last_login               TIMESTAMP(3),
    flags                    BIGINT         NOT NULL DEFAULT 0,
    level                    SMALLINT       DEFAULT 2,
    base_upload_limit        SMALLINT       DEFAULT 5,
    avatar_id                INT,
    blacklist                TEXT,
    profile                  TEXT,
    -- stats
    artist_change_count      INT            NOT NULL DEFAULT 0,
    comment_count            INT            NOT NULL DEFAULT 0,
    flag_count               INT            NOT NULL DEFAULT 0,
    note_change_count        INT            NOT NULL DEFAULT 0,
    pool_change_count        INT            NOT NULL DEFAULT 0,
    post_change_count        INT            NOT NULL DEFAULT 0,
    post_approval_count      INT            NOT NULL DEFAULT 0,
    upload_count             INT            NOT NULL DEFAULT 0,
    favorite_count           INT            NOT NULL DEFAULT 0,
    positive_feedback_count  INT            NOT NULL DEFAULT 0,
    neutral_feedback_count   INT            NOT NULL DEFAULT 0,
    negative_feedback_count  INT            NOT NULL DEFAULT 0,
	-- settings
	-- 2 (HIDE_BLACKLISTED_AVATARS), 8 (HIDE_COMMENTS), 16 (EMAIL_NOTIFICATIONS), 64 (AUTOCOMPLETE)
    settings                 BIGINT         NOT NULL DEFAULT 0,
    default_image_size       IMAGE_SIZE     NOT NULL DEFAULT 'fitv',
	-- -12 - +14
    timezone                 SMALLINT       NOT NULL DEFAULT 0,
    posts_per_page           SMALLINT       NOT NULL DEFAULT 75,
    comment_threshold        SMALLINT       NOT NULL DEFAULT -10,
	-- internal
    last_ip_address          INET
);

-- avatar_id constraint in create posts
CREATE INDEX users_level ON public.users (level);
CREATE INDEX users_last_ip_address ON public.users (last_ip_address);
