import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const projectRoot = resolve(process.cwd(), "..");
const db = new DatabaseSync(resolve(projectRoot, "data", "syncpost.sqlite"));

db.exec("PRAGMA busy_timeout = 5000;");

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

const columns = db.prepare("PRAGMA table_info(videos)").all();

const requiredColumns = [
  ["instagram_media_id", "TEXT"],
  ["instagram_permalink", "TEXT"],
  ["publish_error", "TEXT"],
];

for (const [name, type] of requiredColumns) {
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE videos ADD COLUMN ${name} ${type}`);
  }
}

db.close();
console.log("Publisher database initialized.");
