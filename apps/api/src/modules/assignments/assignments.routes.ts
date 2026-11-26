import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { batchAssignmentsSchema } from 'shared';
import { db, operatorVpsAssignments, users } from '../../db/index.js';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { recordActivityLog } from '../../services/audit.service.js';

export async function assignmentsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireRole('super_admin', 'admin'));

  app.get('/', async (_request, reply) => {
    const rows = await db.select().from(operatorVpsAssignments);
    return reply.send({ assignments: rows });
  });

  app.put<{ Params: { userId: string } }>(
    '/:userId',
    async (request, reply) => {
      const parsed = batchAssignmentsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, request.params.userId))
        .limit(1);

      if (!targetUser) {
        return reply.code(404).send({ error: 'Target user not found' });
      }

      const actor = request.currentUser!;
      const inserted = await db.transaction(async (tx) => {
        await tx
          .delete(operatorVpsAssignments)
          .where(eq(operatorVpsAssignments.userId, targetUser.id));

        if (parsed.data.assignments.length === 0) {
          return [];
        }

        return tx
          .insert(operatorVpsAssignments)
          .values(
            parsed.data.assignments.map((a) => ({
              userId: targetUser.id,
              nodeId: a.nodeId,
              vmid: a.vmid,
              vmType: a.vmType,
              vmNameCache: a.vmNameCache ?? null,
              assignedBy: actor.id,
            }))
          )
          .returning();
      });

      await recordActivityLog({
        userId: actor.id,
        userEmail: actor.email,
        userRole: actor.role,
        action: 'ASSIGNMENT_UPDATE',
        targetType: 'assignment',
        targetId: targetUser.id,
        metadata: {
          targetEmail: targetUser.email,
          count: inserted.length,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ assignments: inserted });
    }
  );
}
