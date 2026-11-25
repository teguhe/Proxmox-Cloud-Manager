import { Download } from 'lucide-react';
import { REPORT_FORMATS, REPORT_TYPES } from 'shared';
import { apiDownload } from '../lib/api';

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reports & Export</h1>

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
              {REPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt}
                  onClick={() =>
                    apiDownload(
                      `/reports/export?type=${type}&format=${fmt}`,
                      `proxmox-${type}-report.${fmt}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs font-mono uppercase"
                >
                  <Download className="w-3.5 h-3.5" />
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
