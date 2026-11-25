import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { updateUserRoleSchema } from 'shared';
import { db, users } from '../../db/index.js';
import {
  authenticate,
  PROTECTED_SUPER_ADMIN_EMAIL,
  requireRole,
} from '../../plugins/auth.js';
import { recordActivityLog } from '../../services/audit.service.js';

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireRole('super_admin', 'admin'));

  app.get('/', async (_request, reply) => {
    const allUsers = await db.select().from(users);
    return reply.send({ users: allUsers });
  });

  app.patch<{ Params: { userId: string } }>(
    '/:userId/role',
    async (request, reply) => {
      const parsed = updateUserRoleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.params.userId))
        .limit(1);

      if (!target) {
        return reply.code(404).send({ error: 'User not found' });
      }

      if (
        target.isProtected ||
        target.email.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL
      ) {
        return reply
          .code(403)
          .send({ error: 'Protected super_admin account cannot be modified' });
      }

      const actor = request.currentUser!;
      if (
        actor.role === 'admin' &&
        (target.role === 'super_admin' || parsed.data.role === 'super_admin')
      ) {
        return reply
          .code(403)
          .send({ error: 'Admin cannot assign or modify super_admin role' });
      }

      const [updated] = await db
        .update(users)
        .set({
          role: parsed.data.role,
          isActive: parsed.data.isActive ?? target.isActive,
          updatedAt: new Date(),
        })
        .where(eq(users.id, target.id))
        .returning();

      await recordActivityLog({
        userId: actor.id,
        userEmail: actor.email,
        userRole: actor.role,
        action: 'USER_ROLE_UPDATE',
        targetType: 'user',
        targetId: target.id,
        metadata: {
          targetEmail: target.email,
          previousRole: target.role,
          newRole: parsed.data.role,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ user: updated });
    }
  );

  app.delete<{ Params: { userId: string } }>(
    '/:userId',
    async (request, reply) => {
      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.params.userId))
        .limit(1);

      if (!target) {
        return reply.code(404).send({ error: 'User not found' });
      }

      if (
        target.isProtected ||
        target.email.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL
      ) {
        return reply
          .code(403)
          .send({ error: 'Protected super_admin account cannot be deleted' });
      }

      const actor = request.currentUser!;
      if (target.role === 'super_admin' && actor.role !== 'super_admin') {
        return reply
          .code(403)
          .send({ error: 'Only super_admin can delete another super_admin' });
      }

      await db.delete(users).where(eq(users.id, target.id));

      await recordActivityLog({
        userId: actor.id,
        userEmail: actor.email,
        userRole: actor.role,
        action: 'USER_DELETE',
        targetType: 'user',
        targetId: target.id,
        metadata: { targetEmail: target.email },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ ok: true });
    }
  );
}
