import { NextRequest, NextResponse } from "next/server";
import {
  consumeOAuthState,
  saveInstagramAccount,
} from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription =
    request.nextUrl.searchParams.get("error_description");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (error) {
    return new NextResponse(
      `Instagram login failed: ${errorDescription || error}`,
      { status: 400 },
    );
  }

  if (!code || !state) {
    return new NextResponse(
      "Instagram callback is missing an authorization code or state.",
      { status: 400 },
    );
  }

  if (!consumeOAuthState(state, "instagram")) {
    return new NextResponse(
      "This Instagram login request expired or could not be verified. Start again from SyncPost.",
      { status: 400 },
    );
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    return new NextResponse("Instagram environment variables are missing.", {
      status: 500,
    });
  }

  const tokenResponse = await fetch(
    "https://api.instagram.com/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
      cache: "no-store",
    },
  );

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    user_id?: string | number;
    error_type?: string;
    error_message?: string;
  };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    return new NextResponse(
      `Instagram token exchange failed: ${
        tokenPayload.error_message || tokenPayload.error_type || "Unknown error"
      }`,
      { status: 400 },
    );
  }

  const profileResponse = await fetch(
    `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${encodeURIComponent(
      tokenPayload.access_token,
    )}`,
    { cache: "no-store" },
  );

  const profile = (await profileResponse.json()) as {
    id?: string | number;
    username?: string;
    account_type?: string;
    error?: { message?: string };
  };

  if (!profileResponse.ok || !profile.id || !profile.username) {
    return new NextResponse(
      `Instagram profile lookup failed: ${
        profile.error?.message || "Unknown error"
      }`,
      { status: 400 },
    );
  }

  saveInstagramAccount({
    instagramUserId: String(profile.id),
    username: profile.username,
    accountType: profile.account_type || null,
    accessToken: tokenPayload.access_token,
  });

  return NextResponse.redirect(new URL("/?instagram=connected", redirectUri));
}
