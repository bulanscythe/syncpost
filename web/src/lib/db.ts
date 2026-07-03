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
  instagramContainerId: string | null;
  publishAttemptAt: string | null;
  instagramMediaId: string | null;
  instagramPermalink: string | null;
  publishError: string | null;
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
  status?: VideoStatus;
  targetType?: InstagramTarget;
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
  instagram_container_id: string | null;
  publish_attempt_at: string | null;
  instagram_media_id: string | null;
  instagram_permalink: string | null;
  publish_error: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
};

const projectRoot = resolve(process.cwd(), "..");
const dataDir = join(projectRoot, "data");

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "syncpost.sqlite"));

db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");

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
    instagramContainerId: row.instagram_container_id,
    publishAttemptAt: row.publish_attempt_at,
    instagramMediaId: row.instagram_media_id,
    instagramPermalink: row.instagram_permalink,
    publishError: row.publish_error,
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
        instagram_container_id,
        publish_attempt_at,
        instagram_media_id,
        instagram_permalink,
        publish_error,
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
        instagram_container_id,
        publish_attempt_at,
        instagram_media_id,
        instagram_permalink,
        publish_error,
        published_at,
        created_at,
        updated_at
      FROM videos
      WHERE id = ?
    `)
    .get(id) as unknown as VideoRow | undefined;

  return row ? mapVideoRow(row) : null;
}

export function getVideoByYouTubeId(
  youtubeId: string,
): Video | null {
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
        instagram_container_id,
        publish_attempt_at,
        instagram_media_id,
        instagram_permalink,
        publish_error,
        published_at,
        created_at,
        updated_at
      FROM videos
      WHERE youtube_id = ?
    `)
    .get(youtubeId) as unknown as VideoRow | undefined;

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
  description?: string,
) {
  if (description !== undefined) {
    db.prepare(`
      UPDATE videos
      SET status = 'approved', target_type = ?, description = ?, updated_at = ?
      WHERE id = ? AND metadata_error IS NULL
    `).run(targetType, description, new Date().toISOString(), id);
  } else {
    db.prepare(`
      UPDATE videos
      SET status = 'approved', target_type = ?, updated_at = ?
      WHERE id = ? AND metadata_error IS NULL
    `).run(targetType, new Date().toISOString(), id);
  }
}

export function retryVideoForInstagram(id: string) {
  db.prepare(`
    UPDATE videos
    SET 
      status = 'approved',
      publish_error = NULL,
      publish_attempt_at = NULL,
      instagram_container_id = NULL,
      updated_at = ?
    WHERE id = ? AND status = 'failed'
  `).run(new Date().toISOString(), id);
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(youtube_id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      thumbnail_url = excluded.thumbnail_url,
      duration_seconds = excluded.duration_seconds,
      metadata_error = excluded.metadata_error,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at,
      status = CASE 
        WHEN excluded.status = 'approved' AND videos.status = 'waiting_approval' THEN 'approved'
        ELSE videos.status 
      END,
      target_type = CASE 
        WHEN excluded.status = 'approved' AND videos.status = 'waiting_approval' THEN excluded.target_type
        ELSE videos.target_type 
      END
  `).run(
    `yt-${video.youtubeId}`,
    video.youtubeId,
    video.title,
    video.description,
    video.sourceType,
    video.sourceUrl,
    video.thumbnailUrl,
    video.durationSeconds,
    video.status || "waiting_approval",
    video.targetType || null,
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
  accessTokenExpiresAt: string | null;
};

type InstagramAccountRow = {
  instagram_user_id: string;
  username: string;
  account_type: string | null;
  access_token: string;
  connected_at: string;
  access_token_expires_at: string | null;
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
  accessTokenExpiresAt,
}: {
  instagramUserId: string;
  username: string;
  accountType: string | null;
  accessToken: string;
  accessTokenExpiresAt: string | null;
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
      updated_at,
      access_token_expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(instagram_user_id) DO UPDATE SET
      username = excluded.username,
      account_type = excluded.account_type,
      access_token = excluded.access_token,
      updated_at = excluded.updated_at,
      access_token_expires_at = excluded.access_token_expires_at
  `).run(
    `ig-${instagramUserId}`,
    instagramUserId,
    username,
    accountType,
    accessToken,
    now,
    now,
    accessTokenExpiresAt,
  );
}

function mapInstagramAccount(row: InstagramAccountRow): InstagramAccount {
  return {
    instagramUserId: row.instagram_user_id,
    username: row.username,
    accountType: row.account_type,
    connectedAt: row.connected_at,
    accessTokenExpiresAt: row.access_token_expires_at,
  };
}

export function getInstagramAccount(): InstagramAccount | null {
  const row = db.prepare(`
    SELECT
      instagram_user_id,
      username,
      account_type,
      access_token,
      connected_at,
      access_token_expires_at
    FROM instagram_accounts
    ORDER BY updated_at DESC
    LIMIT 1
  `).get() as InstagramAccountRow | undefined;

  return row ? mapInstagramAccount(row) : null;
}

export function getInstagramPublishingCredentials() {
  const row = db.prepare(`
    SELECT
      instagram_user_id,
      username,
      account_type,
      access_token,
      connected_at,
      access_token_expires_at
    FROM instagram_accounts
    ORDER BY updated_at DESC
    LIMIT 1
  `).get() as InstagramAccountRow | undefined;

  if (!row) return null;

  return {
    ...mapInstagramAccount(row),
    accessToken: row.access_token,
  };
}


export type TemporaryMediaFile = {
  token: string;
  youtubeId: string;
  absolutePath: string;
  expiresAt: string;
};

export function createTemporaryMediaFile({
  token,
  youtubeId,
  absolutePath,
  expiresAt,
}: TemporaryMediaFile) {
  db.prepare(`
    INSERT INTO temporary_media_files (
      token,
      youtube_id,
      absolute_path,
      expires_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    token,
    youtubeId,
    absolutePath,
    expiresAt,
    new Date().toISOString(),
  );
}

export function getTemporaryMediaFile(
  token: string,
): TemporaryMediaFile | null {
  const row = db.prepare(`
    SELECT
      token,
      youtube_id,
      absolute_path,
      expires_at
    FROM temporary_media_files
    WHERE token = ?
  `).get(token) as
    | {
        token: string;
        youtube_id: string;
        absolute_path: string;
        expires_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    token: row.token,
    youtubeId: row.youtube_id,
    absolutePath: row.absolute_path,
    expiresAt: row.expires_at,
  };
}

export function getSetting(key: string): string | null {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string) {
  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}
