#!/bin/bash
# run-all.sh - Menjalankan semua layanan SyncPost di terminal

# Arahkan ke folder web
cd "$(dirname "$0")/web" || exit 1

echo "==========================================="
echo " Starting ALL SyncPost Services in Terminal"
echo "==========================================="

# Bersiap menampung PID proses background
WEB_PID=""
GATEWAY_PID=""
PUBLISHER_PID=""
SYNC_PID=""

# Fungsi untuk mematikan semua proses saat menerima Ctrl+C
cleanup() {
  echo ""
  echo "==========================================="
  echo " Stopping SyncPost Services..."
  echo "==========================================="
  kill "$WEB_PID" "$GATEWAY_PID" "$PUBLISHER_PID" "$SYNC_PID" 2>/dev/null
  exit 0
}

# Trap signal interupsi (Ctrl+C) dan terminasi
trap cleanup SIGINT SIGTERM

# 1. Jalankan Next.js Web Server 
echo "[System] Starting Next.js Web Server (Port 3000)..."
./scripts/run-web.sh &
WEB_PID=$!

# 2. Jalankan Public Gateway
echo "[System] Starting Public Gateway (Port 3002)..."
./scripts/run-public-gateway.sh &
GATEWAY_PID=$!

# 3. Jalankan Loop Publisher (Cek video yang disetujui tiap 1 menit)
echo "[System] Starting Publisher Daemon..."
(
  while true; do
    ./scripts/run-publisher-once.sh
    sleep 60
  done
) &
PUBLISHER_PID=$!

# 4. Jalankan Loop YouTube Sync (Tarik video baru tiap 15 menit)
echo "[System] Starting YouTube Sync Daemon..."
(
  while true; do
    ./scripts/run-youtube-sync-once.sh
    sleep 900
  done
) &
SYNC_PID=$!

echo "==========================================="
echo " Services are running! Output will appear below."
echo " Tekan [Ctrl+C] untuk menghentikan semuanya."
echo "==========================================="

# Jaga agar script tetap berjalan dan memantau proses, 
# output dari semua proses di atas akan langsung tampil di terminal ini.
wait
