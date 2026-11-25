# Task Breakdown (`tasks.md`)

Gunakan daftar tugas ini secara berurutan. Centang `[x]` hanya setelah perintah verifikasi lulus tanpa error.

---

## Phase 1: Project Setup & Environment Scaffolding
- [x] **T1.1: Monorepo Initialization**
  - **Input:** `prd.md` Section 2.
  - **Deliverable:** Struktur workspace `pnpm` (`apps/api`, `apps/web`, `packages/shared`), root `package.json`, `tsconfig.base.json`, `.env.example`, `.gitignore`.
  - **Verification:** `pnpm install` berjalan bersih tanpa error.
- [x] **T1.2: Shared Types & Zod Schemas**
  - **Input:** `prd.md` Sections 4, 6, 7.
  - **Deliverable:** `packages/shared/src/types.ts` & `schemas.ts` (enum `UserRole`, `VmType`, DTO Node, DTO Provisioning Clone/ISO/LXC, DTO Assignment, DTO Log).
  - **Verification:** `pnpm --filter shared build` sukses.
- [x] **T1.3: Docker Compose & Local PostgreSQL**
  - **Input:** `prd.md` Section 2.
  - **Deliverable:** `docker-compose.yml` (service `postgres`, `api`, `web` + Nginx reverse proxy untuk `/api` dan `/ws`), `apps/api/Dockerfile`, `apps/web/Dockerfile`.
  - **Verification:** `docker compose up -d postgres` aktif dan port 5432 merespons.

---

## Phase 2: Database & Core Models
- [x] **T2.1: Drizzle ORM Schema & Migrations**
  - **Input:** `prd.md` Section 6.
  - **Deliverable:** `apps/api/src/db/schema.ts`, `drizzle.config.ts`, migrasi SQL untuk tabel `users`, `proxmox_nodes`, `operator_vps_assignments`, `activity_logs`.
  - **Verification:** `pnpm --filter api db:push` atau `db:migrate` berhasil membuat 4 tabel di PostgreSQL.
- [x] **T2.2: Crypto & Activity Log Service**
  - **Input:** `prd.md` Section 8.
  - **Deliverable:** `apps/api/src/utils/crypto.ts` (AES-256-GCM encrypt/decrypt), `apps/api/src/services/audit.service.ts` (helper pencatatan log otomatis).
  - **Verification:** Unit test enkripsi/dekripsi lolos (`pnpm --filter api test`).

---

## Phase 3: Backend API, Proxmox Client & WebSocket Proxies
- [x] **T3.1: Fastify Core, Firebase Auth & RBAC Middleware**
  - **Input:** `prd.md` Sections 4 & 7.
  - **Deliverable:** Setup Fastify, Firebase Admin SDK verification plugin, `POST /api/v1/auth/sync` (auto-assign `teguhe@gmail.com` sebagai `super_admin` dengan `is_protected=true`, user baru lain `no_access`), `GET /api/v1/auth/me`, middleware `requireRole(...)` & `requireVpsAccess()`.
  - **Verification:** Test endpoint `/auth/me` menolak request tanpa token (`401`) dan memblokir `no_access` (`403`).
- [x] **T3.2: Proxmox VE Standalone API Client**
  - **Input:** `prd.md` Sections 5 & 7.
  - **Deliverable:** `apps/api/src/services/proxmox.service.ts` menggunakan `undici` dengan `Authorization: PVEAPIToken=...`, dukungan toggle `verify_tls`, timeout 5s, metode: `getVersion`, `getNodeStatus`, `listVmsAndLxc`, `getStorageAndTemplates`, `cloneVm`, `createIsoVm`, `createLxc`, `powerAction`, `getRrdData`, `createVncProxy`, `createTermProxy`, `getTaskStatus`.
  - **Verification:** `pnpm --filter api typecheck` bersih.
- [x] **T3.3: Nodes, Users & Assignments REST Modules**
  - **Input:** `prd.md` Section 7.
  - **Deliverable:** Route CRUD `/api/v1/nodes` (+ `/test` dan `/resources`), `/api/v1/users` (proteksi mutasi `is_protected` & `super_admin`), dan `/api/v1/assignments` (multi-VPS mapping per operator).
  - **Verification:** Integration test memastikan `teguhe@gmail.com` tidak bisa dihapus atau diubah rolenya.
- [x] **T3.4: VPS Management, Provisioning & RRD Stats Routes**
  - **Input:** `prd.md` Section 7.
  - **Deliverable:** Route `/api/v1/vms` (agregasi paralel `Promise.allSettled` lintas node + filter RBAC), endpoint provisioning (`clone`, `iso`, `lxc`), power control, task polling, dan endpoint `/api/v1/stats/.../rrd`.
  - **Verification:** `pnpm --filter api typecheck` bersih & endpoint merespons sesuai skema Zod.
- [x] **T3.5: WebSocket Proxies (noVNC, termproxy, Direct SSH)**
  - **Input:** `prd.md` Section 7 (Remote Access).
  - **Deliverable:** Short-lived WS ticket store (TTL 30s), handler `/ws/vnc/...` (bridge ke Proxmox `vncwebsocket`), `/ws/termproxy/...` (bridge ke Proxmox `termproxy`), dan `/ws/ssh/...` (WebSocket-to-SSH menggunakan `ssh2` dengan auth frame awal).
  - **Verification:** Koneksi WS tanpa tiket valid ditolak (`4001`/`403`), koneksi valid meneruskan stream biner/teks dua arah.
