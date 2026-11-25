# Product Requirements Document (PRD): ProxmoxCloud Manager

## 1. Project Overview & Objectives
**Project Name:** ProxmoxCloud Manager  
**Elevator Pitch:** Aplikasi manajemen Virtual Private Server (VPS) berbasis web terpusat untuk mengelola beberapa node Proxmox VE standalone secara aman melalui satu antarmuka cloud console modern, lengkap dengan autentikasi Firebase Google, kontrol akses granular (RBAC), provisioning VM/LXC multi-metode, akses Console/SSH over HTTPS, statistik RRD real-time, pelaporan, dan audit log.

### Core Problems Solved
- **Fragmentasi Node Standalone:** Mengelola beberapa server Proxmox VE yang tidak tergabung dalam cluster dari satu dashboard terpadu tanpa harus login berulang kali ke masing-masing IP/port 8006.
- **Keamanan Akses Operator:** Memberikan akses kontrol VPS (restart, console, SSH) kepada operator secara terbatas (hanya VPS yang ditugaskan) tanpa mengekspos antarmuka admin Proxmox atau port SSH publik.
- **Tata Kelola & Auditabilitas:** Menyediakan visibilitas read-only bagi auditor, pencatatan log aktivitas menyeluruh, serta ekspor laporan inventaris dan alokasi resource.

### Success Criteria
- Semua node Proxmox standalone dapat ditambahkan dan dimonitor secara bersamaan dalam satu dashboard dengan status online/offline dan metrik RRD.
- Email `teguhe@gmail.com` otomatis terdaftar sebagai `super_admin` permanen yang tidak dapat dihapus atau diturunkan hak aksesnya.
- Operator hanya dapat melihat dan mengoperasikan (power control, noVNC, SSH over HTTPS) VPS yang secara eksplisit di-assign kepadanya.
- Admin dapat membuat VPS melalui 3 metode: Clone Template (+ Cloud-Init), Install dari ISO, dan Create LXC Container.
- Ekspor laporan (Inventaris VPS, Alokasi Resource per Node/Operator, dan Log Aktivitas) berjalan mulus dalam format PDF dan Excel/CSV.

---

## 2. Tech Stack & Environment

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript | Cepat, type-safe, ekosistem komponen matang |
| **UI & Styling** | Tailwind CSS v4, Shadcn UI, Lucide Icons | Clean Modern Cloud Console (ala DigitalOcean/Vercel), dukungan Light/Dark mode native |
| **State & Data** | TanStack Query v5, Zustand | Caching API/RRD efisien dan state UI/auth ringan |
| **Charts** | Recharts | Grafik metrik RRD Proxmox responsif dengan tema Light/Dark |
| **Remote Terminal** | `@novnc/novnc`, `@xterm/xterm`, `@xterm/addon-fit` | Console grafis noVNC & terminal SSH interaktif di browser |
| **Backend** | Node.js 22 LTS, Fastify v5, `@fastify/websocket`, TypeScript | Performa tinggi untuk REST API & WebSocket proxy (VNC/SSH) |
| **SSH & PVE Client** | `ssh2`, `undici` (custom PVE REST client) | Proxy SSH-over-WSS dan komunikasi aman ke Proxmox API v2 |
| **Database & ORM** | PostgreSQL 16, Drizzle ORM | Relasional kuat, migrasi bersih, full TypeScript inference |
| **Authentication** | Firebase Auth (Google Sign-In) + Firebase Admin SDK | Autentikasi Google terkelola dengan verifikasi JWT ID Token di server |
| **Report Export** | `exceljs` (XLSX/CSV), `pdfmake` atau `puppeteer-core` (PDF) | Generasi laporan server-side terstruktur |
| **Deployment** | Docker & Docker Compose (Nginx Reverse Proxy) | Siap di-deploy di balik Cloudflare Tunnel / Nginx Proxy Manager |

---

