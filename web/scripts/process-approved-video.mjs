import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { GlobalLock } from "./lib/lock.mjs";

const projectRoot = resolve(process.cwd(), "..");
const db = new DatabaseSync(resolve(projectRoot, "data", "syncpost.sqlite"));

db.exec("PRAGMA busy_timeout = 5000;");

function loadEnv() {
  const file = join(process.cwd(), ".env.local");
  const values = {};

  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;

    const index = line.indexOf("=");
    values[line.slice(0, index)] = line.slice(index + 1);
  }

  return { ...values, ...process.env };
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function setVideoStatus(id, status, publishError = null) {
  db.prepare(`
    UPDATE videos
    SET
      status = ?,
      publish_error = ?,
      updated_at = ?
    WHERE id = ?
  `).run(status, publishError, new Date().toISOString(), id);
}

function requestJson(url, options) {
  return fetch(url, options).then(async (response) => {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        payload?.error?.message ||
          `Instagram request failed with HTTP ${response.status}.`,
      );
    }

    return payload;
  });
}

async function main() {
  const env = loadEnv();

  const lock = new GlobalLock("publisher.lock", join(projectRoot, "tmp"));

  const handleSignal = () => {
    lock.release();
    process.exit(1);
  };
  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  if (!lock.acquire()) {
    console.log("already running; skipped");
    db.close();
    return;
  }

  const stuckJobMinutes = parseInt(env.SYNCPOST_STUCK_JOB_MINUTES || "30", 10);
  const stuckThreshold = new Date(Date.now() - stuckJobMinutes * 60 * 1000).toISOString();

  const recoveredDownloading = db.prepare(`
    UPDATE videos
    SET status = 'approved', updated_at = ?
    WHERE status = 'downloading' AND updated_at < ?
  `).run(new Date().toISOString(), stuckThreshold);

  if (recoveredDownloading.changes > 0) {
    console.log(`Recovered ${recoveredDownloading.changes} stale downloading jobs.`);
  }

  const recoveredPublishing = db.prepare(`
    UPDATE videos
    SET 
      status = 'failed', 
      publish_error = 'Interrupted during publishing. Check Instagram before manual retry.',
      updated_at = ?
    WHERE status = 'publishing' AND updated_at < ?
  `).run(new Date().toISOString(), stuckThreshold);

  if (recoveredPublishing.changes > 0) {
    console.log(`Recovered ${recoveredPublishing.changes} stale publishing jobs as failed.`);
  }

  if (!env.SYNCPOST_PUBLIC_BASE_URL) {
    lock.release();
    throw new Error("SYNCPOST_PUBLIC_BASE_URL is missing.");
  }

  const account = db.prepare(`
    SELECT instagram_user_id, username, access_token
    FROM instagram_accounts
    ORDER BY updated_at DESC
    LIMIT 1
  `).get();

  if (!account) {
    lock.release();
    throw new Error("No Instagram publishing account is connected.");
  }

  const video = db.prepare(`
    SELECT
      id,
      youtube_id,
      title,
      description,
      source_url,
      target_type,
      status
    FROM videos
    WHERE status = 'approved'
      AND metadata_error IS NULL
    ORDER BY updated_at ASC
    LIMIT 1
  `).get();

  if (!video) {
    console.log("No approved videos to publish.");
    lock.release();
    db.close();
    return;
  }

  const claim = db.prepare(`
    UPDATE videos
    SET
      status = 'downloading',
      publish_error = NULL,
      updated_at = ?
    WHERE id = ?
      AND status = 'approved'
  `).run(new Date().toISOString(), video.id);

  if (Number(claim.changes) !== 1) {
    console.log("Another worker already claimed this video.");
    lock.release();
    db.close();
    return;
  }

  const workDir = join(projectRoot, "tmp", "publishing", video.youtube_id);
  let temporaryToken = null;

  try {
    mkdirSync(workDir, { recursive: true });

    console.log(`Downloading: ${video.title}`);

    execFileSync(
      "yt-dlp",
      [
        "--no-playlist",
        "--merge-output-format",
        "mp4",
        "-f",
        "bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/best[ext=mp4]/best",
        "-o",
        join(workDir, "%(id)s.%(ext)s"),
        video.source_url,
      ],
      {
        stdio: "inherit",
      },
    );

    const downloadedFile = readdirSync(workDir)
      .filter((file) => file.endsWith(".mp4"))
      .map((file) => join(workDir, file))[0];

    if (!downloadedFile || !existsSync(downloadedFile)) {
      throw new Error("yt-dlp completed without producing an MP4 file.");
    }

    const probe = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_type,codec_name,width,height",
          "-of",
          "json",
          downloadedFile,
        ],
        { encoding: "utf8" },
      ),
    );

    const videoStream = probe.streams.find(
      (stream) => stream.codec_type === "video",
    );
    const audioStream = probe.streams.find(
      (stream) => stream.codec_type === "audio",
    );

    if (
      videoStream?.codec_name !== "h264" ||
      audioStream?.codec_name !== "aac" ||
      !videoStream.width ||
      !videoStream.height
    ) {
      throw new Error(
        "Downloaded file is not an Instagram-ready H.264/AAC MP4.",
      );
    }

    temporaryToken = randomBytes(24).toString("hex");

    const expiresAt = new Date(
      Date.now() + 2 * 60 * 60 * 1000,
    ).toISOString();

    db.prepare(`
      INSERT INTO temporary_media_files (
        token,
        youtube_id,
        absolute_path,
        expires_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      temporaryToken,
      video.youtube_id,
      downloadedFile,
      expiresAt,
      new Date().toISOString(),
    );

    const videoUrl =
      `${env.SYNCPOST_PUBLIC_BASE_URL}/api/media/${temporaryToken}`;

    setVideoStatus(video.id, "publishing");

    console.log("Creating Instagram media container...");

    db.prepare(`
      UPDATE videos
      SET publish_attempt_at = ?, updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), video.id);

    const apiVersion = env.INSTAGRAM_API_VERSION || "v24.0";

    const container = await requestJson(
      `https://graph.instagram.com/${apiVersion}/${account.instagram_user_id}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          media_type: "REELS",
          video_url: videoUrl,
          caption: video.description || "",
          share_to_feed: video.target_type === "feed_post" ? "true" : "false",
          access_token: account.access_token,
        }),
      },
    );

    if (!container.id) {
      throw new Error("Instagram did not return a media container ID.");
    }

    console.log(`Processing container: ${container.id}`);

    db.prepare(`
      UPDATE videos
      SET instagram_container_id = ?, updated_at = ?
      WHERE id = ?
    `).run(container.id, new Date().toISOString(), video.id);

    let ready = false;

    for (let attempt = 1; attempt <= 36; attempt++) {
      await sleep(10000);

      const statusUrl = new URL(
        `https://graph.instagram.com/${apiVersion}/${container.id}`,
      );

      statusUrl.searchParams.set("fields", "id,status_code,status");
      statusUrl.searchParams.set("access_token", account.access_token);

      const containerStatus = await requestJson(statusUrl);

      const state =
        containerStatus.status_code || containerStatus.status || "UNKNOWN";

      console.log(`Container status ${attempt}/36: ${state}`);

      if (state === "FINISHED") {
        ready = true;
        break;
      }

      if (state === "ERROR" || state === "EXPIRED") {
        throw new Error(`Instagram container processing ended with ${state}.`);
      }
    }

    if (!ready) {
      throw new Error("Instagram container did not finish within 6 minutes.");
    }

    console.log("Publishing to Instagram...");

    const publication = await requestJson(
      `https://graph.instagram.com/${apiVersion}/${account.instagram_user_id}/media_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          creation_id: container.id,
          access_token: account.access_token,
        }),
      },
    );

    if (!publication.id) {
      throw new Error("Instagram did not return a published media ID.");
    }

    const mediaUrl = new URL(
      `https://graph.instagram.com/${apiVersion}/${publication.id}`,
    );

    mediaUrl.searchParams.set("fields", "id,permalink,media_type,timestamp");
    mediaUrl.searchParams.set("access_token", account.access_token);

    const publishedMedia = await requestJson(mediaUrl);

    db.prepare(`
      UPDATE videos
      SET
        status = 'published',
        instagram_media_id = ?,
        instagram_permalink = ?,
        publish_error = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(
      publication.id,
      publishedMedia.permalink || null,
      new Date().toISOString(),
      video.id,
    );

    console.log(
      JSON.stringify(
        {
          result: "published",
          youtubeId: video.youtube_id,
          instagramMediaId: publication.id,
          permalink: publishedMedia.permalink || null,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown publisher error.";

    setVideoStatus(video.id, "failed", message);

    console.error(`Publishing failed: ${message}`);
    process.exitCode = 1;
  } finally {
    if (temporaryToken) {
      db.prepare(`
        DELETE FROM temporary_media_files
        WHERE token = ?
      `).run(temporaryToken);
    }

    rmSync(workDir, { recursive: true, force: true });
    lock.release();
    db.close();
  }
}

main();
