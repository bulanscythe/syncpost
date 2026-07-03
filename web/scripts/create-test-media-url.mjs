import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const youtubeId = process.argv[2];

if (!youtubeId) {
  throw new Error("Usage: node scripts/create-test-media-url.mjs <youtube-video-id>");
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const publicBaseUrl = env.SYNCPOST_PUBLIC_BASE_URL;

if (!publicBaseUrl) {
  throw new Error("SYNCPOST_PUBLIC_BASE_URL is missing from .env.local.");
}

const projectRoot = resolve(process.cwd(), "..");
const filePath = resolve(
  projectRoot,
  "tmp",
  "download-test",
  `${youtubeId}.mp4`,
);

if (!existsSync(filePath)) {
  throw new Error(`Downloaded test file not found: ${filePath}`);
}

const token = randomBytes(24).toString("hex");
const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

const db = new DatabaseSync(resolve(projectRoot, "data", "syncpost.sqlite"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");

db.prepare(`
  INSERT INTO temporary_media_files (
    token,
    youtube_id,
    absolute_path,
    expires_at,
    created_at
  ) VALUES (?, ?, ?, ?, ?)
`).run(token, youtubeId, filePath, expiresAt, new Date().toISOString());

db.close();

console.log(
  JSON.stringify(
    {
      youtubeId,
      expiresAt,
      publicUrl: `${publicBaseUrl}/api/media/${token}`,
    },
    null,
    2,
  ),
);
