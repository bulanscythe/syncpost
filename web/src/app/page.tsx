import { listVideos, type VideoStatus } from "@/lib/db";

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
  const waiting = videos.filter(
    (video) => video.status === "waiting_approval",
  ).length;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-5 border-b border-zinc-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-500">
              YouTube → Instagram
            </p>
            <h1 className="text-4xl font-semibold tracking-tight">
              Younstagram
            </h1>
            <p className="mt-3 max-w-xl text-zinc-600">
              Review new YouTube uploads before publishing them to Instagram.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-zinc-500">Whitelisted channel</p>
            <p className="mt-1 font-medium">Dummy YouTube Channel</p>
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Waiting approval" value={waiting.toString()} />
          <Stat
            label="Published"
            value={videos
              .filter((video) => video.status === "published")
              .length.toString()}
          />
          <Stat
            label="Failed uploads"
            value={videos
              .filter((video) => video.status === "failed")
              .length.toString()}
          />
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Review queue</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Approve videos only after checking the caption and Instagram destination.
              </p>
            </div>

            <button className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium shadow-sm">
              Refresh queue
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {videos.map((video) => (
              <article
                key={video.id}
                className="flex flex-col gap-5 border-b border-zinc-100 p-5 last:border-b-0 md:flex-row md:items-center"
              >
                <div className="flex h-28 w-full shrink-0 items-end rounded-xl bg-zinc-900 p-3 text-xs font-medium text-white md:w-20">
                  {formatDuration(video.durationSeconds)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {video.sourceType === "short"
                        ? "YouTube Short"
                        : "YouTube Video"}
                    </span>
                    <StatusBadge status={video.status} />
                  </div>

                  <h3 className="truncate text-base font-semibold">
                    {video.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatPublishedAt(video.publishedAt)}
                  </p>
                  <p className="mt-3 line-clamp-2 whitespace-pre-line text-sm text-zinc-600">
                    {video.description}
                  </p>
                </div>

                {video.status === "waiting_approval" ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                    <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
                      Review & approve
                    </button>
                    <button className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium">
                      Skip
                    </button>
                  </div>
                ) : (
                  <button className="shrink-0 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium">
                    View details
                  </button>
                )}
              </article>
            ))}
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
