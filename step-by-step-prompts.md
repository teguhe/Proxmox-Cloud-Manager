# Step-by-Step Prompts (Phase 2 – Phase 6)

Gunakan prompt berikut secara berurutan setelah fase sebelumnya selesai dan terverifikasi.

---

## Prompt Phase 2: Database & Core Models
```text
Lanjutkan ke **Phase 2 (T2.1 dan T2.2)** di `tasks.md`.
Implementasikan skema PostgreSQL menggunakan Drizzle ORM (`users`, `proxmox_nodes`, `operator_vps_assignments`, `activity_logs`) persis sesuai `prd.md` Section 6, beserta utilitas enkripsi AES-256-GCM (`crypto.ts`) dan `audit.service.ts`.
Jalankan migrasi ke database lokal dan pastikan unit test enkripsi/dekripsi lulus sebelum menandai Phase 2 selesai di `tasks.md`.
```

---

## Prompt Phase 3: Backend API, Proxmox Client & WebSocket Proxies
```text
Lanjutkan ke **Phase 3 (T3.1 hingga T3.6)** di `tasks.md`.
Bangun seluruh modul backend Fastify secara modular:
1. Firebase Admin Auth middleware, endpoint `/api/v1/auth/sync` & `/auth/me`, serta RBAC guard (termasuk proteksi mutlak untuk `teguhe@gmail.com`).
2. Proxmox VE Standalone API Client (`undici`) yang mendukung beberapa node terpisah, toggle `verify_tls`, timeout 5 detik, dan agregasi paralel `Promise.allSettled`.
3. CRUD Nodes (+ test connection & resources), CRUD Users & Role, serta batch Assignment multi-VPS per operator.
4. Manajemen VPS: list terfilter RBAC, power actions, dan 3 metode provisioning (`clone` + Cloud-Init, `iso`, `lxc`) + task polling.
5. WebSocket proxies dengan short-lived ticket (TTL 30s) untuk `/ws/vnc/...`, `/ws/termproxy/...`, dan `/ws/ssh/...` (`ssh2`).
6. Proxy RRD Proxmox, endpoint paginated `/api/v1/logs`, dan Report Export Engine (PDF, XLSX, CSV untuk Inventaris VPS, Alokasi Resource, dan Log Aktivitas).

Pastikan semua input tervalidasi Zod, setiap aksi tercatat di `activity_logs`, dan jalankan typecheck serta test setelah selesai.
```

---

## Prompt Phase 4: Frontend UI (Clean Modern Cloud Console + Light/Dark)
```text
Lanjutkan ke **Phase 4 (T4.1 hingga T4.6)** di `tasks.md`.
Bangun aplikasi frontend React 19 + Vite + Tailwind CSS + Shadcn UI dengan gaya **Clean Modern Cloud Console** dan **Toggle Light/Dark Mode**:
1. Firebase Google Sign-In, AuthContext, Protected Routes berbasis RBAC, AppShell (Sidebar dinamis per role + Header), dan halaman `PendingAccessPage` untuk role `no_access`.
2. Dashboard Monitoring lintas node standalone + daftar VM sesuai hak akses.
3. Halaman Manajemen VPS dengan Power Controls dan Wizard "Buat VPS" 3 tab (Clone Template + Cloud-Init, Install ISO, LXC Container) lengkap dengan status progress UPID.
4. Komponen Console Window (`@novnc/novnc`) dan SSH over HTTPS (`@xterm/xterm`) dengan pilihan mode Proxmox `termproxy` atau Direct SSH (`ssh2` via WSS).
5. Halaman Manajemen Node Proxmox, Manajemen User (kunci mutasi untuk `teguhe@gmail.com`), dan Manajemen Akses (mapping multi-VPS ke operator).
6. Halaman Statistik Penggunaan (grafik `Recharts` dari RRD Proxmox), Halaman Laporan (unduh PDF/XLSX/CSV), dan Halaman Log Aktivitas dengan filter.

Pastikan `pnpm --filter web build` lulus tanpa error dan perbarui `tasks.md`.
```

---

## Prompt Phase 5: Testing, Edge Cases & Security Verification
```text
Lanjutkan ke **Phase 5 (T5.1 dan T5.2)** di `tasks.md`.
Bertindaklah sebagai `QA / Reviewer` sesuai `agents.md`:
1. Tulis dan jalankan suite automated test (Vitest) untuk memverifikasi seluruh matriks RBAC (5 role), isolasi akses multi-VPS operator, penolakan hapus/ubah role terhadap `teguhe@gmail.com`, dan graceful handling saat satu node Proxmox offline.
2. Audit keamanan: pastikan tidak ada `api_token_secret` atau password SSH yang bocor di response API maupun log.
3. Perbaiki semua bug atau warning yang ditemukan, lalu perbarui `tasks.md`.
```

---

## Prompt Phase 6: Production Docker, Nginx WebSocket & Documentation
```text
Lanjutkan ke **Phase 6 (T6.1 dan T6.2)** di `tasks.md`.
1. Finalisasi multi-stage `Dockerfile` untuk `api` dan `web`, `docker-compose.yml` siap produksi, serta `nginx.conf` dengan dukungan penuh reverse proxy HTTPS/WebSocket (`Upgrade`, `Connection "upgrade"`, timeout panjang untuk sesi noVNC & SSH).
2. Buat `README.md` komprehensif yang mencakup panduan setup Firebase Auth, pembuatan `PVEAPIToken` di Proxmox VE beserta privilege minimalnya, cara deploy di balik Cloudflare Tunnel / Nginx Proxy Manager, serta daftar lengkap environment variables.
3. Verifikasi `docker compose build` berjalan bersih dan tandai seluruh task di `tasks.md` selesai.
```
