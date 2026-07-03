import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const projectRoot = resolve(process.cwd(), "..");
const dataDir = join(projectRoot, "data");

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "syncpost.sqlite"));

db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    youtube_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL CHECK (source_type IN ('short', 'video')),
    source_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (
      status IN (
        'waiting_approval',
        'approved',
        'downloading',
        'publishing',
        'published',
        'skipped',
        'failed'
      )
    ),
    target_type TEXT CHECK (target_type IN ('reel', 'feed_post')),
    metadata_error TEXT,
    published_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS videos_status_idx ON videos(status);
  CREATE INDEX IF NOT EXISTS videos_published_at_idx ON videos(published_at DESC);


  CREATE TABLE IF NOT EXISTS instagram_accounts (
    id TEXT PRIMARY KEY,
    instagram_user_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    account_type TEXT,
    access_token TEXT NOT NULL,
    connected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const columns = db.prepare("PRAGMA table_info(videos)").all();

if (!columns.some((column) => column.name === "metadata_error")) {
  db.exec("ALTER TABLE videos ADD COLUMN metadata_error TEXT");
}

const instagramColumns = db
  .prepare("PRAGMA table_info(instagram_accounts)")
  .all();

if (
  instagramColumns.length > 0 &&
  !instagramColumns.some(
    (column) => column.name === "access_token_expires_at",
  )
) {
  db.exec(
    "ALTER TABLE instagram_accounts ADD COLUMN access_token_expires_at TEXT",
  );
}


db.exec(`
  CREATE TABLE IF NOT EXISTS temporary_media_files (
    token TEXT PRIMARY KEY,
    youtube_id TEXT NOT NULL,
    absolute_path TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS temporary_media_files_expires_idx
  ON temporary_media_files(expires_at);
`);

db.close();

console.log("Database initialized.");
