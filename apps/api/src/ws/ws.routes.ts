import net from 'node:net';
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
          upstream.send('1:80:24:\n');
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

        socket.on('message', (data) => {
          if (upstream.readyState !== WebSocket.OPEN) return;
          const text = data.toString('utf8');
          upstream.send(`0:${Buffer.byteLength(text)}:${text}`);
        });

        upstream.on('message', (data, isBinary) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(data, { binary: isBinary });
          }
        });

        socket.on('close', () => {
          if (upstream.readyState === WebSocket.OPEN) upstream.close();
        });
        upstream.on('close', () => {
          if (socket.readyState === WebSocket.OPEN) socket.close();
        });
        upstream.on('error', (err) => {
          console.error('[Termproxy] Upstream error:', err.message);
          if (socket.readyState === WebSocket.OPEN) socket.close();
        });
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

  app.get<{
    Params: { nodeId: string; vmType: string; vmid: string };
    Querystring: {
      token?: string;
      protocol?: string;
      host?: string;
      port?: string;
      username?: string;
      password?: string;
    };
  }>('/guacamole/:nodeId/:vmType/:vmid', { websocket: true }, async (socket, request) => {
    const vmTypeParsed = vmTypeSchema.safeParse(request.params.vmType);
    const vmid = Number(request.params.vmid);
    const {
      token,
      protocol = 'rdp',
      host,
      port,
      username = '',
      password = '',
    } = request.query;

    if (!vmTypeParsed.success || Number.isNaN(vmid) || !token || !host) {
      socket.close(4001, 'Invalid parameters or missing token/host');
      return;
    }

    if (!['rdp', 'vnc', 'ssh'].includes(protocol)) {
      socket.close(4001, 'Unsupported Guacamole protocol');
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

    await recordActivityLog({
      userId: ticket.userId,
      userEmail: ticket.userEmail,
      userRole: ticket.userRole,
      action: 'GUACAMOLE_CONNECT',
      targetType: vmTypeParsed.data,
      targetId: `${request.params.nodeId}:${vmid}:${protocol}`,
      metadata: { host, port, protocol },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    const guacdHost = process.env.GUACD_HOST || '127.0.0.1';
    const guacdPort = Number(process.env.GUACD_PORT || 4822);

    const encodeInstruction = (elements: string[]): string =>
      elements.map((el) => `${el.length}.${el}`).join(',') + ';';

    const parseFirstInstruction = (raw: string): string[] => {
      const semi = raw.indexOf(';');
      if (semi === -1) return [];
      const body = raw.slice(0, semi);
      const parts: string[] = [];
      let idx = 0;
      while (idx < body.length) {
        const dot = body.indexOf('.', idx);
        if (dot === -1) break;
        const len = Number(body.slice(idx, dot));
        const val = body.slice(dot + 1, dot + 1 + len);
        parts.push(val);
        idx = dot + 1 + len + 1; // skip comma
      }
      return parts;
    };

    const guacdSocket = net.connect(guacdPort, guacdHost);
    let handshakeDone = false;
    let buffer = '';

    const connParams: Record<string, string> = {
      hostname: host,
      port: port || (protocol === 'rdp' ? '3389' : protocol === 'vnc' ? '5900' : '22'),
      username,
      password,
      'ignore-cert': 'true',
      security: 'any',
    };

    guacdSocket.on('connect', () => {
      guacdSocket.write(encodeInstruction(['select', protocol]));
    });

    guacdSocket.on('data', (chunk: Buffer) => {
      if (handshakeDone) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(chunk.toString('utf8'));
        }
        return;
      }

      buffer += chunk.toString('utf8');
      const semiIdx = buffer.indexOf(';');
      if (semiIdx === -1) return;

      const first = buffer.slice(0, semiIdx + 1);
      const rest = buffer.slice(semiIdx + 1);
      const args = parseFirstInstruction(first);

      if (args[0] === 'args') {
        buffer = rest;
        const connectValues = args.slice(1).map((name) => connParams[name] ?? '');
        guacdSocket.write(encodeInstruction(['size', '1024', '768', '96']));
        guacdSocket.write(encodeInstruction(['audio']));
        guacdSocket.write(encodeInstruction(['video']));
        guacdSocket.write(encodeInstruction(['image', 'image/png', 'image/jpeg']));
        guacdSocket.write(encodeInstruction(['connect', ...connectValues]));
        handshakeDone = true;
        if (rest.length > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(rest);
        }
      }
    });

    socket.on('message', (data) => {
      const msg = typeof data === 'string' ? data : data.toString('utf8');
      if (!guacdSocket.destroyed) {
        guacdSocket.write(msg);
      }
    });

    guacdSocket.on('error', (err) => {
      console.error('[Guacamole] guacd error:', err.message);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1011, `guacd error: ${err.message}`);
      }
    });

    guacdSocket.on('close', () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    });

    socket.on('close', () => {
      if (!guacdSocket.destroyed) {
        guacdSocket.end();
      }
    });
  });
}
