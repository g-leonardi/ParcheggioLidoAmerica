import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { existsSync } from 'node:fs';
import path from 'node:path';
import routes from './routes.js';

const app = Fastify({ logger: true });
// Foto per ALPR: solo in memoria (mai su disco). 12 MB di margine perché i
// telefoni vecchi scattano JPEG enormi: il client le ridimensiona, ma se quel
// passo fallisce e manda l'originale, un limite troppo basso troncherebbe il
// file → immagine corrotta → "nessuna targa".
await app.register(fastifyMultipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1 } });
await app.register(routes);

// In produzione serviamo la build statica del client dalla stessa porta (un solo servizio).
// In sviluppo si usa invece il dev server di Vite (proxy /api), quindi client/dist non esiste.
const distDir = path.join(process.cwd(), 'client', 'dist');
if (existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir });
  app.setNotFoundHandler((req, reply) => {
    const url = req.raw.url || '';
    if (url.startsWith('/api')) {
      return reply.code(404).send({ ok: false, motivo: 'not_found' });
    }
    // /admin ha una pagina di ingresso propria: stesso bundle React, ma con il
    // manifest del Manager. Serve perché Android identifica una PWA installata
    // dal manifest, non dall'URL: con un manifest solo, installare dal pannello
    // installava l'app operatore.
    if (url === '/admin' || url.startsWith('/admin/') || url.startsWith('/admin?')) {
      return reply.sendFile('admin.html');
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
