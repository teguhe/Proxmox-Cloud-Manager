import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

config({ path: resolve(process.cwd(), '../../.env') });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://proxmox_mgr:proxmox_mgr_secret@localhost:5433/proxmox_cloud_manager',
  },
});
