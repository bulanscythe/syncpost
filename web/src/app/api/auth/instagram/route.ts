import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!appId || !redirectUri) {
    return new NextResponse("Instagram environment variables are missing.", {
      status: 500,
    });
  }

  const state = randomBytes(32).toString("hex");
  createOAuthState(state, "instagram");

  const authorizationUrl = new URL("https://www.instagram.com/oauth/authorize");
  authorizationUrl.searchParams.set("client_id", appId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set(
    "scope",
    "instagram_business_basic,instagram_business_content_publish",
  );
  authorizationUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizationUrl);
}
