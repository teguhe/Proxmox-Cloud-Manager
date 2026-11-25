import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  createNodeSchema,
  testNodeConnectionSchema,
  updateNodeSchema,
} from 'shared';
import { db, proxmoxNodes } from '../../db/index.js';
import { authenticate, requireRole } from '../../plugins/auth.js';
import { recordActivityLog } from '../../services/audit.service.js';
import { ProxmoxClient } from '../../services/proxmox.service.js';
import { decryptSecret, encryptSecret } from '../../utils/crypto.js';

function sanitizeNode(node: typeof proxmoxNodes.$inferSelect) {
  const { apiTokenSecretEnc: _secret, ...rest } = node;
  return rest;
}

export async function nodesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    { preHandler: [requireRole('super_admin', 'admin', 'audit')] },
    async (_request, reply) => {
      const nodes = await db.select().from(proxmoxNodes);
      const results = await Promise.allSettled(
        nodes.map(async (node) => {
          const base = sanitizeNode(node);
          if (!node.isEnabled) {
            return { ...base, status: 'offline' as const };
          }
          try {
            const client = new ProxmoxClient({
              host: node.host,
              port: node.port,
              pveNodeName: node.pveNodeName,
              apiTokenId: node.apiTokenId,
              apiTokenSecret: decryptSecret(node.apiTokenSecretEnc),
              verifyTls: node.verifyTls,
            });
            const [status, version] = await Promise.all([
              client.getNodeStatus(),
              client.getVersion(),
            ]);
            return {
              ...base,
              status: 'online' as const,
              cpuUsage: status.cpu,
              maxCpu: status.cpuinfo?.cpus,
              memUsed: status.memory?.used,
              memTotal: status.memory?.total,
              diskUsed: status.rootfs?.used,
              diskTotal: status.rootfs?.total,
              uptime: status.uptime,
              pveVersion: version.version,
            };
          } catch (err) {
            console.error(
              `[Nodes] Status check failed for ${node.name} (${node.host}:${node.port}/${node.pveNodeName}):`,
              err instanceof Error ? err.message : err
            );
            return { ...base, status: 'unreachable' as const };
          }
        })
      );

      const data = results.map((r, idx) =>
        r.status === 'fulfilled'
          ? r.value
          : { ...sanitizeNode(nodes[idx]!), status: 'unreachable' as const }
      );

      return reply.send({ nodes: data });
    }
  );

  app.post(
    '/test',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const parsed = testNodeConnectionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const client = new ProxmoxClient(parsed.data);
      try {
        const version = await client.getVersion();
        return reply.send({ ok: true, version });
      } catch (err) {
        return reply.code(502).send({
          ok: false,
          error: err instanceof Error ? err.message : 'Connection failed',
        });
      }
    }
  );

  app.post(
    '/',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const parsed = createNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const input = parsed.data;
      const client = new ProxmoxClient(input);
      try {
        await client.getVersion();
      } catch (err) {
        return reply.code(502).send({
          error: `Failed to connect to Proxmox node: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`,
        });
      }

      const encryptedSecret = encryptSecret(input.apiTokenSecret);
      const [created] = await db
        .insert(proxmoxNodes)
        .values({
          name: input.name,
          pveNodeName: input.pveNodeName,
          host: input.host,
          port: input.port,
          apiTokenId: input.apiTokenId,
          apiTokenSecretEnc: encryptedSecret,
          verifyTls: input.verifyTls,
          description: input.description ?? null,
          isEnabled: input.isEnabled,
          createdBy: request.currentUser!.id,
        })
        .returning();

      await recordActivityLog({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        action: 'NODE_CREATE',
        targetType: 'node',
        targetId: created!.id,
        metadata: { name: created!.name, host: created!.host },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.code(201).send({ node: sanitizeNode(created!) });
    }
  );

  app.patch<{ Params: { nodeId: string } }>(
    '/:nodeId',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const parsed = updateNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const { apiTokenSecret, ...rest } = parsed.data;
      const updateValues: Record<string, unknown> = {
        ...rest,
        updatedAt: new Date(),
      };
      if (apiTokenSecret) {
        updateValues.apiTokenSecretEnc = encryptSecret(apiTokenSecret);
      }

      const [updated] = await db
        .update(proxmoxNodes)
        .set(updateValues)
        .where(eq(proxmoxNodes.id, request.params.nodeId))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: 'Node not found' });
      }

      await recordActivityLog({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        action: 'NODE_UPDATE',
        targetType: 'node',
        targetId: updated.id,
        metadata: { name: updated.name },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ node: sanitizeNode(updated) });
    }
  );

  app.delete<{ Params: { nodeId: string } }>(
    '/:nodeId',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const [deleted] = await db
        .delete(proxmoxNodes)
        .where(eq(proxmoxNodes.id, request.params.nodeId))
        .returning();

      if (!deleted) {
        return reply.code(404).send({ error: 'Node not found' });
      }

      await recordActivityLog({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        action: 'NODE_DELETE',
        targetType: 'node',
        targetId: deleted.id,
        metadata: { name: deleted.name, host: deleted.host },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ ok: true });
    }
  );

  app.get<{ Params: { nodeId: string } }>(
    '/:nodeId/resources',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const [node] = await db
        .select()
        .from(proxmoxNodes)
        .where(eq(proxmoxNodes.id, request.params.nodeId))
        .limit(1);

      if (!node) {
        return reply.code(404).send({ error: 'Node not found' });
      }

      const client = new ProxmoxClient({
        host: node.host,
        port: node.port,
        pveNodeName: node.pveNodeName,
        apiTokenId: node.apiTokenId,
        apiTokenSecret: decryptSecret(node.apiTokenSecretEnc),
        verifyTls: node.verifyTls,
      });

      const resources = await client.getStorageAndTemplates();
      return reply.send(resources);
    }
  );

  app.get<{ Params: { nodeId: string; upid: string } }>(
    '/:nodeId/tasks/:upid',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const [node] = await db
        .select()
        .from(proxmoxNodes)
        .where(eq(proxmoxNodes.id, request.params.nodeId))
        .limit(1);

      if (!node) {
        return reply.code(404).send({ error: 'Node not found' });
      }

      const client = new ProxmoxClient({
        host: node.host,
        port: node.port,
        pveNodeName: node.pveNodeName,
        apiTokenId: node.apiTokenId,
        apiTokenSecret: decryptSecret(node.apiTokenSecretEnc),
        verifyTls: node.verifyTls,
      });

      const status = await client.getTaskStatus(request.params.upid);
      return reply.send({ task: status });
    }
  );
}