- [x] **T3.6: Activity Logs & Report Export Engine**
  - **Input:** `prd.md` Section 7 (Reports & Logs).
  - **Deliverable:** Endpoint `/api/v1/logs` (paginated & filterable) dan `/api/v1/reports/export` untuk 3 jenis laporan (`inventory`, `allocation`, `logs`) dalam 3 format (`pdf`, `xlsx`, `csv`).
  - **Verification:** Request export mengembalikan header `Content-Type` & `Content-Disposition` valid dengan file non-kosong.

---

## Phase 4: Frontend UI, State Management & Styling
- [x] **T4.1: Frontend Base, Theme Toggle & Firebase Auth**
  - **Input:** `prd.md` Section 3.
  - **Deliverable:** Setup Vite + Tailwind CSS v4 + Shadcn UI, ThemeProvider (Light/Dark toggle), Firebase Client Auth (Google Sign-In), API client dengan auto-attach Bearer token, AppShell (Sidebar RBAC + Header), dan halaman `PendingAccessPage` untuk role `no_access`.
  - **Verification:** `pnpm --filter web build` sukses; toggle Light/Dark bekerja persisten.
- [x] **T4.2: Dashboard Monitoring Page**
  - **Input:** `prd.md` Sections 3 & 5.
  - **Deliverable:** Summary cards (Total Node Online/Offline, Total vCPU, RAM, Storage, Running/Stopped VMs), tabel status node standalone, dan daftar VM/LXC cepat sesuai hak akses.
  - **Verification:** Render responsif di desktop & mobile, menampilkan status `Unreachable` secara graceful jika ada node offline.
- [x] **T4.3: Manajemen VPS & Provisioning Wizard (3 Metode)**
  - **Input:** `prd.md` Section 5 (US-03, US-04, US-05).
  - **Deliverable:** Tabel VPS lintas node dengan filter/pencarian, tombol Power Actions (Start/Stop/Shutdown/Reboot), Wizard "Buat VPS" dengan 3 tab (**Clone Template + Cloud-Init**, **Install dari ISO**, **LXC Container**) lengkap dengan task progress tracker, serta drawer/modal assignment operator.
  - **Verification:** Form validasi Zod berjalan di semua 3 tab provisioning.
- [x] **T4.4: Console Window (noVNC) & SSH over HTTPS (xterm.js)**
  - **Input:** `prd.md` Section 5 (US-05).
  - **Deliverable:** Komponen `VncConsoleModal` (`@novnc/novnc`) dan `SshTerminalModal` (`@xterm/xterm` + fit addon) dengan pilihan mode **Proxmox Termproxy** atau **Direct SSH (Input Host/Port/User/Password atau Private Key)**.
  - **Verification:** Terminal dapat di-resize, reconnect, dan membersihkan koneksi WebSocket saat modal ditutup.
- [x] **T4.5: Manajemen Node, User & Akses**
  - **Input:** `prd.md` Sections 4 & 5.
  - **Deliverable:** Halaman Manajemen Node Proxmox (CRUD + Test Connection), Halaman Manajemen User (ubah role, nonaktifkan/hapus, dengan badge "Protected" & tombol terkunci untuk `teguhe@gmail.com`), dan Halaman Manajemen Akses (matriks assignment multi-VPS per operator).
  - **Verification:** Menu & route terproteksi otomatis hanya untuk `super_admin` dan `admin`.
- [x] **T4.6: Statistik Penggunaan (RRD), Laporan & Log Aktivitas**
  - **Input:** `prd.md` Section 5 (US-06).
  - **Deliverable:** Halaman Statistik dengan selector Node/VM & timeframe (`hour`, `day`, `week`, `month`, `year`) menggunakan `Recharts` (CPU, RAM, Disk I/O, Network); Halaman Laporan dengan tombol unduh PDF/XLSX/CSV; Halaman Log Aktivitas dengan filter tanggal, user, dan jenis aksi.
  - **Verification:** Grafik menyesuaikan warna Light/Dark mode dan tombol export memicu unduhan file.

---

## Phase 5: Integration, Edge Cases & Testing
- [ ] **T5.1: Automated Backend & RBAC Tests**
  - **Input:** `prd.md` Sections 4 & 8.
  - **Deliverable:** Suite test Vitest untuk RBAC matrix (5 role), proteksi `teguhe@gmail.com`, validasi multi-VPS operator isolation, dan AES-256-GCM encryption.
  - **Verification:** `pnpm --filter api test` 100% pass.
- [ ] **T5.2: End-to-End Integration & WebSocket Check**
  - **Input:** Full stack running via Docker Compose.
  - **Deliverable:** Verifikasi login Firebase, penambahan node Proxmox, power action, noVNC/SSH handshake, RRD charts, dan ekspor laporan.
  - **Verification:** Tidak ada console error atau unhandled rejection di browser/server logs.

---

## Phase 6: Build, Deployment & Documentation
- [ ] **T6.1: Production Docker & Nginx WebSocket Config**
  - **Input:** `prd.md` Section 2.
  - **Deliverable:** Multi-stage Dockerfiles teroptimasi, `nginx.conf` dengan konfigurasi `proxy_http_version 1.1`, `Upgrade`, `Connection "upgrade"`, dan `proxy_read_timeout 3600s` untuk sesi SSH/VNC jangka panjang.
  - **Verification:** `docker compose build` dan `docker compose up -d` berjalan sehat.
- [ ] **T6.2: Operational Documentation (`README.md`)**
  - **Input:** `.env.example` & `docker-compose.yml`.
  - **Deliverable:** Panduan setup Firebase Console, cara membuat `PVEAPIToken` di Proxmox dengan privilege yang tepat, konfigurasi Cloudflare Tunnel / Nginx Proxy Manager, dan troubleshooting WebSocket.
  - **Verification:** Semua variabel environment di `.env.example` terdokumentasi di `README.md`.
