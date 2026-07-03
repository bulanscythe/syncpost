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
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
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
  published_at: string;
  created_at: string;
  updated_at: string;
};

const projectRoot = resolve(process.cwd(), "..");
const dataDir = join(projectRoot, "data");

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "younstagram.sqlite"));

db.exec(`
  PRAGMA journal_mode = WAL;

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
    published_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS videos_status_idx ON videos(status);
  CREATE INDEX IF NOT EXISTS videos_published_at_idx ON videos(published_at DESC);
`);

function seedDevelopmentVideos() {
  const existing = db
    .prepare("SELECT COUNT(*) AS count FROM videos")
    .get() as { count: number };

  if (existing.count > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
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
      published_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedVideos = [
    {
      id: "dev-short-001",
      youtubeId: "development-short-001",
      title: "Test YouTube Short 01",
      description: "Development item. This will later be replaced by a real YouTube video description.",
      durationSeconds: 28,
      publishedAt: "2026-07-04T10:00:00.000Z",
    },
    {
      id: "dev-short-002",
      youtubeId: "development-short-002",
      title: "Test YouTube Short 02",
      description: "Development item. The Instagram caption will copy this text exactly.",
      durationSeconds: 41,
      publishedAt: "2026-07-04T09:00:00.000Z",
    },
    {
      id: "dev-short-003",
      youtubeId: "development-short-003",
      title: "Test YouTube Short 03",
      description: "Development item for testing Reel and Feed Post approval.",
      durationSeconds: 53,
      publishedAt: "2026-07-04T08:00:00.000Z",
    },
    {
      id: "dev-short-004",
      youtubeId: "development-short-004",
      title: "Test YouTube Short 04",
      description: "Development item for testing the review queue.",
      durationSeconds: 36,
      publishedAt: "2026-07-04T07:00:00.000Z",
    },
  ];

  for (const video of seedVideos) {
    insert.run(
      video.id,
      video.youtubeId,
      video.title,
      video.description,
      "short",
      "https://www.youtube.com/",
      null,
      video.durationSeconds,
      "waiting_approval",
      null,
      video.publishedAt,
      now,
      now,
    );
  }
}

seedDevelopmentVideos();

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

  return rows.map((row) => ({
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
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
