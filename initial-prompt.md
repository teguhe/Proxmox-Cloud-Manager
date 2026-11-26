# Initial Prompt (Master Bootstrap Prompt)

Salin dan tempel prompt berikut ke AI Coding Harness Anda (Antigravity / DeepSeek Harness / OpenClaw) pada sesi awal setelah Anda menyimpan file `prd.md`, `agents.md`, dan `tasks.md` di root folder proyek:

```text
Kamu adalah Lead Software Architect & Full-Stack Engineer yang akan membangun proyek **ProxmoxCloud Manager**.

Sebelum menulis satu baris kode pun, baca dan pahami sepenuhnya ketiga file spesifikasi di root workspace ini:
1. `prd.md` — Spesifikasi produk, arsitektur, RBAC, skema database, kontrak API, dan desain UI/UX.
2. `agents.md` — Aturan main, standar kualitas, batasan keamanan, dan peran agen.
3. `tasks.md` — Daftar tugas kronologis dari Phase 1 hingga Phase 6.

Aturan wajib yang harus selalu kamu patuhi sepanjang proyek:
- Gunakan TypeScript strict mode di seluruh monorepo (`apps/api`, `apps/web`, `packages/shared`).
- Jaga keamanan RBAC secara ketat di backend: email `teguhe@gmail.com` wajib otomatis menjadi `super_admin` dengan `is_protected = true` (tidak dapat dihapus atau diturunkan rolenya oleh siapa pun). User Google baru lainnya otomatis mendapat role `no_access`.
- Enkripsi semua `api_token_secret` Proxmox dengan AES-256-GCM sebelum disimpan ke PostgreSQL. Jangan pernah membocorkan secret ke frontend atau log.
- Gunakan desain Clean Modern Cloud Console (Tailwind CSS + Shadcn UI) dengan dukungan toggle Light/Dark mode yang rapi.
- Kerjakan tugas secara bertahap sesuai instruksi fase yang saya berikan, jalankan verifikasi di setiap task, dan perbarui checkbox `[x]` di `tasks.md` setelah lulus.

Konfirmasikan bahwa kamu telah membaca ketiga dokumen tersebut, lalu langsung eksekusi **Phase 1 (T1.1, T1.2, T1.3)** dari `tasks.md`.
```
