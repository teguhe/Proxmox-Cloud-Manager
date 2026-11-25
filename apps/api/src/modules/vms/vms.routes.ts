import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  cloneVmSchema,
  createIsoVmSchema,
  createLxcSchema,
  powerActionBodySchema,
  vmTypeSchema,
  type VmSummaryDto,
} from 'shared';
import { db, operatorVpsAssignments, proxmoxNodes } from '../../db/index.js';
import {
  authenticate,
  requireRole,
  requireVpsAccess,
} from '../../plugins/auth.js';
import { recordActivityLog } from '../../services/audit.service.js';
import { ProxmoxClient } from '../../services/proxmox.service.js';
import { decryptSecret } from '../../utils/crypto.js';
import { issueWsTicket } from '../../ws/ticket-store.js';

async function getNodeClient(nodeId: string) {
  const [node] = await db
    .select()
    .from(proxmoxNodes)
    .where(eq(proxmoxNodes.id, nodeId))
    .limit(1);

  if (!node) return null;

  return {
    node,
    client: new ProxmoxClient({
      host: node.host,
      port: node.port,
      pveNodeName: node.pveNodeName,
      apiTokenId: node.apiTokenId,
      apiTokenSecret: decryptSecret(node.apiTokenSecretEnc),
      verifyTls: node.verifyTls,
    }),
  };
}

