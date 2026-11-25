import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { UserRole } from 'shared';
import { db, operatorVpsAssignments, users } from '../db/index.js';
import { verifyFirebaseIdToken } from './firebase.js';

export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isProtected: boolean;
  isActive: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
    firebaseUser?: {
      uid: string;
      email: string;
      name?: string;
      picture?: string;
    };
  }
}

export const PROTECTED_SUPER_ADMIN_EMAIL = (
  process.env.PROTECTED_SUPER_ADMIN_EMAIL ?? 'teguhe@gmail.com'
).toLowerCase();

export async function verifyBearerOnly(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    await reply.code(401).send({ error: 'Empty Bearer token' });
    return;
  }

  try {
    request.firebaseUser = await verifyFirebaseIdToken(token);
  } catch (err) {
    request.log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Firebase ID token verification failed'
    );
    await reply.code(401).send({ error: 'Invalid or expired Firebase ID token' });
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await verifyBearerOnly(request, reply);
  if (reply.sent || !request.firebaseUser) return;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, request.firebaseUser.uid))
    .limit(1);

  if (!user) {
    await reply.code(401).send({ error: 'User not synced. Call POST /api/v1/auth/sync first.' });
    return;
  }

  if (!user.isActive) {
    await reply.code(403).send({ error: 'Account is deactivated' });
    return;
  }

  request.currentUser = {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isProtected: user.isProtected,
    isActive: user.isActive,
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.currentUser;
    if (!user) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    if (user.role === 'no_access' || !allowedRoles.includes(user.role)) {
      await reply.code(403).send({ error: 'Forbidden: insufficient role permissions' });
    }
  };
}

export async function requireVpsAccess(
  request: FastifyRequest<{ Params: { nodeId: string; vmid: string } }>,
  reply: FastifyReply
): Promise<void> {
  const user = request.currentUser;
  if (!user) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }

  if (user.role === 'no_access') {
    await reply.code(403).send({ error: 'Forbidden: no access' });
    return;
  }

  if (user.role === 'super_admin' || user.role === 'admin' || user.role === 'audit') {
    return;
  }

  const { nodeId, vmid } = request.params;
  const numericVmid = Number(vmid);
  if (!nodeId || Number.isNaN(numericVmid)) {
    await reply.code(400).send({ error: 'Invalid nodeId or vmid' });
    return;
  }

  const [assignment] = await db
    .select()
    .from(operatorVpsAssignments)
    .where(
      and(
        eq(operatorVpsAssignments.userId, user.id),
        eq(operatorVpsAssignments.nodeId, nodeId),
        eq(operatorVpsAssignments.vmid, numericVmid)
      )
    )
    .limit(1);

  if (!assignment) {
    await reply.code(403).send({ error: 'Forbidden: VPS is not assigned to this operator' });
  }
}
