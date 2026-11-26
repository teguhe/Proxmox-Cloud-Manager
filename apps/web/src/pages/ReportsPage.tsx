import { useState } from 'react';
import { Download } from 'lucide-react';
import { REPORT_FORMATS, REPORT_TYPES } from 'shared';
import { apiDownload } from '../lib/api';

export function ReportsPage() {
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownload = async (type: string, fmt: string) => {
    const key = `${type}:${fmt}`;
    setDownloadingKey(key);
    setErrorMsg(null);
    try {
      await apiDownload(
        `/reports/export?type=${type}&format=${fmt}`,
        `proxmox-${type}-report.${fmt}`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengunduh laporan');
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reports & Export</h1>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORT_TYPES.map((type) => (
          <div
            key={type}
            className="p-5 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] space-y-4"
          >
            <div>
              <h2 className="font-semibold capitalize">{type} Report</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Unduh laporan {type} dalam format PDF, XLSX, atau CSV.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {REPORT_FORMATS.map((fmt) => {
                const key = `${type}:${fmt}`;
                const isDownloading = downloadingKey === key;
                return (
                  <button
                    key={fmt}
                    type="button"
                    disabled={isDownloading}
                    onClick={() => handleDownload(type, fmt)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-mono uppercase disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isDownloading ? '...' : fmt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
