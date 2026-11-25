import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RRD_TIMEFRAMES, type RrdTimeframe, type VmSummaryDto } from 'shared';
import { apiFetch } from '../lib/api';

export function StatsPage() {
  const [selectedVmKey, setSelectedVmKey] = useState('');
  const [timeframe, setTimeframe] = useState<RrdTimeframe>('hour');

  const { data: vmsData } = useQuery({
    queryKey: ['vms'],
    queryFn: () => apiFetch<{ vms: VmSummaryDto[] }>('/vms'),
  });

  const vms = vmsData?.vms ?? [];
  const activeKey =
    selectedVmKey ||
    (vms[0] ? `${vms[0].nodeId}:${vms[0].vmType}:${vms[0].vmid}` : '');

  const { data: rrdData } = useQuery({
    queryKey: ['rrd', activeKey, timeframe],
    queryFn: () => {
      const [nodeId, vmType, vmid] = activeKey.split(':');
      return apiFetch<{ data: Array<Record<string, number>> }>(
        `/stats/vm/${nodeId}/${vmType}/${vmid}/rrd?timeframe=${timeframe}`
      );
    },
    enabled: Boolean(activeKey),
  });

  const chartData = (rrdData?.data ?? []).map((pt) => ({
    time: new Date((pt.time ?? 0) * 1000).toLocaleTimeString(),
    cpu: Number(((pt.cpu ?? 0) * 100).toFixed(2)),
    memMb: Math.round((pt.mem ?? 0) / (1024 * 1024)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Resource Usage Statistics (RRD)</h1>
        <div className="flex items-center gap-3">
          <select
            value={activeKey}
            onChange={(e) => setSelectedVmKey(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-sm"
          >
            {vms.map((v) => (
              <option
                key={`${v.nodeId}:${v.vmType}:${v.vmid}`}
                value={`${v.nodeId}:${v.vmType}:${v.vmid}`}
              >
                {v.name} (VMID {v.vmid})
              </option>
            ))}
          </select>
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
      </div>

      <div className="p-5 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B]">
        <h2 className="text-sm font-medium mb-4">CPU Usage (%)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#2563EB"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
