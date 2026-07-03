import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type VideoStatus =
  | "waiting_approval"
  | "approved"
  | "downloading"
  | "publishing"
  | "published"
  | "skipped"
  | "failed";

export type SourceType = "short" | "video";
export type InstagramTarget = "reel" | "feed_post";

export type Video = {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  sourceType: SourceType;
  sourceUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  status: VideoStatus;
  targetType: InstagramTarget | null;
  metadataError: string | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type YouTubeVideoInput = {
  youtubeId: string;
  title: string;
  description: string;
  sourceType: SourceType;
  sourceUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  metadataError: string | null;
  publishedAt: string;
};

type VideoRow = {
  id: string;
  youtube_id: string;
  title: string;
  description: string;
  source_type: SourceType;
  source_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  status: VideoStatus;
  target_type: InstagramTarget | null;
  metadata_error: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
};

const projectRoot = resolve(process.cwd(), "..");
const dataDir = join(projectRoot, "data");

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "syncpost.sqlite"));

db.exec("PRAGMA busy_timeout = 5000;");

function mapVideoRow(row: VideoRow): Video {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    description: row.description,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    status: row.status,
    targetType: row.target_type,
    metadataError: row.metadata_error,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listVideos(): Video[] {
  const rows = db
    .prepare(`
      SELECT
        id,
        youtube_id,
        title,
        description,
        source_type,
        source_url,
        thumbnail_url,
        duration_seconds,
        status,
        target_type,
        metadata_error,
        published_at,
        created_at,
        updated_at
      FROM videos
      ORDER BY
        CASE status
          WHEN 'waiting_approval' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'downloading' THEN 2
          WHEN 'publishing' THEN 3
          WHEN 'failed' THEN 4
          WHEN 'published' THEN 5
          WHEN 'skipped' THEN 6
          ELSE 7
        END,
        published_at DESC
    `)
    .all() as unknown as VideoRow[];

  return rows.map(mapVideoRow);
}

export function getVideoById(id: string): Video | null {
  const row = db
    .prepare(`
      SELECT
        id,
        youtube_id,
        title,
        description,
        source_type,
        source_url,
        thumbnail_url,
        duration_seconds,
        status,
        target_type,
        metadata_error,
        published_at,
        created_at,
        updated_at
      FROM videos
      WHERE id = ?
    `)
    .get(id) as unknown as VideoRow | undefined;

  return row ? mapVideoRow(row) : null;
}

export function updateVideoStatus(id: string, status: VideoStatus) {
  db.prepare(`
    UPDATE videos
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, new Date().toISOString(), id);
}

export function approveVideoForInstagram(
  id: string,
  targetType: InstagramTarget,
) {
  db.prepare(`
    UPDATE videos
    SET status = 'approved', target_type = ?, updated_at = ?
    WHERE id = ? AND metadata_error IS NULL
  `).run(targetType, new Date().toISOString(), id);
}

export function upsertYouTubeVideo(video: YouTubeVideoInput) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO videos (
      id,
      youtube_id,
      title,
      description,
      source_type,
      source_url,
      thumbnail_url,
      duration_seconds,
      status,
      target_type,
      metadata_error,
      published_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting_approval', NULL, ?, ?, ?, ?)
    ON CONFLICT(youtube_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      thumbnail_url = excluded.thumbnail_url,
      duration_seconds = excluded.duration_seconds,
      metadata_error = excluded.metadata_error,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at
  `).run(
    `yt-${video.youtubeId}`,
    video.youtubeId,
    video.title,
    video.description,
    video.sourceType,
    video.sourceUrl,
    video.thumbnailUrl,
    video.durationSeconds,
    video.metadataError,
    video.publishedAt,
    now,
    now,
  );
}

export function removeDevelopmentVideos() {
  db.prepare(`
    DELETE FROM videos
    WHERE youtube_id LIKE 'development-%'
  `).run();
}


export type InstagramAccount = {
  instagramUserId: string;
  username: string;
  accountType: string | null;
  connectedAt: string;
};

export function createOAuthState(state: string, provider: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO oauth_states (state, provider, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(state, provider, expiresAt, now.toISOString());
}

export function consumeOAuthState(state: string, provider: string) {
  const row = db.prepare(`
    SELECT expires_at
    FROM oauth_states
    WHERE state = ? AND provider = ?
  `).get(state, provider) as { expires_at: string } | undefined;

  db.prepare(`
    DELETE FROM oauth_states
    WHERE state = ? AND provider = ?
  `).run(state, provider);

  return Boolean(row && new Date(row.expires_at) > new Date());
}

export function saveInstagramAccount({
  instagramUserId,
  username,
  accountType,
  accessToken,
}: {
  instagramUserId: string;
  username: string;
  accountType: string | null;
  accessToken: string;
}) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO instagram_accounts (
      id,
      instagram_user_id,
      username,
      account_type,
      access_token,
      connected_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(instagram_user_id) DO UPDATE SET
      username = excluded.username,
      account_type = excluded.account_type,
      access_token = excluded.access_token,
      updated_at = excluded.updated_at
  `).run(
    `ig-${instagramUserId}`,
    instagramUserId,
    username,
    accountType,
    accessToken,
    now,
    now,
  );
}

export function getInstagramAccount(): InstagramAccount | null {
  const row = db.prepare(`
    SELECT
      instagram_user_id,
      username,
      account_type,
      connected_at
    FROM instagram_accounts
    ORDER BY updated_at DESC
    LIMIT 1
  `).get() as
    | {
        instagram_user_id: string;
        username: string;
        account_type: string | null;
        connected_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    instagramUserId: row.instagram_user_id,
    username: row.username,
    accountType: row.account_type,
    connectedAt: row.connected_at,
  };
}
