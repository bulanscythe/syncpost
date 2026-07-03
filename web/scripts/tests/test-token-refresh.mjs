import { test } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { rmSync, mkdirSync, copyFileSync } from "node:fs";

test("Token refresh skipping logic", () => {
  const tmpDir = join(process.cwd(), "tmp", "test-db-token");
  const fakeRoot = join(tmpDir, "fake-root");
  const fakeData = join(fakeRoot, "data");
  const fakeWeb = join(fakeRoot, "web");

  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(fakeData, { recursive: true });
  mkdirSync(fakeWeb, { recursive: true });

  const dbPath = join(fakeData, "syncpost.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
  
  db.exec(`
    CREATE TABLE instagram_accounts (
      id TEXT PRIMARY KEY,
      instagram_user_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      account_type TEXT,
      access_token TEXT NOT NULL,
      connected_at TEXT NOT NULL,
      access_token_expires_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  const now = Date.now();
  const recentDate = new Date(now - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago (less than min age of 24h)
  const farFutureExpiry = new Date(now + 40 * 24 * 60 * 60 * 1000).toISOString(); // 40 days in future

  db.prepare(`
    INSERT INTO instagram_accounts (id, instagram_user_id, username, access_token, connected_at, access_token_expires_at, updated_at)
    VALUES ('acc-1', 'user-1', 'user', 'token', ?, ?, ?)
  `).run(recentDate, farFutureExpiry, recentDate);
  db.close();

  // Copy the script to fakeWeb
  mkdirSync(join(fakeWeb, "scripts"), { recursive: true });
  copyFileSync(
    join(process.cwd(), "web", "scripts", "refresh-instagram-token.mjs"), 
    join(fakeWeb, "scripts", "refresh-instagram-token.mjs")
  );

  // Run the script. It should log "Token is only X hours old..." and exit cleanly
  const output = execFileSync(
    process.execPath, 
    ["scripts/refresh-instagram-token.mjs"], 
    { cwd: fakeWeb, encoding: "utf8" }
  );

  assert.ok(output.includes("Skipping"));
  assert.ok(!output.includes("Refreshing"));
});
