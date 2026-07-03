import { NextResponse } from "next/server";
import { syncYouTubeChannel } from "@/lib/youtube";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await syncYouTubeChannel();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "YouTube sync failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
