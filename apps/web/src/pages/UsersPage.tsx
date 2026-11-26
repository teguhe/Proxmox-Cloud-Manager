import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Trash2 } from 'lucide-react';
import { USER_ROLES, type UserDto, type UserRole } from 'shared';
import { apiFetch } from '../lib/api';

export function UsersPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ users: UserDto[] }>('/users'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      apiFetch(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Users & Role Management</h1>

      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#27272A] bg-white dark:bg-[#18181B] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-zinc-900/50 text-xs text-slate-500 dark:text-zinc-400">
            <tr>
              <th className="text-left px-4 py-2.5">Email</th>
              <th className="text-left px-4 py-2.5">Role</th>
              <th className="text-left px-4 py-2.5">Protection</th>
              <th className="text-right px-4 py-2.5">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#27272A]">
            {data?.users.map((u) => {
              const locked = u.isProtected || u.email === 'teguhe@gmail.com';
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      disabled={locked}
                      value={u.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          userId: u.id,
                          role: e.target.value as UserRole,
                        })
                      }
                      className="px-2 py-1 rounded border border-[#E2E8F0] dark:border-[#27272A] bg-transparent text-xs disabled:opacity-50"
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {locked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                        <Lock className="w-3 h-3" />
                        Protected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={locked}
                      onClick={() => deleteMutation.mutate(u.id)}
                      className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
