#!/bin/bash
# preflight.sh - Script untuk mengatur konfigurasi SyncPost dan reset lingkungan

cd "$(dirname "$0")" || exit 1

echo "==============================================="
echo "        SYNCPOST PREFLIGHT CONFIGURATOR        "
echo "==============================================="
echo ""

# =========================================================================
# 📝 USER CONFIGURATION
# Ubah nilai di bawah ini sesuai dengan akun YouTube dan Instagram target Anda.
# =========================================================================

# 1. YouTube Configuration
# Dapatkan ini dari URL channel YouTube Anda (contoh: UCt-E5YaQaRHTsIoPbj3Mzpg)
YOUTUBE_CHANNEL_ID="UCt-E5YaQaRHTsIoPbj3Mzpg"

# 2. Tailscale Public URL
# Alamat Tailscale Funnel Anda tanpa tanda garis miring (/) di akhir.
TAILSCALE_PUBLIC_URL="https://perrys-macbook-air.tailb60877.ts.net"

# 3. Meta Developer / Instagram Configuration
# Dapatkan dari dashboard developers.facebook.com
INSTAGRAM_APP_ID="770017152838249"
INSTAGRAM_APP_SECRET="8c16db3eb34f9336ceed700b96497068"

# =========================================================================
# AKHIR DARI KONFIGURASI PENGGUNA. JANGAN UBAH KODE DI BAWAH INI.
# =========================================================================

ENV_FILE="web/.env.local"
DB_FILE="data/syncpost.sqlite"

echo "[1] Menerapkan konfigurasi ke .env.local..."

# Membuat direktori jika belum ada
mkdir -p web
mkdir -p data

# Menulis ke .env.local
cat > "$ENV_FILE" <<EOL
YOUTUBE_CHANNEL_ID=$YOUTUBE_CHANNEL_ID
INSTAGRAM_REDIRECT_URI=$TAILSCALE_PUBLIC_URL/api/auth/instagram/callback
INSTAGRAM_APP_ID=$INSTAGRAM_APP_ID
INSTAGRAM_APP_SECRET=$INSTAGRAM_APP_SECRET
SYNCPOST_PUBLIC_BASE_URL=$TAILSCALE_PUBLIC_URL

SYNCPOST_DASHBOARD_BASE_URL=http://127.0.0.1:3000
EOL

echo "    -> .env.local telah diperbarui!"
echo ""

echo "[2] Menginstal Dependensi Node.js..."
echo "    Mohon tunggu, mengunduh library dari npm..."
cd web && npm install && cd ..
echo "    -> Dependensi berhasil diinstal!"
echo ""

echo "[3] Pemeriksaan Database"
if [ -f "$DB_FILE" ]; then
    echo "    Database lama ditemukan ($DB_FILE)."
    read -p "    Apakah Anda mengubah akun YouTube/Instagram dan ingin MERESET SEMUA data? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm "$DB_FILE"
        echo "    -> Database lama telah dihapus."
        echo "    -> Menyiapkan database baru..."
        cd web && npm run db:init && cd ..
    else
        echo "    -> Mempertahankan database yang ada."
    fi
else
    echo "    Database belum ada. Menyiapkan database baru..."
    cd web && npm run db:init && cd ..
fi

echo ""
echo "==============================================="
echo " Preflight Selesai! Semua konfigurasi sudah siap."
echo " Silakan baca setup.md jika mengalami kendala."
echo " Sekarang Anda dapat menjalankan: ./run-all.sh"
echo "==============================================="
