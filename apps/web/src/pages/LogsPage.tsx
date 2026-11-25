import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ActivityLogDto } from 'shared';
import { apiFetch } from '../lib/api';

export function LogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['logs', page, actionFilter],
    queryFn: () =>
      apiFetch<{
        logs: ActivityLogDto[];
        pagination: { page: number; limit: number; total: number };
      }>(`/logs?page=${page}&limit=25${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ''}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Activity Logs</h1>
        <input
          placeholder="Filter action (e.g. AUTH_SYNC)..."
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-sm"
        />
      </div>

      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-zinc-900/50 text-xs text-slate-500 dark:text-zinc-400">
            <tr>
              <th className="text-left px-4 py-2.5">Time</th>
              <th className="text-left px-4 py-2.5">User</th>
              <th className="text-left px-4 py-2.5">Action</th>
              <th className="text-left px-4 py-2.5">Target</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#27272A]">
            {data?.logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 font-mono text-xs">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs">{log.userEmail}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.targetId ?? '-'}</td>
                <td className="px-4 py-3 text-xs">{log.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Total: {data?.pagination.total ?? 0}</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border border-[#E2E8F0] dark:border-[#27272A] disabled:opacity-40"
          >
            Prev
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border border-[#E2E8F0] dark:border-[#27272A]"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
