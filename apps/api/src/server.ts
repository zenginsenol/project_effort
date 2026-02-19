import 'dotenv/config';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';

import { createContext } from './trpc/context';
import { appRouter } from './routers/index';
import { parseDocument } from './services/document/parser';
import { extractTasksFromText } from './services/document/task-extractor';
import { setupWebSocket } from './websocket/index';

const PORT = Number(process.env.API_PORT) || 4000;
const HOST = process.env.API_HOST || '0.0.0.0';

async function start(): Promise<void> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    },
    maxParamLength: 5000,
  });

  await fastify.register(cors, {
    origin: [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // REST endpoint for file upload + AI analysis (tRPC doesn't support file uploads)
  fastify.post('/api/analyze-document', async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const { text, fileName, mimeType } = await parseDocument(file);
      const hourlyRate = Number((request.query as Record<string, string>).hourlyRate) || 150;
      const projectContext = (request.query as Record<string, string>).projectContext || '';

      const result = await extractTasksFromText(text, projectContext, hourlyRate);
      return { ...result, sourceFile: fileName, sourceMimeType: mimeType };
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to process document',
      });
    }
  });

  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });

  await fastify.listen({ port: PORT, host: HOST });

  const io = setupWebSocket(fastify);
  console.log(`API server running at http://${HOST}:${PORT}`);
  console.log(`WebSocket server running at ws://${HOST}:${PORT}/ws`);
}

start().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
