import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OperatorAssignmentDto, UserDto, VmSummaryDto } from 'shared';
import { apiFetch } from '../lib/api';

export function AccessPage() {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ users: UserDto[] }>('/users'),
  });

  const { data: vmsData } = useQuery({
    queryKey: ['vms'],
    queryFn: () => apiFetch<{ vms: VmSummaryDto[] }>('/vms'),
  });

  const { data: assignData } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => apiFetch<{ assignments: OperatorAssignmentDto[] }>('/assignments'),
  });

  const operators = (usersData?.users ?? []).filter((u) => u.role === 'operator');
  const activeUserId = selectedUserId || operators[0]?.id || '';
  const currentAssigned = new Set(
    (assignData?.assignments ?? [])
      .filter((a) => a.userId === activeUserId)
      .map((a) => `${a.nodeId}:${a.vmType}:${a.vmid}`)
  );

  const saveMutation = useMutation({
    mutationFn: (vms: VmSummaryDto[]) =>
      apiFetch(`/assignments/${activeUserId}`, {
        method: 'PUT',
        body: JSON.stringify({
          assignments: vms.map((v) => ({
            nodeId: v.nodeId,
            vmid: v.vmid,
            vmType: v.vmType,
            vmNameCache: v.name,
          })),
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });

  const toggleVm = (vm: VmSummaryDto) => {
    const allVms = vmsData?.vms ?? [];
    const key = `${vm.nodeId}:${vm.vmType}:${vm.vmid}`;
    const next = new Set(currentAssigned);
    if (next.has(key)) next.delete(key);
    else next.add(key);

    const selected = allVms.filter((v) =>
      next.has(`${v.nodeId}:${v.vmType}:${v.vmid}`)
    );
    saveMutation.mutate(selected);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Operator Multi-VPS Access</h1>
        <select
          value={activeUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-sm"
        >
          {operators.map((op) => (
            <option key={op.id} value={op.id}>
              {op.email}
            </option>
          ))}
        </select>
      </div>

      {operators.length === 0 ? (
        <div className="p-6 rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-sm text-slate-500">
          Belum ada user dengan role <span className="font-mono">operator</span>.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900/50 text-xs text-slate-500 dark:text-zinc-400">
              <tr>
                <th className="text-left px-4 py-2.5">Assigned</th>
                <th className="text-left px-4 py-2.5">VMID</th>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Node</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#27272A]">
              {(vmsData?.vms ?? []).map((vm) => {
                const key = `${vm.nodeId}:${vm.vmType}:${vm.vmid}`;
                return (
                  <tr key={key}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={currentAssigned.has(key)}
                        onChange={() => toggleVm(vm)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{vm.vmid}</td>
                    <td className="px-4 py-3 font-medium">{vm.name}</td>
                    <td className="px-4 py-3 text-xs">{vm.nodeName}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
