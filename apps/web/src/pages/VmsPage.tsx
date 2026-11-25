import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Play, Plus, RotateCw, Square, Terminal } from 'lucide-react';
import type { PowerAction, ProxmoxNodeStatusDto, VmSummaryDto } from 'shared';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { VncConsoleModal } from '../components/VncConsoleModal';
import { SshTerminalModal } from '../components/SshTerminalModal';

export function VmsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [vncVm, setVncVm] = useState<VmSummaryDto | null>(null);
  const [sshVm, setSshVm] = useState<VmSummaryDto | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTab, setWizardTab] = useState<'clone' | 'iso' | 'lxc'>('clone');

  const [nodeId, setNodeId] = useState('');
  const [vmid, setVmid] = useState('200');
  const [templateVmid, setTemplateVmid] = useState('9000');
  const [name, setName] = useState('vps-app-01');
  const [cores, setCores] = useState('2');
  const [memoryMb, setMemoryMb] = useState('2048');
  const [diskSizeGb, setDiskSizeGb] = useState('20');
  const [storage, setStorage] = useState('local-lvm');
  const [isoStorage, setIsoStorage] = useState('local');
  const [isoFile, setIsoFile] = useState('ubuntu-24.04-live-server-amd64.iso');
  const [osTemplate, setOsTemplate] = useState('local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst');
  const [upid, setUpid] = useState<string | null>(null);

  const canProvision = user?.role === 'super_admin' || user?.role === 'admin';
  const canControl = canProvision || user?.role === 'operator';

  const { data: vmsData, isLoading } = useQuery({
    queryKey: ['vms'],
    queryFn: () => apiFetch<{ vms: VmSummaryDto[] }>('/vms'),
  });

  const { data: nodesData } = useQuery({
    queryKey: ['nodes'],
    queryFn: () => apiFetch<{ nodes: ProxmoxNodeStatusDto[] }>('/nodes'),
    enabled: canProvision,
  });

  const powerMutation = useMutation({
    mutationFn: ({ vm, action }: { vm: VmSummaryDto; action: PowerAction }) =>
      apiFetch(`/vms/${vm.nodeId}/${vm.vmType}/${vm.vmid}/power`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vms'] }),
  });

  const provisionMutation = useMutation({
    mutationFn: async () => {
      const targetNode = nodeId || nodesData?.nodes[0]?.id;
      if (!targetNode) throw new Error('Pilih node target terlebih dahulu');

      if (wizardTab === 'clone') {
        return apiFetch<{ upid: string }>(`/vms/${targetNode}/clone`, {
          method: 'POST',
          body: JSON.stringify({
            templateVmid: Number(templateVmid),
            newVmid: Number(vmid),
            name,
            cores: Number(cores),
            memoryMb: Number(memoryMb),
            targetStorage: storage,
          }),
        });
      }
      if (wizardTab === 'iso') {
        return apiFetch<{ upid: string }>(`/vms/${targetNode}/iso`, {
          method: 'POST',
          body: JSON.stringify({
            vmid: Number(vmid),
            name,
            isoStorage,
            isoFile,
            diskStorage: storage,
            diskSizeGb: Number(diskSizeGb),
            cores: Number(cores),
            memoryMb: Number(memoryMb),
          }),
        });
      }
      return apiFetch<{ upid: string }>(`/vms/${targetNode}/lxc`, {
        method: 'POST',
        body: JSON.stringify({
          vmid: Number(vmid),
          hostname: name,
          osTemplate,
          rootStorage: storage,
          diskSizeGb: Number(diskSizeGb),
          cores: Number(cores),
          memoryMb: Number(memoryMb),
        }),
      });
    },
    onSuccess: (res) => {
      setUpid(res.upid);
      qc.invalidateQueries({ queryKey: ['vms'] });
    },
  });

  const vms = (vmsData?.vms ?? []).filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      String(v.vmid).includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">VPS & LXC Containers</h1>
        <div className="flex items-center gap-3">
          <input
            placeholder="Cari nama atau VMID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-sm"
          />
          {canProvision && (
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Buat VPS
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900/50 text-xs text-slate-500 dark:text-zinc-400">
              <tr>
                <th className="text-left px-4 py-2.5">VMID</th>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Node</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">vCPU / RAM</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#27272A]">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Loading VMs...
                  </td>
                </tr>
              )}
              {vms.map((vm) => (
                <tr key={`${vm.nodeId}-${vm.vmType}-${vm.vmid}`}>
                  <td className="px-4 py-3 font-mono text-xs">{vm.vmid}</td>
                  <td className="px-4 py-3 font-medium">{vm.name}</td>
                  <td className="px-4 py-3 text-xs">{vm.nodeName}</td>
                  <td className="px-4 py-3 font-mono text-xs uppercase">{vm.vmType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        vm.status === 'running'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {vm.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {vm.cpus}C / {Math.round(vm.maxmem / (1024 * 1024 * 1024))}GB
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canControl && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => powerMutation.mutate({ vm, action: 'start' })}
                          title="Start"
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-emerald-600"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => powerMutation.mutate({ vm, action: 'reboot' })}
                          title="Reboot"
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-amber-500"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => powerMutation.mutate({ vm, action: 'stop' })}
                          title="Stop"
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-red-500"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setVncVm(vm)}
                          title="noVNC Console"
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-[#2563EB]"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSshVm(vm)}
                          title="SSH / Terminal"
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-indigo-500"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {wizardOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#18181B] border border-[#E2E8F0] dark:border-[#27272A] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Buat VPS Baru</h2>
              <button
                onClick={() => {
                  setWizardOpen(false);
                  setUpid(null);
                }}
                className="text-xs text-slate-500 hover:underline"
              >
                Tutup
              </button>
            </div>

            <div className="flex gap-2 border-b border-[#E2E8F0] dark:border-[#27272A] pb-2">
              {(['clone', 'iso', 'lxc'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setWizardTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                    wizardTab === tab
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  {tab === 'clone'
                    ? 'Clone Template'
                    : tab === 'iso'
                    ? 'Install ISO'
                    : 'LXC Container'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <select
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                className="col-span-2 px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
              >
                <option value="">Pilih Node Target...</option>
                {nodesData?.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.host})
                  </option>
                ))}
              </select>
              <input
                placeholder="VMID"
                value={vmid}
                onChange={(e) => setVmid(e.target.value)}
                className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
              />
              <input
                placeholder="Name / Hostname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
              />
              <input
                placeholder="Cores"
                value={cores}
                onChange={(e) => setCores(e.target.value)}
                className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
              />
              <input
                placeholder="Memory (MB)"
                value={memoryMb}
                onChange={(e) => setMemoryMb(e.target.value)}
                className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
              />
              {wizardTab === 'clone' && (
                <input
                  placeholder="Template VMID"
                  value={templateVmid}
                  onChange={(e) => setTemplateVmid(e.target.value)}
                  className="col-span-2 px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
                />
              )}
              {wizardTab === 'iso' && (
                <>
                  <input
                    placeholder="ISO Storage"
                    value={isoStorage}
                    onChange={(e) => setIsoStorage(e.target.value)}
                    className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
                  />
                  <input
                    placeholder="Disk (GB)"
                    value={diskSizeGb}
                    onChange={(e) => setDiskSizeGb(e.target.value)}
                    className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
                  />
                  <input
                    placeholder="ISO Filename"
                    value={isoFile}
                    onChange={(e) => setIsoFile(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
                  />
                </>
              )}
              {wizardTab === 'lxc' && (
                <>
                  <input
                    placeholder="Root Storage"
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                    className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
                  />
                  <input
                    placeholder="Disk (GB)"
                    value={diskSizeGb}
                    onChange={(e) => setDiskSizeGb(e.target.value)}
                    className="px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
                  />
                  <input
                    placeholder="OS Template"
                    value={osTemplate}
                    onChange={(e) => setOsTemplate(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent"
                  />
                </>
              )}
            </div>

            {upid && (
              <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-xs font-mono text-emerald-700 dark:text-emerald-400">
                Task UPID: {upid}
              </div>
            )}

            <button
              onClick={() => provisionMutation.mutate()}
              disabled={provisionMutation.isPending}
              className="w-full py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {provisionMutation.isPending ? 'Provisioning...' : 'Create VPS'}
            </button>
          </div>
        </div>
      )}

      {vncVm && <VncConsoleModal vm={vncVm} onClose={() => setVncVm(null)} />}
      {sshVm && <SshTerminalModal vm={sshVm} onClose={() => setSshVm(null)} />}
    </div>
  );
}