export async function vmsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    { preHandler: [requireRole('super_admin', 'admin', 'operator', 'audit')] },
    async (request, reply) => {
      const nodes = await db
        .select()
        .from(proxmoxNodes)
        .where(eq(proxmoxNodes.isEnabled, true));

      const user = request.currentUser!;
      let allowedKeys: Set<string> | null = null;

      if (user.role === 'operator') {
        const assignments = await db
          .select()
          .from(operatorVpsAssignments)
          .where(eq(operatorVpsAssignments.userId, user.id));
        allowedKeys = new Set(
          assignments.map((a) => `${a.nodeId}:${a.vmType}:${a.vmid}`)
        );
      }

      const settled = await Promise.allSettled(
        nodes.map(async (node) => {
          const client = new ProxmoxClient({
            host: node.host,
            port: node.port,
            pveNodeName: node.pveNodeName,
            apiTokenId: node.apiTokenId,
            apiTokenSecret: decryptSecret(node.apiTokenSecretEnc),
            verifyTls: node.verifyTls,
          });
          const { qemu, lxc } = await client.listVmsAndLxc();
          const items: VmSummaryDto[] = [
            ...qemu.map((vm) => ({
              nodeId: node.id,
              nodeName: node.name,
              pveNodeName: node.pveNodeName,
              vmid: vm.vmid,
              name: vm.name ?? `vm-${vm.vmid}`,
              vmType: 'qemu' as const,
              status: vm.status,
              cpus: vm.cpus ?? 1,
              maxmem: vm.maxmem ?? 0,
              mem: vm.mem ?? 0,
              maxdisk: vm.maxdisk ?? 0,
              disk: vm.disk ?? 0,
              uptime: vm.uptime ?? 0,
              template: vm.template === 1,
            })),
            ...lxc.map((ct) => ({
              nodeId: node.id,
              nodeName: node.name,
              pveNodeName: node.pveNodeName,
              vmid: ct.vmid,
              name: ct.name ?? `ct-${ct.vmid}`,
              vmType: 'lxc' as const,
              status: ct.status,
              cpus: ct.cpus ?? 1,
              maxmem: ct.maxmem ?? 0,
              mem: ct.mem ?? 0,
              maxdisk: ct.maxdisk ?? 0,
              disk: ct.disk ?? 0,
              uptime: ct.uptime ?? 0,
              template: ct.template === 1,
            })),
          ];
          return items;
        })
      );

      let vms = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      if (allowedKeys) {
        vms = vms.filter((v) =>
          allowedKeys!.has(`${v.nodeId}:${v.vmType}:${v.vmid}`)
        );
      }

      return reply.send({ vms });
    }
  );

  app.post<{ Params: { nodeId: string } }>(
    '/:nodeId/clone',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const parsed = cloneVmSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const found = await getNodeClient(request.params.nodeId);
      if (!found) return reply.code(404).send({ error: 'Node not found' });

      const upid = await found.client.cloneVm(parsed.data);

      await recordActivityLog({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        action: 'VPS_PROVISION_CLONE',
        targetType: 'vps',
        targetId: `${found.node.id}:${parsed.data.newVmid}`,
        metadata: { name: parsed.data.name, upid },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.code(202).send({ upid });
    }
  );

  app.post<{ Params: { nodeId: string } }>(
    '/:nodeId/iso',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const parsed = createIsoVmSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const found = await getNodeClient(request.params.nodeId);
      if (!found) return reply.code(404).send({ error: 'Node not found' });

      const upid = await found.client.createIsoVm(parsed.data);

      await recordActivityLog({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        action: 'VPS_PROVISION_ISO',
        targetType: 'vps',
        targetId: `${found.node.id}:${parsed.data.vmid}`,
        metadata: { name: parsed.data.name, upid },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.code(202).send({ upid });
    }
  );

  app.post<{ Params: { nodeId: string } }>(
    '/:nodeId/lxc',
    { preHandler: [requireRole('super_admin', 'admin')] },
    async (request, reply) => {
      const parsed = createLxcSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const found = await getNodeClient(request.params.nodeId);
      if (!found) return reply.code(404).send({ error: 'Node not found' });

      const upid = await found.client.createLxc(parsed.data);

      await recordActivityLog({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        action: 'VPS_PROVISION_LXC',
        targetType: 'vps',
        targetId: `${found.node.id}:${parsed.data.vmid}`,
        metadata: { hostname: parsed.data.hostname, upid },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.code(202).send({ upid });
    }
  );

  app.post<{ Params: { nodeId: string; vmType: string; vmid: string } }>(
    '/:nodeId/:vmType/:vmid/power',
    {
      preHandler: [
        requireRole('super_admin', 'admin', 'operator'),
        requireVpsAccess,
      ],
    },
    async (request, reply) => {
      const vmTypeParsed = vmTypeSchema.safeParse(request.params.vmType);
      const bodyParsed = powerActionBodySchema.safeParse(request.body);
      if (!vmTypeParsed.success || !bodyParsed.success) {
        return reply.code(400).send({ error: 'Invalid vmType or power action' });
      }

      const found = await getNodeClient(request.params.nodeId);
      if (!found) return reply.code(404).send({ error: 'Node not found' });

      const vmid = Number(request.params.vmid);
      const upid = await found.client.powerAction(
        vmTypeParsed.data,
        vmid,
        bodyParsed.data.action
      );

      await recordActivityLog({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        action: `VPS_POWER_${bodyParsed.data.action.toUpperCase()}`,
        targetType: 'vps',
        targetId: `${found.node.id}:${vmid}`,
        metadata: { vmType: vmTypeParsed.data, upid },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return reply.send({ upid });
    }
  );

  app.post<{ Params: { nodeId: string; vmType: string; vmid: string } }>(
    '/:nodeId/:vmType/:vmid/console-ticket',
    {
      preHandler: [
        requireRole('super_admin', 'admin', 'operator'),
        requireVpsAccess,
      ],
    },
    async (request, reply) => {
      const vmTypeParsed = vmTypeSchema.safeParse(request.params.vmType);
      if (!vmTypeParsed.success) {
        return reply.code(400).send({ error: 'Invalid vmType' });
      }

      const vmid = Number(request.params.vmid);
      const body = (request.body ?? {}) as { mode?: string };
      let vncPort: number | undefined;
      let vncTicket: string | undefined;

      if (body.mode === 'vnc') {
        const found = await getNodeClient(request.params.nodeId);
        if (!found) return reply.code(404).send({ error: 'Node not found' });
        const proxy = await found.client.createVncProxy(vmTypeParsed.data, vmid);
        vncPort = proxy.port;
        vncTicket = proxy.ticket;
      }

      const wsToken = issueWsTicket({
        userId: request.currentUser!.id,
        userEmail: request.currentUser!.email,
        userRole: request.currentUser!.role,
        nodeId: request.params.nodeId,
        vmType: vmTypeParsed.data,
        vmid,
        vncPort,
        vncTicket,
      });

      return reply.send({ wsToken, vncTicket, expiresInSeconds: 30 });
    }
  );
}