## 3. UI/UX & Design System
- **Design Language:** **Clean Modern Cloud Console** (terinspirasi DigitalOcean, Hetzner Cloud, dan Vercel). Fokus pada ruang lega, hierarki tipografi yang tegas, badge status yang jelas, dan tabel data yang mudah dipindai.
- **Theme Support:** **Toggle Light / Dark Mode** (mengikuti preferensi sistem secara default, disimpan di `localStorage`).
  - **Light Palette:** Background `#F8FAFC` (Slate 50), Surface `#FFFFFF`, Border `#E2E8F0`, Primary Accent `#2563EB` (Blue 600), Text `#0F172A`.
  - **Dark Palette:** Background `#09090B` (Zinc 950), Surface `#18181B` (Zinc 900), Border `#27272A`, Primary Accent `#3B82F6` (Blue 500), Text `#FAFAFA`.
  - **Status Semantics:** Running/Online (`#10B981`), Stopped/Offline (`#EF4444`), Warning/Suspended (`#F59E0B`), Provisioning (`#6366F1`).
- **Typography:** `Inter` untuk UI & teks umum; `JetBrains Mono` untuk IP address, VMID, resource usage, terminal, dan log.
- **Layout Pattern:**
  - Collapsible Left Sidebar (menu difilter otomatis berdasarkan RBAC).
  - Top Header bar berisi breadcrumb, global node status indicator, tombol Theme Toggle (Light/Dark), dan profil user + badge Role.
  - Halaman `no_access`: Full-screen clean card yang menampilkan status akun "Menunggu Persetujuan Administrator", email terdaftar, dan tombol Logout.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Fitur / Modul | `super_admin` | `admin` | `operator` | `audit` | `no_access` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Login Firebase Google | Ya | Ya | Ya | Ya | Ya |
| Dashboard Monitoring | Semua Node/VM | Semua Node/VM | Hanya VPS Assigned | Semua Node/VM (Read-only) | Tidak |
| Tambah/Edit/Hapus Node Proxmox | Ya | Ya | Tidak | Tidak | Tidak |
| Buat VPS (Clone, ISO, LXC) | Ya | Ya | Tidak | Tidak | Tidak |
| Assign VPS ke Operator (Multi-VPS) | Ya | Ya | Tidak | Tidak | Tidak |
| Power Control VPS (Start/Stop/Restart) | Semua VPS | Semua VPS | Hanya VPS Assigned | Tidak | Tidak |
| Console Window (noVNC) & SSH over HTTPS | Semua VPS | Semua VPS | Hanya VPS Assigned | Tidak | Tidak |
| Manajemen User & Set Role | Semua User* | Non-SuperAdmin | Tidak | Tidak | Tidak |
| Statistik Penggunaan (RRD) | Semua | Semua | Hanya VPS Assigned | Semua (Read-only) | Tidak |
| Laporan & Export (PDF/XLSX/CSV) | Ya | Ya | Tidak | Ya (Read-only) | Tidak |
| Log Aktivitas | Ya | Ya | Hanya Log Sendiri | Ya (Semua) | Tidak |

*Catatan Khusus:* Email `teguhe@gmail.com` dikunci di level aplikasi dan database sebagai `super_admin` permanen (`is_protected = true`). Tidak ada user (termasuk dirinya sendiri atau admin lain) yang dapat menghapus akun ini atau mengubah rolenya.

---

## 5. User Stories & Acceptance Criteria

### US-01: Autentikasi & Bootstrap Super Admin
- **Given** pengguna baru membuka aplikasi dan login menggunakan akun Google via Firebase Auth,
- **When** email pengguna adalah `teguhe@gmail.com`,
- **Then** sistem otomatis membuat/memastikan record user memiliki role `super_admin` dan `is_protected = true`, lalu mengarahkan ke Dashboard.
- **When** email pengguna adalah email Google lain yang belum terdaftar,
- **Then** sistem otomatis membuat record user dengan role `no_access` dan mengarahkan ke halaman "Menunggu Hak Akses" serta memblokir seluruh endpoint operasional dengan HTTP `403`.

### US-02: Manajemen Node Proxmox Standalone
- **Given** pengguna login sebagai `super_admin` atau `admin`,
- **When** pengguna menambahkan node Proxmox baru (Nama Node, Host/IP, Port default 8006, PVE Node Name, API Token ID, API Token Secret, opsi skip TLS verify),
- **Then** backend melakukan test koneksi ke endpoint `/api2/json/version` Proxmox; jika sukses, token secret dienkripsi dengan AES-256-GCM sebelum disimpan ke PostgreSQL dan dicatat ke `activity_logs`.

