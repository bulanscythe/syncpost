import Link from "next/link";
import { notFound } from "next/navigation";
import { approveVideo, skipVideo } from "@/app/actions";
import { getVideoById } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VideoReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const video = getVideoById(id);

  if (!video) notFound();

  const canReview =
    video.status === "waiting_approval" && !video.metadataError;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Back to queue
        </Link>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
              {video.sourceType === "short" ? "YouTube Short" : "YouTube Video"}
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              {video.status.replaceAll("_", " ")}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight">
            {video.title}
          </h1>

          <dl className="mt-7 grid gap-5 border-y border-zinc-100 py-6 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Source</dt>
              <dd className="mt-1 font-medium">
                <a
                  href={video.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Open on YouTube
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-zinc-500">Duration</dt>
              <dd className="mt-1 font-medium">
                {video.durationSeconds > 0
                  ? `${Math.floor(video.durationSeconds / 60)}:${(
                      video.durationSeconds % 60
                    )
                      .toString()
                      .padStart(2, "0")}`
                  : "Unavailable"}
              </dd>
            </div>
          </dl>

          <div className="mt-7">
            <p className="text-sm font-medium text-zinc-500">
              Instagram caption
            </p>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
              {video.description || "No YouTube description."}
            </div>
          </div>

          {video.metadataError ? (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
              <p className="font-medium">This upload needs YouTube login.</p>
              <p className="mt-1">{video.metadataError}</p>
              <p className="mt-2">
                Do not approve it yet. We will connect your logged-in browser
                session before we build the downloader.
              </p>
            </div>
          ) : canReview ? (
            <div className="mt-8">
              <p className="text-sm font-medium text-zinc-500">
                Instagram destination
              </p>

              <form action={approveVideo} className="mt-3 space-y-5">
                <input type="hidden" name="id" value={video.id} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="cursor-pointer rounded-xl border border-zinc-300 p-4 transition hover:border-zinc-500">
                    <input
                      type="radio"
                      name="targetType"
                      value="reel"
                      defaultChecked
                      className="mr-2"
                    />
                    <span className="font-medium">Reel</span>
                    <p className="mt-2 text-sm text-zinc-500">
                      Publish this video as an Instagram Reel.
                    </p>
                  </label>

                  <label className="cursor-pointer rounded-xl border border-zinc-300 p-4 transition hover:border-zinc-500">
                    <input
                      type="radio"
                      name="targetType"
                      value="feed_post"
                      className="mr-2"
                    />
                    <span className="font-medium">Feed Post</span>
                    <p className="mt-2 text-sm text-zinc-500">
                      Publish this video as a video post in the feed.
                    </p>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white"
                >
                  Approve for Instagram publishing
                </button>
              </form>

              <form action={skipVideo} className="mt-3">
                <input type="hidden" name="id" value={video.id} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium"
                >
                  Skip this video
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-8 rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700">
              This item has already been marked as{" "}
              <span className="font-medium">
                {video.status.replaceAll("_", " ")}
              </span>.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
