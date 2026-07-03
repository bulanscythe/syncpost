import { NextResponse } from "next/server";
import { syncYouTubeChannel } from "@/lib/youtube";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const refreshMetadata =
      new URL(request.url).searchParams.get("refreshMetadata") === "1";

    const result = await syncYouTubeChannel({ refreshMetadata });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "YouTube sync failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