### US-03: Provisioning VPS Multi-Metode
- **Given** pengguna login sebagai `super_admin` atau `admin` dan memilih node target,
- **When** pengguna memilih metode pembuatan:
  1. **Clone Template (+ Cloud-Init):** memilih VM template, VMID baru, nama, CPU/RAM/Disk, serta opsional konfigurasi Cloud-Init (user, password/SSH key, IP statis/DHCP).
  2. **Install dari ISO:** memilih storage ISO, file ISO, spesifikasi CPU/RAM/Disk/Bridge jaringan, dan membuat VM kosong yang boot dari ISO.
  3. **LXC Container:** memilih OS template (`vztmpl`), hostname, root password/SSH key, CPU/RAM/Rootfs, dan jaringan.
- **Then** backend meneruskan request ke Proxmox API, melacak UPID task hingga selesai, menyimpan metadata VPS lokal (jika diperlukan untuk assignment), dan mencatat log aktivitas.

### US-04: Assignment Multi-VPS ke Operator
- **Given** `super_admin` atau `admin` berada di halaman Manajemen VPS / Manajemen Akses,
- **When** admin memilih satu operator dan menetapkan beberapa VPS dari satu atau lebih node Proxmox,
- **Then** sistem menyimpan relasi `(user_id, node_id, vmid, vm_type)` dan operator langsung dapat melihat serta mengelola VPS tersebut di dashboard-nya.

### US-05: Operasi VPS, Console Window & SSH over HTTPS
- **Given** `operator` membuka detail salah satu VPS yang di-assign kepadanya,
- **When** operator menekan tombol **Restart / Start / Stop / Shutdown**,
- **Then** backend memverifikasi kepemilikan assignment di database, memanggil Proxmox API, dan mencatat aksi ke `activity_logs`.
- **When** operator membuka **Console Window**,
- **Then** backend meminta tiket `vncproxy` dari Proxmox dan membuka WebSocket bridge terautentikasi ke komponen `noVNC` di browser.
- **When** operator membuka **SSH over HTTPS**,
- **Then** operator dapat memilih mode **Proxmox Terminal (`termproxy`)** atau **Direct SSH (`ssh2` via WSS)** dengan memasukkan kredensial SSH sementara di modal; terminal `xterm.js` terhubung secara aman melalui HTTPS/WSS.

### US-06: Statistik RRD & Pelaporan
- **Given** pengguna dengan akses valid membuka halaman Statistik Penggunaan,
- **When** pengguna memilih node atau VPS serta rentang waktu (`hour`, `day`, `week`, `month`, `year`),
- **Then** backend mengambil data dari endpoint Proxmox `/rrddata` dan menampilkannya dalam grafik CPU, Memory, Disk I/O, dan Network.
- **Given** `super_admin`, `admin`, atau `audit` membuka halaman Laporan,
- **When** pengguna memilih jenis laporan (Inventaris VPS, Alokasi Resource per Node/Operator, atau Log Aktivitas) dan format (**PDF**, **XLSX**, atau **CSV**),
- **Then** sistem menghasilkan dan mengunduh file laporan yang terformat rapi.

---

## 6. Data Model & Schema (PostgreSQL)

