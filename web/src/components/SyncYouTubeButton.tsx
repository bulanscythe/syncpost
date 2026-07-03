"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncYouTubeButton() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setIsSyncing(true);
    setMessage(null);

    try {
      const response = await fetch("/api/sync/youtube", {
        method: "POST",
      });

      const result = (await response.json()) as {
        synced?: number;
        metadataIncomplete?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "YouTube sync failed.");
      }

      const incompleteMessage =
        result.metadataIncomplete && result.metadataIncomplete > 0
          ? ` ${result.metadataIncomplete} need YouTube login.`
          : "";

      setMessage(`Synced ${result.synced ?? 0} uploads.${incompleteMessage}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "YouTube sync failed.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSyncing ? "Syncing YouTube..." : "Sync YouTube"}
      </button>

      {message && (
        <p className="max-w-56 text-right text-xs text-zinc-500">
          {message}
        </p>
      )}
    </div>
  );
}
