import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { authRoutes } from './modules/auth/auth.routes.js';
import { nodesRoutes } from './modules/nodes/nodes.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { assignmentsRoutes } from './modules/assignments/assignments.routes.js';
import { vmsRoutes } from './modules/vms/vms.routes.js';
import { statsRoutes } from './modules/stats/stats.routes.js';
import { logsRoutes } from './modules/logs/logs.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { wsRoutes } from './ws/ws.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  await app.register(websocket);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(nodesRoutes, { prefix: '/api/v1/nodes' });
  await app.register(usersRoutes, { prefix: '/api/v1/users' });
  await app.register(assignmentsRoutes, { prefix: '/api/v1/assignments' });
  await app.register(vmsRoutes, { prefix: '/api/v1/vms' });
  await app.register(statsRoutes, { prefix: '/api/v1/stats' });
  await app.register(logsRoutes, { prefix: '/api/v1/logs' });
  await app.register(reportsRoutes, { prefix: '/api/v1/reports' });
  await app.register(wsRoutes, { prefix: '/ws' });

  return app;
}