```sql
-- Enum Types
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'operator', 'audit', 'no_access');
CREATE TYPE vm_type AS ENUM ('qemu', 'lxc');

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'no_access',
    is_protected BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE untuk teguhe@gmail.com
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 2. Proxmox Standalone Nodes Table
CREATE TABLE proxmox_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,               -- Label tampilan (e.g., "Node-Salatiga-01")
    pve_node_name VARCHAR(100) NOT NULL,      -- Nama node internal di Proxmox (e.g., "pve")
    host VARCHAR(255) NOT NULL,               -- IP atau FQDN (e.g., "10.10.1.11")
    port INTEGER NOT NULL DEFAULT 8006,
    api_token_id VARCHAR(255) NOT NULL,       -- Format: user@realm!tokenid
    api_token_secret_enc TEXT NOT NULL,       -- Encrypted AES-256-GCM (iv:authTag:ciphertext)
    verify_tls BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(host, port, pve_node_name)
);

-- 3. Operator VPS Assignments (Multi-VPS per Operator)
CREATE TABLE operator_vps_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES proxmox_nodes(id) ON DELETE CASCADE,
    vmid INTEGER NOT NULL,
    vm_type vm_type NOT NULL DEFAULT 'qemu',
    vm_name_cache VARCHAR(255),
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, node_id, vmid)
);
CREATE INDEX idx_assignments_user ON operator_vps_assignments(user_id);
CREATE INDEX idx_assignments_node_vmid ON operator_vps_assignments(node_id, vmid);

-- 4. Activity Logs (Audit Trail)
CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    user_role user_role NOT NULL,
    action VARCHAR(100) NOT NULL,             -- e.g., 'VPS_RESTART', 'USER_ROLE_UPDATE', 'NODE_CREATE', 'SSH_SESSION_OPEN'
    target_type VARCHAR(50),                  -- 'node', 'vps', 'user', 'assignment', 'report', 'auth'
    target_id VARCHAR(255),                   -- UUID atau "nodeId:vmid"
    metadata JSONB DEFAULT '{}'::jsonb,       -- Detail tambahan (sebelum/sesudah, IP, UPID)
    ip_address VARCHAR(64),
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'success', -- 'success' | 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_logs_action ON activity_logs(action);
CREATE INDEX idx_logs_user_id ON activity_logs(user_id);
```

---

## 7. API Specifications & Contracts

Semua endpoint di bawah `/api/v1/*` (kecuali `/health`) wajib menyertakan header `Authorization: Bearer <firebase_id_token>`.

### Auth & Profile
| Method | Endpoint | Auth Level | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/sync` | Any Firebase User | Sinkronisasi profil Firebase ke DB; auto-set `teguhe@gmail.com` ke `super_admin`, user baru lain ke `no_access`. |
| `GET` | `/api/v1/auth/me` | Any Firebase User | Mengembalikan profil user, role aktif, dan daftar permission. |

### Proxmox Nodes
| Method | Endpoint | Auth Level | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/nodes` | `super_admin`, `admin`, `audit` | List semua node + status real-time (CPU, RAM, Disk, Uptime). |
| `POST` | `/api/v1/nodes` | `super_admin`, `admin` | Tambah node standalone baru (dengan auto test-connection). |
| `POST` | `/api/v1/nodes/test` | `super_admin`, `admin` | Uji koneksi kredensial Proxmox sebelum disimpan. |
| `PATCH` | `/api/v1/nodes/:nodeId` | `super_admin`, `admin` | Update konfigurasi atau token node. |
| `DELETE` | `/api/v1/nodes/:nodeId` | `super_admin`, `admin` | Hapus node dari sistem. |
| `GET` | `/api/v1/nodes/:nodeId/resources` | `super_admin`, `admin` | Ambil daftar storage, ISO, LXC templates, VM templates, dan network bridges di node. |

### VPS Management & Provisioning
| Method | Endpoint | Auth Level | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/vms` | `super_admin`, `admin`, `operator`, `audit` | List semua VM/LXC lintas node (otomatis difilter sesuai assignment jika `operator`). |
| `GET` | `/api/v1/vms/:nodeId/:vmType/:vmid` | Scoped RBAC | Detail status, konfigurasi hardware, IP (via QEMU Guest Agent jika aktif). |
| `POST` | `/api/v1/vms/:nodeId/clone` | `super_admin`, `admin` | Buat VM baru via Clone Template + Cloud-Init config. |
| `POST` | `/api/v1/vms/:nodeId/iso` | `super_admin`, `admin` | Buat VM QEMU baru dari file ISO. |
| `POST` | `/api/v1/vms/:nodeId/lxc` | `super_admin`, `admin` | Buat LXC Container baru dari OS template. |
| `POST` | `/api/v1/vms/:nodeId/:vmType/:vmid/power` | `super_admin`, `admin`, `operator` (assigned) | Aksi power: `{ "action": "start" | "stop" | "shutdown" | "reboot" | "reset" }`. |
| `GET` | `/api/v1/nodes/:nodeId/tasks/:upid` | `super_admin`, `admin` | Cek status progress provisioning/task Proxmox. |

### Remote Access (WebSocket over HTTPS/WSS)
| Protocol | Endpoint | Auth Level | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/vms/:nodeId/:vmType/:vmid/console-ticket` | `super_admin`, `admin`, `operator` (assigned) | Menerbitkan short-lived one-time WS token (TTL 30s) untuk koneksi WebSocket. |
| `WSS` | `/ws/vnc/:nodeId/:vmType/:vmid?token=<wsToken>` | One-Time WS Token | Bridge WebSocket ke Proxmox `vncwebsocket` untuk klien `noVNC`. |
| `WSS` | `/ws/termproxy/:nodeId/:vmType/:vmid?token=<wsToken>` | One-Time WS Token | Bridge WebSocket ke Proxmox `termproxy` untuk `xterm.js`. |
| `WSS` | `/ws/ssh/:nodeId/:vmType/:vmid?token=<wsToken>` | One-Time WS Token | WebSocket-to-SSH Proxy (`ssh2`) dari browser `xterm.js` ke IP target VM. |

