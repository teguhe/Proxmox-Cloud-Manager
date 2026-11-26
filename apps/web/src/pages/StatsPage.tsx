import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RRD_TIMEFRAMES, type RrdTimeframe, type VmSummaryDto } from 'shared';
import { apiFetch } from '../lib/api';

const CHART_COLORS = [
  '#2563EB',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

function vmKey(v: VmSummaryDto): string {
  return `${v.nodeId}:${v.vmType}:${v.vmid}`;
}

export function StatsPage() {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [timeframe, setTimeframe] = useState<RrdTimeframe>('hour');

  const { data: vmsData } = useQuery({
    queryKey: ['vms'],
    queryFn: () => apiFetch<{ vms: VmSummaryDto[] }>('/vms'),
  });

  const vms = useMemo(
    () =>
      [...(vmsData?.vms ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [vmsData?.vms]
  );

  useEffect(() => {
    if (vms.length > 0 && selectedKeys.length === 0) {
      setSelectedKeys([vmKey(vms[0]!)]);
    }
  }, [vms, selectedKeys.length]);

  const selectedVms = useMemo(
    () => vms.filter((v) => selectedKeys.includes(vmKey(v))),
    [vms, selectedKeys]
  );

  const rrdQueries = useQueries({
    queries: selectedVms.map((v) => {
      const key = vmKey(v);
      return {
        queryKey: ['rrd', key, timeframe],
        queryFn: () =>
          apiFetch<{ data: Array<Record<string, number>> }>(
            `/stats/vm/${v.nodeId}/${v.vmType}/${v.vmid}/rrd?timeframe=${timeframe}`
          ),
      };
    }),
  });

  const toggleVm = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const mergedData = useMemo(() => {
    const byTime = new Map<number, Record<string, number | string>>();

    selectedVms.forEach((vm, idx) => {
      const key = vmKey(vm);
      const pts = rrdQueries[idx]?.data?.data ?? [];
      for (const pt of pts) {
        const ts = pt.time ?? 0;
        if (!ts) continue;
        let row = byTime.get(ts);
        if (!row) {
          row = {
            ts,
            time: new Date(ts * 1000).toLocaleTimeString(),
          };
          byTime.set(ts, row);
        }
        row[`cpu_${key}`] = Number(((pt.cpu ?? 0) * 100).toFixed(2));
        row[`mem_${key}`] = Math.round((pt.mem ?? 0) / (1024 * 1024));
        row[`disk_${key}`] = Number(
          (((pt.diskread ?? 0) + (pt.diskwrite ?? 0)) / 1024).toFixed(2)
        );
        row[`net_${key}`] = Number(
          (((pt.netin ?? 0) + (pt.netout ?? 0)) / 1024).toFixed(2)
        );
      }
    });

    return Array.from(byTime.values()).sort(
      (a, b) => Number(a.ts) - Number(b.ts)
    );
  }, [selectedVms, rrdQueries]);

  const charts: Array<{ title: string; prefix: string }> = [
    { title: 'CPU Usage (%)', prefix: 'cpu' },
    { title: 'Memory Usage (MB)', prefix: 'mem' },
    { title: 'Disk I/O (KB/s)', prefix: 'disk' },
    { title: 'Network I/O (KB/s)', prefix: 'net' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Resource Usage Statistics (RRD)</h1>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as RrdTimeframe)}
          className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-sm"
        >
          {RRD_TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:w-72 shrink-0 p-4 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] space-y-3">
          <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">
            Pilih VM / Container ({selectedVms.length} dipilih):
          </div>
          <div className="flex flex-col gap-2 max-h-[640px] overflow-y-auto pr-1">
            {vms.map((v) => {
              const key = vmKey(v);
              const checked = selectedKeys.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleVm(key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    checked
                      ? 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'border-[#E2E8F0] dark:border-[#27272A] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="truncate">{v.name}</div>
                  <div
                    className={`text-[11px] font-mono ${
                      checked ? 'text-blue-100' : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  >
                    VMID {v.vmid} • {v.vmType.toUpperCase()}
                  </div>
                </button>
              );
            })}
            {vms.length === 0 && (
              <span className="text-xs text-slate-500">Tidak ada VM tersedia.</span>
            )}
          </div>
        </div>

        <div className="flex-1 w-full p-5 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B]">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {charts.map((chart) => (
              <div
                key={chart.prefix}
                className="p-4 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] bg-slate-50/50 dark:bg-zinc-900/30"
              >
                <h2 className="text-sm font-medium mb-4">{chart.title}</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mergedData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '9px' }} />
                      {selectedVms.map((vm, idx) => {
                        const key = vmKey(vm);
                        return (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={`${chart.prefix}_${key}`}
                            name={`${vm.name} (${vm.vmid})`}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
