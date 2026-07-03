# SyncPost

SyncPost automates publishing YouTube videos to Instagram using the Meta API.

## Architecture & Hardening

### Global Publisher Lock
The publisher process (`web/scripts/process-approved-video.mjs`) uses a robust lock file mechanism (`tmp/publisher.lock/owner.json`). Only one publisher process can run at a time to prevent duplicate publishes and data corruption. If a process crashes, the lock records the PID, hostname, and start time, and a new process can safely reclaim the lock once it confirms the previous PID is dead.

### Stuck-Job Recovery & Crash Safety
If a publisher crashes while a video is:
- **Downloading**: The video is automatically reset to `approved` status after `SYNCPOST_STUCK_JOB_MINUTES` (default 30 mins) on the next run.
- **Publishing**: The video is safely transitioned to `failed`. Because an interruption during publishing might still result in a successful Instagram post, it requires human verification before a manual retry. 

### Manual Retry
Failed jobs will show a **Retry publish** button on the dashboard. Before clicking it, verify on the Instagram app that the video was not already published, to avoid duplicate posts.

### Token Refresh
Instagram long-lived tokens expire after 60 days. The script `web/scripts/refresh-instagram-token.mjs` (run via `run-token-refresh-once.sh`) can be scheduled (e.g. via cron/launchd once a day) to automatically refresh the token when it's within `SYNCPOST_TOKEN_REFRESH_WINDOW_DAYS` (default 14 days) of expiry.

## VPS Migration & Cron Setup

When migrating from macOS to a VPS (e.g. Ubuntu):
1. **Data Migration**: Copy the `data/` directory (contains the SQLite DB) and `web/.env.local`. Do NOT copy `tmp/` as it contains stale locks tied to the previous hostname.
2. **Cron Setup**: Schedule the background scripts. Example crontab:
   ```cron
   # Run the publisher every minute
   * * * * * cd /path/to/syncpost/web && ./scripts/run-publisher-once.sh >> logs/publisher.log 2>&1
   
   # Sync YouTube every 15 minutes
   */15 * * * * cd /path/to/syncpost/web && ./scripts/run-youtube-sync-once.sh >> logs/youtube.log 2>&1
   
   # Refresh Instagram token once a day
   0 0 * * * cd /path/to/syncpost/web && ./scripts/run-token-refresh-once.sh >> logs/token.log 2>&1
   ```
