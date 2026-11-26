import { Info, Server, Shield, User } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-semibold">About App</h1>

      <div className="p-6 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] space-y-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-blue-400">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">TP Cloud Manager</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">
              Aplikasi manajemen terpusat untuk infrastruktur Proxmox VE, Virtual Machine (QEMU),
              Container (LXC), pemantauan statistik resource RRD, manajemen akses operator, serta
              pelaporan sistem.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E2E8F0] dark:border-[#27272A]">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50">
            <User className="w-5 h-5 text-[#2563EB]" />
            <div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Developer</div>
              <div className="text-sm font-semibold">Teguh Prasetyo</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50">
            <Server className="w-5 h-5 text-emerald-500" />
            <div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Platform</div>
              <div className="text-sm font-semibold">Proxmox VE Cloud Manager</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/50 sm:col-span-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            <div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">Versi</div>
              <div className="text-sm font-semibold font-mono">1.0.0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
