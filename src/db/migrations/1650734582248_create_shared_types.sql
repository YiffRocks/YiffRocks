CREATE TYPE image_size AS ENUM('thumbnail', 'fitv', 'fith', 'original');
CREATE TYPE vote_type AS ENUM('down', 'none', 'up');
CREATE TYPE rating AS ENUM('safe', 'questionable', 'explicit');
CREATE TYPE rating_lock AS ENUM('minimum', 'exact', 'maximum');
CREATE TYPE file_type AS ENUM('png', 'apng', 'jpg', 'gif', 'video', 'unknown');
CREATE TYPE mime_type AS ENUM('video/webm', 'image/gif', 'image/apng', 'image/png', 'image/jpeg');
CREATE TYPE ext_type AS ENUM('webm', 'gif', 'apng', 'png', 'jpg');
