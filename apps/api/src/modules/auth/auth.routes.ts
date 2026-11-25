import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, users } from '../../db/index.js';
import {
  authenticate,
  PROTECTED_SUPER_ADMIN_EMAIL,
  requireRole,
  verifyBearerOnly,
} from '../../plugins/auth.js';
import { recordActivityLog } from '../../services/audit.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/sync', { preHandler: [verifyBearerOnly] }, async (request, reply) => {
    const fbUser = request.firebaseUser;
    if (!fbUser) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const isProtectedSuperAdmin = fbUser.email.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL;
    const now = new Date();

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, fbUser.uid))
      .limit(1);

    let syncedUser;

    if (existing) {
      const [updated] = await db
        .update(users)
        .set({
          email: fbUser.email,
          displayName: fbUser.name ?? existing.displayName,
          avatarUrl: fbUser.picture ?? existing.avatarUrl,
          role: isProtectedSuperAdmin ? 'super_admin' : existing.role,
          isProtected: isProtectedSuperAdmin ? true : existing.isProtected,
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id))
        .returning();
      syncedUser = updated;
    } else {
      const [inserted] = await db
        .insert(users)
        .values({
          firebaseUid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.name ?? null,
          avatarUrl: fbUser.picture ?? null,
          role: isProtectedSuperAdmin ? 'super_admin' : 'no_access',
          isProtected: isProtectedSuperAdmin,
          isActive: true,
          lastLoginAt: now,
        })
        .returning();
      syncedUser = inserted;
    }

    if (syncedUser) {
      await recordActivityLog({
        userId: syncedUser.id,
        userEmail: syncedUser.email,
        userRole: syncedUser.role,
        action: 'AUTH_SYNC',
        targetType: 'auth',
        targetId: syncedUser.id,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
    }

    return reply.send({ user: syncedUser });
  });

  app.get(
    '/me',
    {
      preHandler: [
        authenticate,
        requireRole('super_admin', 'admin', 'operator', 'audit'),
      ],
    },
    async (request, reply) => {
      return reply.send({ user: request.currentUser });
    }
  );
}
