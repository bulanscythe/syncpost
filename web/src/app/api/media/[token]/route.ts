import { appendFileSync, createReadStream, existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { getTemporaryMediaFile } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  appendFileSync(
    resolve(process.cwd(), "..", "tmp", "media-access.log"),
    JSON.stringify({
      at: new Date().toISOString(),
      token,
      method: request.method,
      userAgent: request.headers.get("user-agent"),
      range: request.headers.get("range"),
      cloudflareIp: request.headers.get("cf-connecting-ip"),
    }) + "\n",
  );

  const media = getTemporaryMediaFile(token);

  if (!media || new Date(media.expiresAt) <= new Date()) {
    return new Response("Temporary media link not found or expired.", {
      status: 404,
    });
  }

  const allowedRoot = `${resolve(process.cwd(), "..", "tmp")}${sep}`;
  const filePath = resolve(media.absolutePath);

  if (!filePath.startsWith(allowedRoot) || !existsSync(filePath)) {
    return new Response("Temporary media file is unavailable.", {
      status: 404,
    });
  }

  const fileSize = statSync(filePath).size;
  const range = request.headers.get("range");

  const commonHeaders = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };

  if (!range) {
    return new Response(
      Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream,
      {
        status: 200,
        headers: {
          ...commonHeaders,
          "Content-Length": String(fileSize),
        },
      },
    );
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);

  if (!match) {
    return new Response("Invalid range.", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileSize}`,
      },
    });
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1;

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= fileSize
  ) {
    return new Response("Requested range is not satisfiable.", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileSize}`,
      },
    });
  }

  return new Response(
    Readable.toWeb(
      createReadStream(filePath, { start, end }),
    ) as unknown as ReadableStream,
    {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      },
    },
  );
}
