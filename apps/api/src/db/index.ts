import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://proxmox_mgr:proxmox_mgr_secret@localhost:5433/proxmox_cloud_manager';

export const sqlClient = postgres(connectionString, {
  max: 10,
});

export const db = drizzle(sqlClient, { schema });
export * from './schema.js';
