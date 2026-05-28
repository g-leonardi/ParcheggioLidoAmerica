import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { existsSync } from 'node:fs';
import path from 'node:path';
import routes from './routes.js';

const app = Fastify({ logger: true });
// Foto per ALPR: solo in memoria (mai su disco), max 5 MB.
await app.register(fastifyMultipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
await app.register(routes);

// In produzione serviamo la build statica del client dalla stessa porta (un solo servizio).
// In sviluppo si usa invece il dev server di Vite (proxy /api), quindi client/dist non esiste.
const distDir = path.join(process.cwd(), 'client', 'dist');
if (existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api')) {
      return reply.code(404).send({ ok: false, motivo: 'not_found' });
    }
    return reply.sendFile('index.html'); // fallback SPA
  });
}

const port = Number(process.env.PORT || 3000);
try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
