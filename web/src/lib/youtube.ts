import { execFileSync } from "node:child_process";
import {
  getVideoByYouTubeId,
  removeDevelopmentVideos,
  upsertYouTubeVideo,
  getSetting,
  listVideos,
  deleteVideo,
  type SourceType,
  type Video,
  type YouTubeVideoInput,
} from "@/lib/db";

type XmlRecord = Record<string, unknown>;

type FeedVideo = {
  youtubeId: string;
  title: string;
  description: string;
  sourceType: SourceType;
  sourceUrl: string;
  thumbnailUrl: string | null;
  publishedAt: string;
};

function asRecord(value: unknown): XmlRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as XmlRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asText(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function fetchChannelVideosWithYtDlp(channelId: string): FeedVideo[] {
  const url = `https://www.youtube.com/channel/${channelId}`;
  const raw = execFileSync(
    "yt-dlp",
    [
      "--dump-single-json",
      "--playlist-items",
      "1-15",
      "--flat-playlist",
      url,
    ],
    {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  const playlist = JSON.parse(raw) as Record<string, unknown>;
  const entries = asArray(playlist.entries);

  return entries.flatMap((rawEntry) => {
    const entry = asRecord(rawEntry);
    const youtubeId = asText(entry.id);
    const title = asText(entry.title);
    const sourceUrl = asText(entry.url);

    // SyncPost is primarily for Shorts. You can remove the includes("/shorts/") check if you want to sync all videos.
    if (!youtubeId || !sourceUrl || !sourceUrl.includes("/shorts/")) return [];

    const thumbnails = asArray(entry.thumbnails).map(asRecord);
    const thumbnailUrl = asText(thumbnails[0]?.url) || null;

    return [
      {
        youtubeId,
        title: title || "Untitled YouTube upload",
        description: "",
        sourceType: sourceUrl.includes("/shorts/") ? "short" : "video",
        sourceUrl,
        thumbnailUrl,
        publishedAt: new Date().toISOString(),
      },
    ];
  });
}

function useFeedData(
  video: FeedVideo,
  existing?: Video,
): YouTubeVideoInput {
  return {
    youtubeId: video.youtubeId,
    title: video.title,
    description: video.description,
    sourceType: video.sourceType,
    sourceUrl: video.sourceUrl,
    thumbnailUrl: existing?.thumbnailUrl || video.thumbnailUrl,
    durationSeconds: existing?.durationSeconds ?? 0,
    metadataError: existing?.metadataError ?? null,
    publishedAt: existing?.publishedAt ?? video.publishedAt,
  };
}

function enrichWithYtDlp(
  video: FeedVideo,
  existing?: Video,
): YouTubeVideoInput & { isDeleted?: boolean } {
  try {
    const raw = execFileSync(
      "yt-dlp",
      [
        "--skip-download",
        "--no-playlist",
        "--dump-single-json",
        video.sourceUrl,
      ],
      {
        encoding: "utf8",
        timeout: 90_000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const metadata = JSON.parse(raw) as Record<string, unknown>;

    let publishedAt = video.publishedAt;
    if (typeof metadata.timestamp === "number") {
      publishedAt = new Date(metadata.timestamp * 1000).toISOString();
    } else if (typeof metadata.upload_date === "string" && metadata.upload_date.length === 8) {
      const ud = metadata.upload_date;
      publishedAt = new Date(`${ud.slice(0, 4)}-${ud.slice(4, 6)}-${ud.slice(6, 8)}T00:00:00Z`).toISOString();
    }

    return {
      ...useFeedData(video, existing),
      title:
        typeof metadata.title === "string" && metadata.title.trim()
          ? metadata.title
          : video.title,
      description:
        typeof metadata.description === "string"
          ? metadata.description
          : video.description,
      thumbnailUrl:
        typeof metadata.thumbnail === "string"
          ? metadata.thumbnail
          : video.thumbnailUrl,
      durationSeconds:
        typeof metadata.duration === "number"
          ? Math.round(metadata.duration)
          : existing?.durationSeconds ?? 0,
      publishedAt,
      metadataError: null,
    };
  } catch (error: any) {
    const stderr = error.stderr?.toString() || error.message || "";
    
    // Check if video is deleted/private
    if (
      stderr.includes("Video unavailable") ||
      stderr.includes("Private video") ||
      stderr.includes("not found")
    ) {
      return {
        ...useFeedData(video, existing),
        isDeleted: true,
      };
    }

    if (existing) {
      return useFeedData(video, existing);
    }

    return {
      ...useFeedData(video),
      metadataError:
        "Could not read full YouTube metadata. This video may require a logged-in YouTube session.",
    };
  }
}

export async function syncYouTubeChannel({
  refreshMetadata = false,
}: {
  refreshMetadata?: boolean;
} = {}) {
  const channelId = process.env.YOUTUBE_CHANNEL_ID?.trim();

  if (!channelId) {
    throw new Error("YOUTUBE_CHANNEL_ID is missing from .env.local.");
  }

  const entries = fetchChannelVideosWithYtDlp(channelId);

  removeDevelopmentVideos();

  let metadataIncomplete = 0;
  let metadataLookups = 0;

  const autoApprove = getSetting("auto_approve_shorts") === "1";

  // Build a map of the recent entries for quick lookup
  const recentYoutubeIds = new Set(entries.map(e => e.youtubeId));

  // Get all existing waiting_approval videos from DB
  const waitingVideos = listVideos().filter(v => v.status === "waiting_approval");
  
  // Combine recent entries and old waiting videos so we can check if they are deleted
  for (const waiting of waitingVideos) {
    if (!recentYoutubeIds.has(waiting.youtubeId)) {
      entries.push({
        youtubeId: waiting.youtubeId,
        title: waiting.title,
        description: waiting.description,
        sourceType: waiting.sourceType,
        sourceUrl: waiting.sourceUrl,
        thumbnailUrl: waiting.thumbnailUrl,
        publishedAt: waiting.publishedAt,
      });
    }
  }

  for (const entry of entries) {
    const existing = getVideoByYouTubeId(entry.youtubeId);
    
    // Always enrich if refreshing, if it's new, or if we are verifying an old waiting video not in the recent list
    const isOldWaiting = existing?.status === "waiting_approval" && !recentYoutubeIds.has(entry.youtubeId);
    const shouldEnrich = refreshMetadata || !existing || isOldWaiting;

    const videoResult: YouTubeVideoInput & { isDeleted?: boolean } = shouldEnrich
      ? enrichWithYtDlp(entry, existing || undefined)
      : useFeedData(entry, existing);

    if (shouldEnrich) {
      metadataLookups += 1;
    }

    if (videoResult.isDeleted && existing) {
      deleteVideo(existing.id);
      continue;
    }

    if (videoResult.metadataError) {
      metadataIncomplete += 1;
    }
    
    if (autoApprove && (!existing || existing.status === "waiting_approval")) {
      videoResult.status = "approved";
      videoResult.targetType = "reel";
    }

    upsertYouTubeVideo(videoResult);
  }

  return {
    synced: entries.length,
    metadataIncomplete,
    metadataLookups,
  };
}
