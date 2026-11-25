import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function PendingAccessPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#09090B] p-4">
      <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-8 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mb-4">
          <Clock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-semibold mb-2">
          Menunggu Persetujuan Administrator
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
          Akun Anda telah terdaftar dengan status <span className="font-mono text-amber-500">no_access</span>. Hubungi Super Admin untuk mendapatkan hak akses.
        </p>
        <div className="p-3 rounded-md bg-slate-50 dark:bg-zinc-900 border border-[#E2E8F0] dark:border-[#27272A] font-mono text-xs mb-6">
          {user?.email}
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] text-sm font-medium hover:bg-slate-100 dark:hover:bg-zinc-800"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
