import Link from "next/link";
import { SyncYouTubeButton } from "@/components/SyncYouTubeButton";
import { skipVideo, retryFailedVideo } from "@/app/actions";
import { getInstagramAccount, listVideos, getSetting, type VideoStatus } from "@/lib/db";
import { ReviewQueueClient } from "@/components/ReviewQueueClient";
import { AutoApproveToggle } from "@/components/AutoApproveToggle";

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
  const autoApprove = getSetting("auto_approve_shorts") === "1";
  const waitingVideos = videos.filter((v) => v.status === "waiting_approval");
  const otherVideos = videos.filter((v) => v.status !== "waiting_approval");

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
                <a
                  href="/api/auth/instagram"
                  className="mt-2 inline-block text-xs font-medium underline underline-offset-4"
                >
                  Reconnect Instagram
                </a>
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
          <AutoApproveToggle enabled={autoApprove} />
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

          <div className="mb-10">
            <ReviewQueueClient videos={waitingVideos} />
          </div>

          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Processed Videos</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Videos that have been approved, published, skipped, or failed.
              </p>
            </div>
          </div>

          <div className="grid gap-6">
            {otherVideos.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 shadow-sm">
                No processed videos yet.
              </div>
            ) : (
              otherVideos.map((video) => (
                <ProcessedVideoCard key={video.id} video={video} />
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

function ProcessedVideoCard({ video }: { video: ReturnType<typeof listVideos>[0] }) {
  const youtubeUrl = `https://youtube.com/shorts/${video.youtubeId}`;
  
  return (
    <details className="group flex flex-col gap-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-start gap-4 focus:outline-none">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
              {video.sourceType === "short" ? "YouTube Short" : "YouTube Video"}
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
          <h3 className="text-base font-semibold group-open:text-zinc-900">{video.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {formatDuration(video.durationSeconds)} · {formatPublishedAt(video.publishedAt)}
          </p>
        </div>

        {video.status === "failed" && (
           <form action={retryFailedVideo} className="shrink-0" onClick={(e) => e.stopPropagation()}>
             <input type="hidden" name="id" value={video.id} />
             <button
               type="submit"
               className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
             >
               Retry publish
             </button>
           </form>
        )}
      </summary>
      
      <div className="mt-6 grid gap-6 border-t border-zinc-100 pt-6 md:grid-cols-2">
        <div>
          <div className="mb-4">
            <h4 className="mb-2 text-sm font-medium text-zinc-700">Caption used</h4>
            <p className="whitespace-pre-line rounded-xl border border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-600">
              {video.description || "No caption provided."}
            </p>
          </div>
          
          <div className="mb-4">
            <h4 className="mb-2 text-sm font-medium text-zinc-700">External Links</h4>
            <div className="flex flex-col gap-2">
              <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                View original YouTube Short ↗
              </a>
              {video.instagramPermalink && (
                <a href={video.instagramPermalink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  View published Instagram Post ↗
                </a>
              )}
            </div>
          </div>
          {video.publishError && (
             <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
               <h4 className="mb-1 text-sm font-medium text-red-800">Publishing Error</h4>
               <p className="break-words text-xs text-red-700">{video.publishError}</p>
             </div>
          )}
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
    </details>
  );
}
