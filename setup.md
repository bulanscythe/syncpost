# SyncPost Setup & Account Switching Guide

This document explains the steps you need to prepare if you want to connect SyncPost to a different YouTube Channel or Instagram Account, or when setting up this system on a new device for the first time.

## 1. YouTube Preparation
To connect a YouTube Channel, you only need a **YouTube Channel ID**.
1. Open the YouTube page of your target channel.
2. The Channel ID is usually in the URL (example: `https://www.youtube.com/channel/UCt-E5YaQaRHTsIoPbj3Mzpg`).
3. If it uses the *handle* format (`@username`), you can find the actual Channel ID using various free online tools (like [CommentPicker](https://commentpicker.com/youtube-channel-id.php)) or from the YouTube page's *source code*.

## 2. Public Network Preparation (Tailscale Funnel)
Instagram requires a publicly accessible address starting with `https://` to receive login *Callbacks*.
1. Ensure **Tailscale** is installed and your account is active.
2. Run the command `tailscale funnel 3002` to open a *tunnel* connected to this app's Public Gateway port.
3. Check your *funnel* URL status with `tailscale status`. This URL is usually formatted as `https://device-name.tailxxxx.ts.net`. This URL will be your `SYNCPOST_PUBLIC_BASE_URL`.

## 3. Meta Developer Preparation (Instagram Graph API)
To log in and upload videos to Instagram, you need an App ID and App Secret from the Meta developer platform.
1. Visit [Meta for Developers](https://developers.facebook.com/) and *login*.
2. Click **Create App**, select **Consumer** or **Business** type.
3. Go to **App Settings > Basic** to get your **App ID** and **App Secret**.
4. In the left panel, add the **Instagram Graph API** product.
5. Enter **Valid OAuth Redirect URIs**. The value must be exactly:
   `[YOUR_TAILSCALE_URL]/api/auth/instagram/callback`
   *(Example: `https://perrys-macbook-air.tailb60877.ts.net/api/auth/instagram/callback`)*
6. **Very Important:** Because your app might still be in "Development" status (not publicly approved by Facebook), you must add the target Instagram account to the **Tester** list under *App Roles > Roles*. Only tester accounts can be used to *login*!

## 4. System Configuration (preflight.sh)
Instead of modifying hidden configuration *files* (`.env.local`) manually, we have provided a special *script* called `preflight.sh`.

- Open the `preflight.sh` *file* in your *text editor*.
- Replace the variable values at the top (*USER CONFIGURATION*) with the data you obtained from steps 1-3.
- Save it, then open the terminal and run:
  ```bash
  ./preflight.sh
  ```
- This *script* will automatically save all keys to the correct places and give you the option to wipe the old database so the previous YouTube/Instagram account data is completely replaced by the new ones.

## 5. Run the Application
After `preflight.sh` finishes:
1. Run `./run-all.sh`. This starts all services with an auto-restart (self-healing) mechanism enabled.
2. Open the Dashboard at `http://localhost:3000`.
3. Click **Connect Instagram** to link your new target account.
4. Click **Sync YouTube** to pull *Shorts* from your new channel.
