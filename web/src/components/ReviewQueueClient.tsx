"use client";

import { useState } from "react";
import { type Video } from "@/lib/db";
import { skipVideo, bulkApproveVideos } from "@/app/actions";
import { type InstagramTarget } from "@/lib/db";

export function ReviewQueueClient({ videos }: { videos: Video[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [targetTypes, setTargetTypes] = useState<Record<string, InstagramTarget>>({});

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
      if (!(id in descriptions)) {
        setDescriptions((prev) => ({ ...prev, [id]: videos.find((v) => v.id === id)?.title || "" }));
      }
      if (!(id in targetTypes)) {
        setTargetTypes((prev) => ({ ...prev, [id]: "reel" }));
      }
    }
    setSelectedIds(newSet);
  };

  const handleDescriptionChange = (id: string, text: string) => {
    setDescriptions((prev) => ({ ...prev, [id]: text }));
  };

  const handleTargetTypeChange = (id: string, type: InstagramTarget) => {
    setTargetTypes((prev) => ({ ...prev, [id]: type }));
  };

  const handleBulkApprove = async () => {
    const data = Array.from(selectedIds).map((id) => ({
      id,
      description: descriptions[id] || "",
      targetType: targetTypes[id] || "reel",
    }));

    await bulkApproveVideos(data);
    setSelectedIds(new Set());
  };

  if (videos.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-zinc-500">
        No videos pending approval.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-600">
          {selectedIds.size} selected
        </p>
        <button
          onClick={handleBulkApprove}
          disabled={selectedIds.size === 0}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Approve Selected
        </button>
      </div>

      <div className="grid gap-6">
        {videos.map((video) => {
          const isSelected = selectedIds.has(video.id);
          const currentDesc = descriptions[video.id] ?? video.title;
          const currentTarget = targetTypes[video.id] ?? "reel";

          return (
            <article
              key={video.id}
              className={`flex flex-col gap-6 overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition ${
                isSelected ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200"
              }`}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(video.id)}
                  className="mt-1 h-5 w-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                />
                
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      YouTube Short
                    </span>
                    {video.metadataError && (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800">
                        Needs YouTube login
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold">{video.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatDuration(video.durationSeconds)} ·{" "}
                    {formatPublishedAt(video.publishedAt)}
                  </p>
                </div>
                
                <form action={skipVideo} className="shrink-0">
                  <input type="hidden" name="id" value={video.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium"
                  >
                    Skip
                  </button>
                </form>
              </div>

              {isSelected && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-sm font-medium text-zinc-700">Caption</label>
                    </div>
                    <textarea
                      value={currentDesc}
                      onChange={(e) => handleDescriptionChange(video.id, e.target.value)}
                      rows={5}
                      className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />

                    <div className="mt-4">
                      <p className="mb-2 text-sm font-medium text-zinc-700">Target</p>
                      <div className="flex gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`target-${video.id}`}
                            value="reel"
                            checked={currentTarget === "reel"}
                            onChange={() => handleTargetTypeChange(video.id, "reel")}
                            className="text-zinc-900 focus:ring-zinc-900"
                          />
                          Reel
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`target-${video.id}`}
                            value="feed_post"
                            checked={currentTarget === "feed_post"}
                            onChange={() => handleTargetTypeChange(video.id, "feed_post")}
                            className="text-zinc-900 focus:ring-zinc-900"
                          />
                          Feed Post
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl bg-zinc-900">
                    <iframe
                      width="100%"
                      height="315"
                      src={`https://www.youtube.com/embed/${video.youtubeId}`}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="h-full min-h-[250px] w-full"
                    ></iframe>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}
