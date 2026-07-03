import Link from "next/link";
import { SyncYouTubeButton } from "@/components/SyncYouTubeButton";
import { skipVideo } from "@/app/actions";
import { getInstagramAccount, listVideos, type VideoStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

const statusLabels: Record<VideoStatus, string> = {
  waiting_approval: "Waiting approval",
  approved: "Approved",
  downloading: "Downloading",
  publishing: "Publishing",
  published: "Published",
  skipped: "Skipped",
  failed: "Failed",
};

export default function Home() {
  const videos = listVideos();
  const instagramAccount = getInstagramAccount();

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-5 border-b border-zinc-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-500">
              YouTube → Instagram
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">
              SyncPost
            </h1>
            <p className="mt-3 max-w-xl text-zinc-600">
              Review new YouTube uploads before publishing them to Instagram.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-zinc-500">Instagram publishing account</p>
            {instagramAccount ? (
              <>
                <p className="mt-1 font-medium">@{instagramAccount.username}</p>
                <p className="mt-1 text-xs text-emerald-700">
                  Connected · {instagramAccount.accountType || "Professional"}
                </p>
              </>
            ) : (
              <a
                href="/api/auth/instagram"
                className="mt-2 inline-block rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
              >
                Connect Instagram
              </a>
            )}
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Waiting approval"
            value={videos
              .filter((video) => video.status === "waiting_approval")
              .length.toString()}
          />
          <Stat
            label="Approved for publishing"
            value={videos
              .filter((video) => video.status === "approved")
              .length.toString()}
          />
          <Stat
            label="Published"
            value={videos
              .filter((video) => video.status === "published")
              .length.toString()}
          />
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Review queue</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Caption is copied exactly from the YouTube description.
              </p>
            </div>

            <SyncYouTubeButton />
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {videos.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500">
                No videos yet. Sync YouTube to load recent public uploads.
              </div>
            ) : (
              videos.map((video) => (
                <article
                  key={video.id}
                  className="flex flex-col gap-5 border-b border-zinc-100 p-5 last:border-b-0 md:flex-row md:items-center"
                >
                  <div className="flex h-28 w-full shrink-0 items-end rounded-xl bg-zinc-900 p-3 text-xs font-medium text-white md:w-20">
                    {video.durationSeconds > 0
                      ? formatDuration(video.durationSeconds)
                      : "—"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                        {video.sourceType === "short"
                          ? "YouTube Short"
                          : "YouTube Video"}
                      </span>
                      <StatusBadge status={video.status} />
                      {video.targetType && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
                          {video.targetType === "reel" ? "Reel" : "Feed Post"}
                        </span>
                      )}
                      {video.metadataError && (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800">
                          Needs YouTube login
                        </span>
                      )}
                    </div>

                    <h3 className="truncate text-base font-semibold">
                      {video.title}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatPublishedAt(video.publishedAt)}
                    </p>
                    <p className="mt-3 line-clamp-2 whitespace-pre-line text-sm text-zinc-600">
                      {video.description || "No YouTube description."}
                    </p>
                  </div>

                  {video.status === "waiting_approval" ? (
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                      <Link
                        href={`/videos/${video.id}`}
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white"
                      >
                        Review & approve
                      </Link>

                      <form action={skipVideo}>
                        <input type="hidden" name="id" value={video.id} />
                        <button
                          type="submit"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium"
                        >
                          Skip
                        </button>
                      </form>
                    </div>
                  ) : (
                    <Link
                      href={`/videos/${video.id}`}
                      className="shrink-0 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium"
                    >
                      View details
                    </Link>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: VideoStatus }) {
  const styles: Record<VideoStatus, string> = {
    waiting_approval: "bg-amber-50 text-amber-800 ring-amber-200",
    approved: "bg-blue-50 text-blue-800 ring-blue-200",
    downloading: "bg-violet-50 text-violet-800 ring-violet-200",
    publishing: "bg-violet-50 text-violet-800 ring-violet-200",
    published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    skipped: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    failed: "bg-red-50 text-red-800 ring-red-200",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
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
    timeStyle: "short",
  }).format(new Date(value));
}
