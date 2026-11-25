import { useState } from 'react';
import { Server } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#09090B] p-4">
      <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-[#3B82F6]">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">ProxmoxCloud Manager</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Standalone Multi-Node Cloud Console
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6">
          Sign in with your Google account to access your assigned Proxmox nodes and virtual machines.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={busy}
          className="w-full py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          {busy ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}
