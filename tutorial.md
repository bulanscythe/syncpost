# SyncPost Installation Guide (Self-Hosted)

SyncPost is a smart automation system that functions to synchronize (fetch) your YouTube Shorts videos, allowing you to review/edit captions on a dashboard, and then automatically upload them to Instagram Reels.

This system is designed to be highly portable and can be run by anyone locally (on a computer, VPS, or Mac) as long as this *source code* is available.

---

## System Requirements
Before starting, ensure your computer/server has installed the following mandatory tools:
1. **Node.js (version 22.5 or newer)**: This application uses the built-in `node:sqlite` module which is only available in the latest versions. ([Download Node.js](https://nodejs.org/)).
2. **yt-dlp**: A video extractor used to read YouTube metadata. (Install via Homebrew on Mac: `brew install yt-dlp` or follow the [official guide](https://github.com/yt-dlp/yt-dlp)).
3. **FFmpeg & FFprobe**: Required by yt-dlp to process videos. (Mac: `brew install ffmpeg`).
4. **Tailscale (Or Ngrok)**: Needed to open a "Tunnel/Funnel" so the Instagram server can communicate with your local application. ([Download Tailscale](https://tailscale.com/)).

---

## Step 1: Prepare Credentials

You must have a **YouTube Channel ID** and a **Meta Developer App** to interact with the official APIs.

### A. Getting YouTube Channel ID
1. Open the YouTube page of your target channel.
2. The Channel ID is usually in the URL (example: `https://www.youtube.com/channel/UCt-E5YaQaRHTsIoPbj3Mzpg`).
   *(Use a third-party website like CommentPicker if your channel URL uses a @handle).*

### B. Creating Tailscale Funnel URL
1. Open your terminal, turn on Tailscale and run the command: `tailscale funnel 3002`.
2. Open a new terminal tab, type `tailscale status`.
3. Note your `https://computer-name.tailxxxx.ts.net` address. This address is needed for Step C.

### C. Creating Meta Developer App (Instagram API)
1. Visit [Meta for Developers](https://developers.facebook.com/) and *login*.
2. Click **Create App**, select **Consumer** or **Business** type.
3. Go to **App Settings > Basic** to copy the **App ID** and **App Secret**.
4. Add the **Instagram Graph API** product.
5. In the Instagram API settings, enter the **Valid OAuth Redirect URIs** with the format: `[YOUR_TAILSCALE_URL]/api/auth/instagram/callback` *(Example: https://hello.tailxxx.ts.net/api/auth/instagram/callback)*.
6. **Mandatory:** Add the Instagram account that will be used as a trial account (Tester) in the *App Roles > Roles* menu (if the app is still in Development mode).

---

## Step 2: Automatic Installation (Preflight)

You do not need to configure the database or install *libraries* manually. We have provided a *Preflight* script.

1. Open the `preflight.sh` *file* inside this *source code* folder using a Text Editor.
2. Look for the **USER CONFIGURATION** section at the very top of the script.
3. Enter the `YOUTUBE_CHANNEL_ID`, `TAILSCALE_PUBLIC_URL`, `INSTAGRAM_APP_ID`, and `INSTAGRAM_APP_SECRET` with the data you obtained in Step 1.
4. Open the terminal, navigate to this application folder, and run:
   ```bash
   ./preflight.sh
   ```
5. The script will automatically:
   - Create a secret configuration file (`.env.local`)
   - Download and install all libraries (*npm install*)
   - Build and initialize the SQLite Database schema automatically.

---

## Step 3: Running the System

After Preflight finishes, your system is ready to operate!
Run this single command to turn on the **entire ecosystem** of SyncPost:

```bash
./run-all.sh
```

This command will start 4 main engines simultaneously in your terminal, wrapped in auto-restarting loops to ensure maximum uptime and self-healing if a crash occurs:
- **Next.js Web Server**: Dashboard interface on port 3000.
- **Public Gateway**: A secure communication bridge with Instagram on port 3002.
- **Publisher Daemon**: A robot that runs every 1 minute to upload videos to Instagram.
- **YouTube Sync Daemon**: A robot that runs every 15 minutes to detect new Shorts videos on your Channel.

---

## Step 4: How to Use (Dashboard)

1. Open your browser and visit **http://localhost:3000**.
2. **IG Connection**: Click the black `Connect Instagram` button. You will be redirected to the Meta page to grant access permissions to your Tester Instagram account.
3. **Sync YouTube**: If the Sync Daemon hasn't worked yet, you can force it by clicking the `Sync YouTube` button on the Dashboard.
4. **Approve**: All new Shorts will appear on the Dashboard. You can watch the videos, edit captions, and choose (Reels / Post).
5. **Bulk Action**: Check several videos, then click `Approve Selected`. The videos will enter the queue, and the *Publisher Daemon* will automatically upload them one by one in the next few minutes!

*(Tip: If you want new Shorts videos to be automatically uploaded without having to press the Approve button, activate the green **Auto-Approve Shorts** toggle at the top of the dashboard).*
