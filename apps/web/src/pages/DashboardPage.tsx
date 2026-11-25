import { useQuery } from '@tanstack/react-query';
import { Activity, Cpu, HardDrive, Server } from 'lucide-react';
import type { ProxmoxNodeStatusDto, VmSummaryDto } from 'shared';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function DashboardPage() {
  const { user } = useAuth();
  const canViewNodes = user?.role !== 'operator';

  const { data: nodesData } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => apiFetch<{ nodes: ProxmoxNodeStatusDto[] }>('/nodes'),
    enabled: canViewNodes,
  });

  const { data: vmsData } = useQuery({
    queryKey: ['vms'],
    queryFn: () => apiFetch<{ vms: VmSummaryDto[] }>('/vms'),
  });

  const nodes = nodesData?.nodes ?? [];
  const vms = vmsData?.vms ?? [];
  const onlineNodes = nodes.filter((n) => n.status === 'online').length;
  const runningVms = vms.filter((v) => v.status === 'running').length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard Monitoring</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canViewNodes && (
          <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B]">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 mb-2">
              <span>Proxmox Nodes</span>
              <Server className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="text-2xl font-semibold font-mono">
              {onlineNodes} / {nodes.length}
            </div>
            <div className="text-xs text-emerald-500 mt-1">Online</div>
          </div>
        )}

        <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 mb-2">
            <span>Virtual Machines & LXC</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-semibold font-mono">
            {runningVms} / {vms.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Running</div>
        </div>

        <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 mb-2">
            <span>Total vCPU</span>
            <Cpu className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-semibold font-mono">
            {vms.reduce((acc, v) => acc + v.cpus, 0)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Allocated Cores</div>
        </div>

        <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 mb-2">
            <span>Total Memory</span>
            <HardDrive className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-semibold font-mono">
            {Math.round(
              vms.reduce((acc, v) => acc + v.maxmem, 0) / (1024 * 1024 * 1024)
            )}{' '}
            GB
          </div>
          <div className="text-xs text-slate-500 mt-1">Allocated RAM</div>
        </div>
      </div>

      {canViewNodes && (
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] dark:border-[#27272A] font-medium text-sm">
            Standalone Nodes Status
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-zinc-900/50 text-xs text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="text-left px-4 py-2.5">Name</th>
                  <th className="text-left px-4 py-2.5">Host</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">CPU</th>
                  <th className="text-left px-4 py-2.5">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#27272A]">
                {nodes.map((node) => (
                  <tr key={node.id}>
                    <td className="px-4 py-3 font-medium">{node.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {node.host}:{node.port}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          node.status === 'online'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                        }`}
                      >
                        {node.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {node.cpuUsage !== undefined
                        ? `${(node.cpuUsage * 100).toFixed(1)}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {node.pveVersion ?? '-'}
                    </td>
                  </tr>
                ))}
                {nodes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Belum ada node Proxmox terdaftar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
