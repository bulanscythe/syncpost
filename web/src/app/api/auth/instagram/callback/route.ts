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

  const longLivedTokenUrl = new URL(
    "https://graph.instagram.com/access_token",
  );
  longLivedTokenUrl.searchParams.set("grant_type", "ig_exchange_token");
  longLivedTokenUrl.searchParams.set("client_secret", appSecret);
  longLivedTokenUrl.searchParams.set("access_token", tokenPayload.access_token);

  const longLivedResponse = await fetch(longLivedTokenUrl, {
    cache: "no-store",
  });

  const longLivedPayload = (await longLivedResponse.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!longLivedResponse.ok || !longLivedPayload.access_token) {
    return new NextResponse(
      `Instagram long-lived token exchange failed: ${
        longLivedPayload.error?.message || "Unknown error"
      }`,
      { status: 400 },
    );
  }

  const accessToken = longLivedPayload.access_token;
  const accessTokenExpiresAt =
    typeof longLivedPayload.expires_in === "number"
      ? new Date(
          Date.now() + longLivedPayload.expires_in * 1000,
        ).toISOString()
      : null;

  const profileResponse = await fetch(
    `https://graph.instagram.com/v24.0/me?fields=id,username,account_type&access_token=${encodeURIComponent(
      accessToken,
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
    accessToken,
    accessTokenExpiresAt,
  });

  const dashboardBaseUrl =
    process.env.SYNCPOST_DASHBOARD_BASE_URL || "http://127.0.0.1:3000";

  return NextResponse.redirect(
    new URL("/?instagram=connected", dashboardBaseUrl),
  );
}
