import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import WebSocket from 'ws';
import { Client as SshClient } from 'ssh2';
import { vmTypeSchema } from 'shared';
import { db, proxmoxNodes } from '../db/index.js';
import { recordActivityLog } from '../services/audit.service.js';
import { ProxmoxClient } from '../services/proxmox.service.js';
import { decryptSecret } from '../utils/crypto.js';
import { consumeWsTicket } from './ticket-store.js';

function bridgeSockets(clientWs: WebSocket, upstreamWs: WebSocket): void {
  const pending: Array<{ data: WebSocket.RawData; isBinary: boolean }> = [];

  upstreamWs.on('open', () => {
    for (const item of pending) {
      upstreamWs.send(item.data, { binary: item.isBinary });
    }
    pending.length = 0;
  });

  clientWs.on('message', (data, isBinary) => {
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.send(data, { binary: isBinary });
    } else if (upstreamWs.readyState === WebSocket.CONNECTING) {
      pending.push({ data, isBinary });
    }
  });

  upstreamWs.on('message', (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  clientWs.on('close', () => {
    if (upstreamWs.readyState === WebSocket.OPEN) upstreamWs.close();
  });

  upstreamWs.on('close', () => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });

  clientWs.on('error', () => {
    if (upstreamWs.readyState === WebSocket.OPEN) upstreamWs.close();
  });

  upstreamWs.on('error', (err) => {
    console.error('[WS Bridge] Upstream error:', err.message);
    if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
  });
}

