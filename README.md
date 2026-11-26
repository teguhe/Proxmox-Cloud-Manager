# TP Cloud Manager

Aplikasi manajemen Virtual Private Server (VPS) berbasis web terpusat untuk mengelola beberapa node **Proxmox VE standalone** secara aman melalui satu antarmuka *Clean Modern Cloud Console* (Light/Dark Mode), lengkap dengan autentikasi Firebase Google, kontrol akses granular (RBAC), provisioning VM/LXC multi-metode, akses Console (`noVNC`), SSH over HTTPS (`xterm.js`), **Remote Desktop RDP/VNC/SSH via Apache Guacamole (`guacd`)**, statistik RRD multi-VM real-time, pelaporan (PDF/XLSX/CSV), dan audit log.

---

## Fitur Utama

- **Dashboard Monitoring**: Card greeting admin, ringkasan aplikasi, total node online, VM/LXC aktif, alokasi vCPU & RAM, serta status tiap node.
- **Proxmox Nodes**: Tambah/hapus node Proxmox VE standalone, badge status berwarna (`online` / `offline` / `unreachable`), serta tombol ubah nama node secara inline.
- **VPS & Containers**: Daftar VM (QEMU) & Container (LXC), kontrol power (*Start, Stop, Reboot*), provisioning (Clone, ISO, LXC), serta akses remote:
  - **noVNC Console**
  - **SSH Terminal** (`xterm.js`)
  - **Apache Guacamole** (`RDP` untuk Windows, `VNC`, dan `SSH` via `guacd`)
- **Statistics (RRD) Multi-VM**: Pemilih multi-VM terurut berdasarkan nama di sebelah kiri, memantau **CPU Usage (%)**, **Memory Usage (MB)**, **Disk I/O (KB/s)**, dan **Network I/O (KB/s)** untuk beberapa VM sekaligus dalam satu grafik.
- **Reports & Export**: Unduh laporan *Inventory*, *Allocation*, dan *Activity* dalam format **PDF**, **XLSX**, dan **CSV**.
- **Navbar & Login**: Dropdown profil admin dengan foto akun Google & tombol Sign Out di pojok kanan navbar, serta halaman Login dengan toggle Light/Dark mode dan info developer.
- **About App**: Halaman informasi aplikasi dan kontak developer (`Dev : teguhe@gmail.com`, Telegram `@teguhe`).

---

## Arsitektur & Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query v5, Recharts, `@novnc/novnc`, `@xterm/xterm`, `guacamole-common-js`
- **Backend:** Node.js 22 LTS, Fastify v5, `@fastify/websocket`, `undici`, `ssh2`, `exceljs`, `pdfmake`
- **Remote Gateway:** Apache Guacamole (`guacamole/guacd:1.5.5`)
- **Database:** PostgreSQL 16 + Drizzle ORM
- **Auth:** Firebase Auth (Google Sign-In) + Firebase Admin SDK
- **Deployment:** Docker & Docker Compose + Nginx Reverse Proxy (WebSocket-ready)

---

## Panduan Setup

### 1. Konfigurasi Firebase Auth
1. Buka [Firebase Console](https://console.firebase.google.com/) dan buat project baru.
2. Aktifkan **Authentication → Sign-in method → Google**.
3. Di **Project Settings → General**, buat Web App dan salin konfigurasi `VITE_FIREBASE_*` ke `.env`.
4. Di **Project Settings → Service Accounts**, klik **Generate new private key** dan salin `project_id`, `client_email`, serta `private_key` ke `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, dan `FIREBASE_PRIVATE_KEY` di `.env`.

### 2. Pembuatan `PVEAPIToken` di Proxmox VE
Pada setiap node Proxmox VE standalone:
1. Buka **Datacenter → Permissions → API Tokens → Add**.
2. Pilih User (misal `root@pam` atau user khusus `pcm@pve`), isi Token ID (misal `cloud-mgr`).
3. **Uncheck "Privilege Separation"** jika menggunakan `root@pam`, atau berikan privilege minimal pada path `/`:
   - `VM.Audit`, `VM.Console`, `VM.PowerMgmt`, `VM.Allocate`, `VM.Clone`, `VM.Config.CPU`, `VM.Config.Memory`, `VM.Config.Disk`, `VM.Config.Network`, `VM.Config.Cloudinit`
   - `Datastore.Audit`, `Datastore.AllocateSpace`, `Sys.Audit`
4. Simpan **Token ID** (`user@realm!tokenid`) dan **Secret** (ditambahkan melalui UI **Proxmox Nodes**).

### 3. Menjalankan dengan Docker Compose
```bash
cp .env.example .env
# Edit .env sesuai kredensial Firebase, PostgreSQL, dan ENCRYPTION_KEY (openssl rand -hex 32)
docker compose build
docker compose up -d
```
Push skema database ke PostgreSQL:
```bash
pnpm --filter api db:push
```

### 4. Deploy di Balik Cloudflare Tunnel / Nginx Proxy Manager
- **Nginx Proxy Manager:** Aktifkan **Websockets Support** pada Proxy Host yang mengarah ke container `web` (port `80`).
- **Cloudflare Tunnel (`cloudflared`):** Arahkan service ke `http://localhost:8080`. Pastikan tidak memblokir header `Upgrade` dan `Connection: upgrade` pada path `/ws/*`.
- Konfigurasi internal [nginx.conf](nginx.conf) sudah menyertakan `proxy_http_version 1.1`, `Upgrade $http_upgrade`, `Connection "upgrade"`, serta `proxy_read_timeout 3600s` untuk sesi VNC/SSH jangka panjang.

---

## Daftar Environment Variables (`.env.example`)

| Variable | Deskripsi |
| :--- | :--- |
| `NODE_ENV` | Mode runtime (`development` / `production`) |
| `PORT` | Port server Fastify API (default `3001`) |
| `HOST` | Bind host Fastify API (default `0.0.0.0`) |
| `CORS_ORIGIN` | Origin frontend yang diizinkan |
| `DATABASE_URL` | Connection string PostgreSQL |
| `POSTGRES_USER` | Username PostgreSQL container |
| `POSTGRES_PASSWORD` | Password PostgreSQL container |
| `POSTGRES_DB` | Nama database PostgreSQL |
| `POSTGRES_PORT` | Port host PostgreSQL (default `5433`) |
| `ENCRYPTION_KEY` | Kunci AES-256-GCM 64-karakter hex (`openssl rand -hex 32`) |
| `PROTECTED_SUPER_ADMIN_EMAIL` | Email super admin permanen (default `teguhe@gmail.com`) |
| `FIREBASE_PROJECT_ID` | Firebase Project ID (Backend Admin SDK) |
| `FIREBASE_CLIENT_EMAIL` | Firebase Service Account Client Email |
| `FIREBASE_PRIVATE_KEY` | Firebase Service Account Private Key |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID (Frontend) |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_API_BASE_URL` | Base URL API untuk frontend (default `/api/v1`) |
| `GUACD_HOST` | Hostname daemon Apache Guacamole (`guacd` di Docker) |
| `GUACD_PORT` | Port daemon Apache Guacamole (default `4822`) |
