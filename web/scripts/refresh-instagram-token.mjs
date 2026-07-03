import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const projectRoot = resolve(process.cwd(), "..");
const db = new DatabaseSync(resolve(projectRoot, "data", "syncpost.sqlite"));
db.exec("PRAGMA busy_timeout = 5000;");

function loadEnv() {
  const file = join(process.cwd(), ".env.local");
  const values = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const index = line.indexOf("=");
      values[line.slice(0, index)] = line.slice(index + 1);
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return { ...values, ...process.env };
}

async function main() {
  const env = loadEnv();
  const account = db.prepare(`
    SELECT id, instagram_user_id, access_token, connected_at, access_token_expires_at, updated_at
    FROM instagram_accounts
    ORDER BY updated_at DESC
    LIMIT 1
  `).get();

  if (!account) {
    console.log("No connected Instagram account found. Skipping token refresh.");
    db.close();
    return;
  }

  const windowDays = parseInt(env.SYNCPOST_TOKEN_REFRESH_WINDOW_DAYS || "14", 10);
  const minAgeHours = parseInt(env.SYNCPOST_TOKEN_MIN_AGE_HOURS || "24", 10);
  
  const now = Date.now();
  
  // A token must be at least 24 hours old to be refreshed.
  // We use updated_at as the last refresh/connect timestamp.
  const lastUpdated = new Date(account.updated_at).getTime();
  const ageHours = (now - lastUpdated) / (1000 * 60 * 60);

  if (ageHours < minAgeHours) {
    console.log(`Token is only ${ageHours.toFixed(1)} hours old (minimum ${minAgeHours}). Skipping.`);
    db.close();
    return;
  }

  // Calculate expiry. Long-lived tokens expire in 60 days.
  // If access_token_expires_at is null, fallback to 60 days from last update.
  const expiresAtMs = account.access_token_expires_at 
    ? new Date(account.access_token_expires_at).getTime()
    : lastUpdated + (60 * 24 * 60 * 60 * 1000);

  const daysUntilExpiry = (expiresAtMs - now) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry > windowDays) {
    console.log(`Token expires in ${daysUntilExpiry.toFixed(1)} days (window is ${windowDays} days). Skipping.`);
    db.close();
    return;
  }

  console.log(`Token expires in ${daysUntilExpiry.toFixed(1)} days. Refreshing...`);

  try {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", account.access_token);

    const response = await fetch(url.toString());
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }

    if (!data.access_token || !data.expires_in) {
      throw new Error("Invalid response from Meta API: missing access_token or expires_in");
    }

    const newExpiresAt = new Date(now + data.expires_in * 1000).toISOString();
    
    db.prepare(`
      UPDATE instagram_accounts
      SET 
        access_token = ?,
        access_token_expires_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(data.access_token, newExpiresAt, new Date(now).toISOString(), account.id);

    console.log("Token successfully refreshed.");
  } catch (err) {
    console.error(`Failed to refresh token: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
