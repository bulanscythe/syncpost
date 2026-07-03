import { execFileSync } from "node:child_process";
import { XMLParser } from "fast-xml-parser";
import {
  getVideoByYouTubeId,
  removeDevelopmentVideos,
  upsertYouTubeVideo,
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

function parseFeed(xml: string): FeedVideo[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const parsed = asRecord(parser.parse(xml));
  const feed = asRecord(parsed.feed);
  const entries = asArray(feed.entry);

  return entries.flatMap((rawEntry) => {
    const entry = asRecord(rawEntry);
    const youtubeId = asText(entry["yt:videoId"]);

    const links = asArray(entry.link).map(asRecord);
    const sourceUrl = asText(
      links.find((link) => link["@_rel"] === "alternate")?.["@_href"],
    );

    if (!youtubeId || !sourceUrl) return [];

    const mediaGroup = asRecord(entry["media:group"]);
    const thumbnails = asArray(mediaGroup["media:thumbnail"]).map(asRecord);
    const thumbnailUrl =
      asText(thumbnails[0]?.["@_url"]) || null;

    return [
      {
        youtubeId,
        title: asText(entry.title) || "Untitled YouTube upload",
        description: asText(mediaGroup["media:description"]),
        sourceType: sourceUrl.includes("/shorts/") ? "short" : "video",
        sourceUrl,
        thumbnailUrl,
        publishedAt: asText(entry.published) || new Date().toISOString(),
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
    publishedAt: video.publishedAt,
  };
}

function enrichWithYtDlp(
  video: FeedVideo,
  existing?: Video,
): YouTubeVideoInput {
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
      metadataError: null,
    };
  } catch {
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

  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`YouTube RSS request failed with status ${response.status}.`);
  }

  const entries = parseFeed(await response.text());

  removeDevelopmentVideos();

  let metadataIncomplete = 0;
  let metadataLookups = 0;

  for (const entry of entries) {
    const existing = getVideoByYouTubeId(entry.youtubeId);
    const shouldEnrich = refreshMetadata || !existing;

    const video = shouldEnrich
      ? enrichWithYtDlp(entry, existing || undefined)
      : useFeedData(entry, existing);

    if (shouldEnrich) {
      metadataLookups += 1;
    }

    if (video.metadataError) {
      metadataIncomplete += 1;
    }

    upsertYouTubeVideo(video);
  }

  return {
    synced: entries.length,
    metadataIncomplete,
    metadataLookups,
  };
}
