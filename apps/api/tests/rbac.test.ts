import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { issueWsTicket, consumeWsTicket } from '../src/ws/ticket-store.js';

const mockUsers = new Map<string, Record<string, unknown>>();
const mockAssignments = new Set<string>();

vi.mock('../src/plugins/firebase.js', () => ({
  verifyFirebaseIdToken: vi.fn(async (token: string) => {
    if (token === 'token-super') {
      return { uid: 'uid-super', email: 'teguhe@gmail.com', name: 'Teguh' };
    }
    if (token === 'token-admin') {
      return { uid: 'uid-admin', email: 'admin@example.com', name: 'Admin' };
    }
    if (token === 'token-operator') {
      return { uid: 'uid-operator', email: 'op@example.com', name: 'Operator' };
    }
    if (token === 'token-no-access') {
      return { uid: 'uid-no', email: 'newuser@example.com', name: 'New User' };
    }
    throw new Error('Invalid token');
  }),
}));

vi.mock('../src/services/audit.service.js', () => ({
  recordActivityLog: vi.fn(async () => undefined),
}));

vi.mock('../src/db/index.js', () => {
  const selectChain = (tableName: string) => ({
    from: () => ({
      where: () => ({
        limit: async () => {
          if (tableName === 'users') {
            return Array.from(mockUsers.values());
          }
          return [];
        },
      }),
    }),
  });

  return {
    db: {
      select: () => ({
        from: (tbl: unknown) => {
          const isUsers =
            typeof tbl === 'object' &&
            tbl !== null &&
            'firebaseUid' in (tbl as Record<string, unknown>);
          return {
            where: () => ({
              limit: async () => {
                if (isUsers) {
                  return Array.from(mockUsers.values()).slice(0, 1);
                }
                return mockAssignments.size > 0 ? [{ id: 'assign-1' }] : [];
              },
            }),
          };
        },
      }),
      insert: () => ({
        values: (val: Record<string, unknown>) => ({
          returning: async () => {
            const id = `user-${mockUsers.size + 1}`;
            const record = { id, ...val };
            mockUsers.set(String(val.firebaseUid ?? id), record);
            return [record];
          },
        }),
      }),
      update: () => ({
        set: (val: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => [{ id: 'user-1', ...val }],
          }),
        }),
      }),
      delete: () => ({
        where: () => ({
          returning: async () => [],
        }),
      }),
    },
    users: { firebaseUid: 'firebase_uid', id: 'id', email: 'email', role: 'role' },
    proxmoxNodes: { id: 'id', isEnabled: 'is_enabled' },
    operatorVpsAssignments: { userId: 'user_id', nodeId: 'node_id', vmid: 'vmid' },
    activityLogs: { createdAt: 'created_at', userId: 'user_id', action: 'action' },
  };
});

import { buildApp } from '../src/app.js';

describe('RBAC, Auth & Security Verification', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  it('rejects /api/v1/auth/me without Bearer token (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  it('auto-assigns teguhe@gmail.com as protected super_admin on /auth/sync', async () => {
    mockUsers.clear();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: 'Bearer token-super' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe('teguhe@gmail.com');
    expect(body.user.role).toBe('super_admin');
    expect(body.user.isProtected).toBe(true);
  });

  it('auto-assigns other new users as no_access and blocks /auth/me (403)', async () => {
    mockUsers.clear();
    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: 'Bearer token-no-access' },
    });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().user.role).toBe('no_access');

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer token-no-access' },
    });
    expect(meRes.statusCode).toBe(403);
  });

  it('blocks role mutation and deletion of protected teguhe@gmail.com (403)', async () => {
    mockUsers.clear();
    mockUsers.set('uid-super', {
      id: 'user-super',
      firebaseUid: 'uid-super',
      email: 'teguhe@gmail.com',
      role: 'super_admin',
      isProtected: true,
      isActive: true,
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/user-super/role',
      headers: { authorization: 'Bearer token-super' },
      payload: { role: 'operator' },
    });
    expect(patchRes.statusCode).toBe(403);

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/users/user-super',
      headers: { authorization: 'Bearer token-super' },
    });
    expect(delRes.statusCode).toBe(403);
  });

  it('enforces single-use WS ticket validation', () => {
    const token = issueWsTicket({
      userId: 'u1',
      userEmail: 'op@example.com',
      userRole: 'operator',
      nodeId: 'node-1',
      vmType: 'qemu',
      vmid: 100,
    });

    const valid = consumeWsTicket(token, 'node-1', 'qemu', 100);
    expect(valid).not.toBeNull();

    const reused = consumeWsTicket(token, 'node-1', 'qemu', 100);
    expect(reused).toBeNull();
  });
});
