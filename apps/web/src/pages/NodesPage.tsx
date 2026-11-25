import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import type { ProxmoxNodeStatusDto } from 'shared';
import { apiFetch } from '../lib/api';

export function NodesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [pveNodeName, setPveNodeName] = useState('pve');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8006');
  const [apiTokenId, setApiTokenId] = useState('');
  const [apiTokenSecret, setApiTokenSecret] = useState('');
  const [verifyTls, setVerifyTls] = useState(false);

  const { data } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => apiFetch<{ nodes: ProxmoxNodeStatusDto[] }>('/nodes'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/nodes', {
        method: 'POST',
        body: JSON.stringify({
          name,
          pveNodeName,
          host,
          port: Number(port) || 8006,
          apiTokenId,
          apiTokenSecret,
          verifyTls,
        }),
      }),
    onSuccess: () => {
      setName('');
      setHost('');
      setApiTokenId('');
      setApiTokenSecret('');
      qc.invalidateQueries({ queryKey: ['nodes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/nodes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nodes'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Proxmox Standalone Nodes</h1>

      <div className="p-5 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] space-y-4">
        <h2 className="text-sm font-medium">Tambah Node Baru</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <input
            placeholder="Label Node (e.g. Node-01)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
          />
          <input
            placeholder="PVE Node Name (e.g. pve)"
            value={pveNodeName}
            onChange={(e) => setPveNodeName(e.target.value)}
            className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
          />
          <input
            placeholder="Host / IP"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
          />
          <input
            placeholder="Port (8006)"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
          />
          <input
            placeholder="API Token ID (root@pam!mgr)"
            value={apiTokenId}
            onChange={(e) => setApiTokenId(e.target.value)}
            className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
          />
          <input
            type="password"
            placeholder="API Token Secret"
            value={apiTokenSecret}
            onChange={(e) => setApiTokenSecret(e.target.value)}
            className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={verifyTls}
              onChange={(e) => setVerifyTls(e.target.checked)}
            />
            Verify TLS Certificate
          </label>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {createMutation.isPending ? 'Testing & Saving...' : 'Add Node'}
          </button>
        </div>
        {createMutation.error && (
          <div className="text-xs text-red-500">
            {(createMutation.error as Error).message}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-zinc-900/50 text-xs text-slate-500 dark:text-zinc-400">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Host</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#27272A]">
            {data?.nodes.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-3 font-medium">{n.name}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {n.host}:{n.port} ({n.pveNodeName})
                </td>
                <td className="px-4 py-3 text-xs">{n.status}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => deleteMutation.mutate(n.id)}
                    className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