### Users & Access Management
| Method | Endpoint | Auth Level | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | `super_admin`, `admin` | List seluruh pengguna terdaftar, filter by role/status. |
| `PATCH` | `/api/v1/users/:userId/role` | `super_admin`, `admin` | Ubah role user. Menolak mutasi jika target `is_protected=true` atau jika `admin` mencoba set/edit `super_admin`. |
| `DELETE` | `/api/v1/users/:userId` | `super_admin`, `admin` | Hapus user. Menolak jika `is_protected=true` atau target `super_admin`. |
| `GET` | `/api/v1/assignments` | `super_admin`, `admin` | List mapping operator ke VPS. |
| `PUT` | `/api/v1/assignments/:userId` | `super_admin`, `admin` | Set batch daftar VPS (`[{ nodeId, vmid, vmType }]`) untuk seorang operator. |

### Statistics, Reports & Activity Logs
| Method | Endpoint | Auth Level | Deskripsi |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/stats/node/:nodeId/rrd` | `super_admin`, `admin`, `audit` | Proxy RRD Proxmox node (`?timeframe=hour|day|week|month|year`). |
| `GET` | `/api/v1/stats/vm/:nodeId/:vmType/:vmid/rrd` | Scoped RBAC | Proxy RRD Proxmox VM/LXC (`?timeframe=hour|day|week|month|year`). |
| `GET` | `/api/v1/reports/export` | `super_admin`, `admin`, `audit` | Query: `?type=inventory|allocation|logs&format=pdf|xlsx|csv&from=&to=`. |
| `GET` | `/api/v1/logs` | `super_admin`, `admin`, `audit`, `operator` (own) | List log aktivitas dengan pagination, filter action, user, dan rentang tanggal. |

---

## 8. Non-Functional Requirements
- **Security:**
  - Enkripsi `api_token_secret` Proxmox di database menggunakan **AES-256-GCM** dengan `ENCRYPTION_KEY` 32-byte dari environment variable. Token secret tidak pernah dikembalikan dalam response API ke frontend.
  - Koneksi WebSocket (`WSS`) tidak menggunakan Firebase JWT panjang di query string; gunakan short-lived single-use ticket (`wsToken`) yang disimpan di memory cache (TTL 30 detik).
  - Kredensial SSH pada mode Direct SSH dikirim melalui frame WebSocket terenkripsi (TLS/WSS) dan **tidak pernah disimpan** di database maupun log.
  - Rate limiting pada endpoint auth, power action, dan SSH proxy.
- **Validation & Error Handling:** Validasi skema request menggunakan **Zod** di backend dan frontend. Jika satu node Proxmox sedang offline/timeout (timeout 5 detik), dashboard tetap merender node lain yang sehat dan menandai node bermasalah sebagai `Unreachable` tanpa membuat keseluruhan API gagal.
- **Performance:** Aggregasi data dari beberapa node Proxmox dilakukan secara paralel (`Promise.allSettled`) dengan caching singkat (5–10 detik) untuk daftar VM agar tidak membebani API Proxmox.
