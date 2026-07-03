# SyncPost

SyncPost is a smart, self-hosted automation system that synchronizes (fetches) your YouTube Shorts, allows you to review and edit captions on a local dashboard, and automatically publishes them to Instagram Reels or Feed Posts.

It is designed to be highly portable and can run locally on your computer, VPS, or Mac.

## Features

- **Automated YouTube Sync**: Automatically fetches new YouTube Shorts from your target channel every 15 minutes using a background daemon.
- **Instagram Publishing**: Publishes approved videos directly to Instagram via the official Instagram Graph API.
- **Review Dashboard**: A Next.js web dashboard where you can review fetched videos, edit captions, choose target formats (Reels or Feed Post), and approve them for publishing.
- **Auto-Approve Option**: Toggle auto-approve on the dashboard to bypass manual review and publish immediately.
- **Bulk Actions**: Select multiple videos at once to approve them for publishing.
- **Self-Hosted Ecosystem**: Operates via Next.js Web Server, a Public Gateway for Instagram Callbacks, a Publisher Daemon, and a YouTube Sync Daemon.
- **Auto-Recovery / Self-Healing**: The system runs robust background loops for all services, allowing it to automatically restart itself if any component crashes unexpectedly.

## Documentation

- [Installation Guide](tutorial.md): Step-by-step instructions on setting up SyncPost for the first time, including system requirements and API setup.
- [Setup & Account Switching Guide](setup.md): Guide for connecting SyncPost to a different YouTube Channel or Instagram Account, setting up Tailscale, and re-running the configuration script.

## Getting Started

To get started with SyncPost, please refer to the [Installation Guide](tutorial.md) for detailed prerequisites (Node.js, yt-dlp, FFmpeg, and Tailscale) and step-by-step setup instructions.
