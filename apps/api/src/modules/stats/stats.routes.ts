import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { rrdTimeframeSchema, vmTypeSchema } from 'shared';
import { db, proxmoxNodes } from '../../db/index.js';
import {
  authenticate,
  requireRole,
  requireVpsAccess,
} from '../../plugins/auth.js';
import { ProxmoxClient } from '../../services/proxmox.service.js';
import { decryptSecret } from '../../utils/crypto.js';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get<{
    Params: { nodeId: string };
    Querystring: { timeframe?: string };
  }>(
    '/node/:nodeId/rrd',
    { preHandler: [requireRole('super_admin', 'admin', 'audit')] },
    async (request, reply) => {
      const timeframe = rrdTimeframeSchema.parse(
        request.query.timeframe ?? 'hour'
      );
      const [node] = await db
        .select()
        .from(proxmoxNodes)
        .where(eq(proxmoxNodes.id, request.params.nodeId))
        .limit(1);

      if (!node) return reply.code(404).send({ error: 'Node not found' });

      const client = new ProxmoxClient({
        host: node.host,
        port: node.port,
        pveNodeName: node.pveNodeName,
        apiTokenId: node.apiTokenId,
        apiTokenSecret: decryptSecret(node.apiTokenSecretEnc),
        verifyTls: node.verifyTls,
      });

      const data = await client.getRrdData('node', timeframe);
      return reply.send({ data });
    }
  );

  app.get<{
    Params: { nodeId: string; vmType: string; vmid: string };
    Querystring: { timeframe?: string };
  }>(
    '/vm/:nodeId/:vmType/:vmid/rrd',
    {
      preHandler: [
        requireRole('super_admin', 'admin', 'operator', 'audit'),
        requireVpsAccess,
      ],
    },
    async (request, reply) => {
      const vmType = vmTypeSchema.parse(request.params.vmType);
      const timeframe = rrdTimeframeSchema.parse(
        request.query.timeframe ?? 'hour'
      );
      const vmid = Number(request.params.vmid);

      const [node] = await db
        .select()
        .from(proxmoxNodes)
        .where(eq(proxmoxNodes.id, request.params.nodeId))
        .limit(1);

      if (!node) return reply.code(404).send({ error: 'Node not found' });

      const client = new ProxmoxClient({
        host: node.host,
        port: node.port,
        pveNodeName: node.pveNodeName,
        apiTokenId: node.apiTokenId,
        apiTokenSecret: decryptSecret(node.apiTokenSecretEnc),
        verifyTls: node.verifyTls,
      });

      const data = await client.getRrdData(vmType, timeframe, vmid);
      return reply.send({ data });
    }
  );
}
