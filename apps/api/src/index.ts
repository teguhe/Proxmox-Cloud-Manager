import { config } from 'dotenv';
import { resolve } from 'node:path';
import { buildApp } from './app.js';

config({ path: resolve(process.cwd(), '../../.env') });

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

async function start() {
  const app = await buildApp();
  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
