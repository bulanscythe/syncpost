const videos = [
  {
    id: "yt-001",
    title: "How to Pick a Startup Idea",
    description: "A short thought about finding problems worth solving.\n\n#startup #entrepreneurship",
    sourceType: "YouTube Short",
    duration: "0:42",
    publishedAt: "Today, 19:20",
    status: "Waiting approval",
  },
  {
    id: "yt-002",
    title: "Why Being Busy Is Not Enough",
    description: "Being busy can feel productive, but usefulness comes from moving the right thing forward.",
    sourceType: "YouTube Short",
    duration: "0:57",
    publishedAt: "Today, 17:05",
    status: "Waiting approval",
  },
  {
    id: "yt-003",
    title: "What Makes a Good Decision?",
    description: "A quick reflection on decisions, uncertainty, and momentum.",
    sourceType: "YouTube Short",
    duration: "0:31",
    publishedAt: "Yesterday, 20:10",
    status: "Published",
  },
  {
    id: "yt-004",
    title: "When Should You Start?",
    description: "You usually do not need more certainty. You need a small first move.",
    sourceType: "YouTube Short",
    duration: "0:49",
    publishedAt: "Yesterday, 16:45",
    status: "Skipped",
  },
];

export default function Home() {
  const waiting = videos.filter((video) => video.status === "Waiting approval");

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-5 border-b border-zinc-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-500">YouTube → Instagram</p>
            <h1 className="text-4xl font-semibold tracking-tight">Younstagram</h1>
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
          <Stat label="Waiting approval" value={waiting.length.toString()} />
          <Stat label="Published today" value="0" />
          <Stat label="Failed uploads" value="0" />
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
                  {video.duration}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {video.sourceType}
                    </span>
                    <StatusBadge status={video.status} />
                  </div>

                  <h3 className="truncate text-base font-semibold">{video.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{video.publishedAt}</p>
                  <p className="mt-3 line-clamp-2 whitespace-pre-line text-sm text-zinc-600">
                    {video.description}
                  </p>
                </div>

                {video.status === "Waiting approval" ? (
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Waiting approval": "bg-amber-50 text-amber-800 ring-amber-200",
    Published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    Skipped: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${styles[status]}`}>
      {status}
    </span>
  );
}