export async function wsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: { nodeId: string; vmType: string; vmid: string };
    Querystring: { token?: string };
  }>('/vnc/:nodeId/:vmType/:vmid', { websocket: true }, async (socket, request) => {
    const vmTypeParsed = vmTypeSchema.safeParse(request.params.vmType);
    const vmid = Number(request.params.vmid);
    const token = request.query.token;

    if (!vmTypeParsed.success || Number.isNaN(vmid) || !token) {
      socket.close(4001, 'Invalid parameters or missing token');
      return;
    }

    const ticket = consumeWsTicket(
      token,
      request.params.nodeId,
      vmTypeParsed.data,
      vmid
    );
    if (!ticket) {
      socket.close(4001, 'Invalid or expired WS ticket');
      return;
    }

    const [node] = await db
      .select()
      .from(proxmoxNodes)
      .where(eq(proxmoxNodes.id, request.params.nodeId))
      .limit(1);

    if (!node) {
      socket.close(4004, 'Node not found');
      return;
    }

    try {
      const apiTokenSecret = decryptSecret(node.apiTokenSecretEnc);
      const client = new ProxmoxClient({
        host: node.host,
        port: node.port,
        pveNodeName: node.pveNodeName,
        apiTokenId: node.apiTokenId,
        apiTokenSecret,
        verifyTls: node.verifyTls,
      });

      const proxy =
        ticket.vncPort && ticket.vncTicket
          ? { port: ticket.vncPort, ticket: ticket.vncTicket }
          : await client.createVncProxy(vmTypeParsed.data, vmid);
      const pveWsUrl = `wss://${node.host}:${node.port}/api2/json/nodes/${encodeURIComponent(
        node.pveNodeName
      )}/${vmTypeParsed.data}/${vmid}/vncwebsocket?port=${proxy.port}&vncticket=${encodeURIComponent(
        proxy.ticket
      )}`;

      const upstream = new WebSocket(pveWsUrl, {
        headers: {
          Authorization: `PVEAPIToken=${node.apiTokenId}=${apiTokenSecret}`,
        },
        rejectUnauthorized: node.verifyTls,
      });

      await recordActivityLog({
        userId: ticket.userId,
        userEmail: ticket.userEmail,
        userRole: ticket.userRole,
        action: 'VNC_SESSION_OPEN',
        targetType: 'vps',
        targetId: `${node.id}:${vmid}`,
        ipAddress: request.ip,
      });

      bridgeSockets(socket, upstream);
    } catch {
      socket.close(1011, 'Failed to establish VNC bridge');
    }
  });

  app.get<{
    Params: { nodeId: string; vmType: string; vmid: string };
    Querystring: { token?: string };
  }>(
    '/termproxy/:nodeId/:vmType/:vmid',
    { websocket: true },
    async (socket, request) => {
      const vmTypeParsed = vmTypeSchema.safeParse(request.params.vmType);
      const vmid = Number(request.params.vmid);
      const token = request.query.token;

      if (!vmTypeParsed.success || Number.isNaN(vmid) || !token) {
        socket.close(4001, 'Invalid parameters or missing token');
        return;
      }

      const ticket = consumeWsTicket(
        token,
        request.params.nodeId,
        vmTypeParsed.data,
        vmid
      );
      if (!ticket) {
        socket.close(4001, 'Invalid or expired WS ticket');
        return;
      }

      const [node] = await db
        .select()
        .from(proxmoxNodes)
        .where(eq(proxmoxNodes.id, request.params.nodeId))
        .limit(1);

      if (!node) {
        socket.close(4004, 'Node not found');
        return;
      }

      try {
        const apiTokenSecret = decryptSecret(node.apiTokenSecretEnc);
        const client = new ProxmoxClient({
          host: node.host,
          port: node.port,
          pveNodeName: node.pveNodeName,
          apiTokenId: node.apiTokenId,
          apiTokenSecret,
          verifyTls: node.verifyTls,
        });

        const proxy = await client.createTermProxy(vmTypeParsed.data, vmid);
        const pveWsUrl = `wss://${node.host}:${node.port}/api2/json/nodes/${encodeURIComponent(
          node.pveNodeName
        )}/${vmTypeParsed.data}/${vmid}/vncwebsocket?port=${proxy.port}&vncticket=${encodeURIComponent(
          proxy.ticket
        )}`;

        const upstream = new WebSocket(pveWsUrl, {
          headers: {
            Authorization: `PVEAPIToken=${node.apiTokenId}=${apiTokenSecret}`,
          },
          rejectUnauthorized: node.verifyTls,
        });

        upstream.on('open', () => {
          upstream.send(`${proxy.user}:${proxy.ticket}\n`);
        });

        await recordActivityLog({
          userId: ticket.userId,
          userEmail: ticket.userEmail,
          userRole: ticket.userRole,
          action: 'TERMPROXY_SESSION_OPEN',
          targetType: 'vps',
          targetId: `${node.id}:${vmid}`,
          ipAddress: request.ip,
        });

        bridgeSockets(socket, upstream);
      } catch {
        socket.close(1011, 'Failed to establish Termproxy bridge');
      }
    }
  );

  app.get<{
    Params: { nodeId: string; vmType: string; vmid: string };
    Querystring: { token?: string };
  }>('/ssh/:nodeId/:vmType/:vmid', { websocket: true }, async (socket, request) => {
    const vmTypeParsed = vmTypeSchema.safeParse(request.params.vmType);
    const vmid = Number(request.params.vmid);
    const token = request.query.token;

    if (!vmTypeParsed.success || Number.isNaN(vmid) || !token) {
      socket.close(4001, 'Invalid parameters or missing token');
      return;
    }

    const ticket = consumeWsTicket(
      token,
      request.params.nodeId,
      vmTypeParsed.data,
      vmid
    );
    if (!ticket) {
      socket.close(4001, 'Invalid or expired WS ticket');
      return;
    }

    const ssh = new SshClient();
    let authenticated = false;

    socket.on('message', (raw) => {
      if (authenticated) return;
      try {
        const msg = JSON.parse(raw.toString('utf8')) as {
          type?: string;
          host?: string;
          port?: number;
          username?: string;
          password?: string;
          privateKey?: string;
        };

        if (msg.type !== 'auth' || !msg.host || !msg.username) {
          socket.send(JSON.stringify({ type: 'error', message: 'Invalid auth frame' }));
          return;
        }

        authenticated = true;

        ssh
          .on('ready', async () => {
            await recordActivityLog({
              userId: ticket.userId,
              userEmail: ticket.userEmail,
              userRole: ticket.userRole,
              action: 'SSH_SESSION_OPEN',
              targetType: 'vps',
              targetId: `${ticket.nodeId}:${vmid}`,
              metadata: { host: msg.host, port: msg.port ?? 22 },
              ipAddress: request.ip,
            });

            ssh.shell({ term: 'xterm-256color' }, (err, stream) => {
              if (err) {
                socket.close(1011, 'Failed to open SSH shell');
                return;
              }

              stream.on('data', (chunk: Buffer) => {
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(chunk.toString('utf8'));
                }
              });

              stream.on('close', () => {
                socket.close();
                ssh.end();
              });

              socket.on('message', (data) => {
                const text = data.toString('utf8');
                try {
                  const ctrl = JSON.parse(text) as {
                    type?: string;
                    cols?: number;
                    rows?: number;
                  };
                  if (ctrl.type === 'resize' && ctrl.cols && ctrl.rows) {
                    stream.setWindow(ctrl.rows, ctrl.cols, 0, 0);
                    return;
                  }
                } catch {
                  // Regular terminal input
                }
                stream.write(text);
              });
            });
          })
          .on('error', (err) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(`\r\n[SSH Error]: ${err.message}\r\n`);
              socket.close(1011, 'SSH connection error');
            }
          })
          .connect({
            host: msg.host,
            port: msg.port ?? 22,
            username: msg.username,
            password: msg.password,
            privateKey: msg.privateKey,
            readyTimeout: 10000,
          });
      } catch {
        socket.close(1008, 'Invalid auth payload');
      }
    });

    socket.on('close', () => {
      ssh.end();
    });
  });
}
