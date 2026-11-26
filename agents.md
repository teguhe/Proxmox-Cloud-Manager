# Agents Configuration (`agents.md`)

Dokumen ini mendefinisikan peran agen, aturan kerja, batasan file, dan protokol handoff untuk orkestrasi pengembangan berbasis AI (Antigravity, DeepSeek Harness, OpenClaw).

## Global Rules (Berlaku untuk Semua Agen)
1. **Single Source of Truth:** Selalu rujuk `prd.md` dan `tasks.md` sebelum menulis kode. Jangan mengubah kontrak API atau skema database tanpa memperbarui dokumen terlebih dahulu.
2. **Strict TypeScript:** Dilarang menggunakan `any` secara sembarangan. Gunakan tipe bersama di `packages/shared` (atau `shared/`) untuk payload API dan enum RBAC.
3. **Security First:**
   - Proteksi email `teguhe@gmail.com` (`is_protected = true`, `role = 'super_admin'`) wajib ditegakkan di backend middleware & service layer, bukan hanya di UI.
   - Jangan pernah log `api_token_secret`, `ENCRYPTION_KEY`, Firebase private key, atau password SSH.
4. **No Placeholder Logic:** Semua endpoint, komponen UI, dan proxy WebSocket harus memiliki implementasi nyata yang dapat dijalankan dan diuji.

---

## Agent Roles

### 1. `Architect`
- **Tanggung Jawab:** Scaffolding monorepo, konfigurasi Docker Compose, Nginx reverse proxy (termasuk header WebSocket `Upgrade` & `Connection`), skema PostgreSQL + Drizzle ORM, dan shared TypeScript types/Zod schemas.
- **File Ownership:**
  - `docker-compose.yml`, `Dockerfile*`, `nginx.conf`, `.env.example`
  - `packages/shared/**`
  - `apps/api/src/db/**`
- **Constraints:** Tidak menulis komponen UI React atau business logic halaman frontend.

### 2. `Backend Developer`
- **Tanggung Jawab:** Implementasi Fastify server, Firebase Admin Auth middleware, RBAC guard, AES-256-GCM crypto utility, Proxmox VE API v2 client (dengan `Promise.allSettled` dan dukungan self-signed TLS), seluruh REST endpoints, WebSocket proxy (`noVNC`, `termproxy`, `ssh2`), generator laporan (PDF, XLSX, CSV), dan pencatatan `activity_logs`.
- **File Ownership:**
  - `apps/api/src/modules/**`
  - `apps/api/src/services/**`
  - `apps/api/src/plugins/**`
  - `apps/api/src/ws/**`
- **Constraints:** Wajib memvalidasi setiap input dengan Zod. Setiap mutasi data dan pembukaan sesi console/SSH wajib menulis record ke `activity_logs`.

### 3. `Frontend Developer`
- **Tanggung Jawab:** Implementasi React 19 + Vite + Tailwind CSS + Shadcn UI dengan desain *Clean Modern Cloud Console* dan Light/Dark toggle. Membangun Firebase Google Sign-In flow, Protected Routes berbasis role, halaman `no_access`, Dashboard multi-node, Manajemen VPS (wizard 3 metode provisioning), Modal/Tab Console (`noVNC`) & SSH (`xterm.js`), Manajemen User & Akses, Grafik RRD (`Recharts`), Halaman Laporan, dan Log Aktivitas.
- **File Ownership:**
  - `apps/web/**`
- **Constraints:** Tidak boleh menyimpan rahasia backend atau memanggil Proxmox API langsung dari browser; seluruh komunikasi wajib melalui Backend API/WSS.

### 4. `QA / Reviewer`
- **Tanggung Jawab:** Menulis unit/integration tests (Vitest) untuk RBAC guard (termasuk proteksi `teguhe@gmail.com`), enkripsi token, mock Proxmox client, serta memverifikasi build TypeScript, linting, dan Docker Compose startup.
- **File Ownership:**
  - `apps/api/tests/**`
  - `apps/web/tests/**`
- **Constraints:** Wajib memverifikasi bahwa semua kriteria penerimaan di `prd.md` terpenuhi sebelum menandai task selesai di `tasks.md`.

---

## Handoff Protocol
1. Sebelum memulai fase baru, agen membaca status checkbox terbaru di `tasks.md`.
2. Setelah menyelesaikan sebuah task, agen menjalankan perintah verifikasi (typecheck, lint, test, atau build).
3. Agen memperbarui status `[x]` di `tasks.md` dan menuliskan ringkasan singkat file yang diubah serta catatan integrasi untuk agen berikutnya.
