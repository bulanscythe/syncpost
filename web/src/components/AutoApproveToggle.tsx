"use client";

import { useTransition } from "react";
import { toggleAutoApprove } from "@/app/actions";

export function AutoApproveToggle({ enabled }: { enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(() => {
      toggleAutoApprove(!enabled);
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex-1">
        <p className="text-sm font-medium text-zinc-900">Auto-Approve Shorts</p>
        <p className="text-xs text-zinc-500">
          Automatically approve new shorts.
        </p>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 ${
          enabled ? "bg-emerald-500" : "bg-zinc-200"
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
