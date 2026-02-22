import 'dotenv/config';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';

import { createContext, validateAuthRuntimeConfig } from './trpc/context';
import { appRouter } from './routers/index';
import { swaggerConfig, swaggerUiConfig } from './rest/openapi';
import { registerRestApi } from './rest/index';
import { parseDocument } from './services/document/parser';
import { upsertOpenAIOAuthCredential } from './services/oauth/oauth-credential-store';
import { exchangeCodeForTokens } from './services/oauth/openai-oauth';
import { getPendingFlow, removePendingFlow } from './services/oauth/oauth-store';
import { setupWebSocket } from './websocket/index';

const PORT = Number(process.env.API_PORT) || 4000;
const HOST = process.env.API_HOST || '0.0.0.0';
const WEB_APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://127.0.0.1:3000';

async function start(): Promise<void> {
  validateAuthRuntimeConfig();

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

  // Register OpenAPI/Swagger documentation
  await fastify.register(swagger, swaggerConfig);
  await fastify.register(swaggerUi, swaggerUiConfig);

  // Register public REST API with authentication and rate limiting
  await registerRestApi(fastify);

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
      const query = request.query as Record<string, string | undefined>;
      const hourlyRate = Number(query.hourlyRate) || 150;
      const projectContext = query.projectContext?.trim() || undefined;
      const provider = query.provider?.trim();
      const model = query.model?.trim();
      const reasoningEffort = query.reasoningEffort?.trim();

      const allowedProviders = new Set(['openai', 'anthropic', 'openrouter']);
      const allowedEfforts = new Set(['low', 'medium', 'high', 'xhigh']);

      if (provider && !allowedProviders.has(provider)) {
        return reply.status(400).send({ error: `Unsupported provider: ${provider}` });
      }

      if (reasoningEffort && !allowedEfforts.has(reasoningEffort)) {
        return reply.status(400).send({ error: `Unsupported reasoningEffort: ${reasoningEffort}` });
      }

      const ctx = await createContext({ req: request, res: reply } as never);
      if (!ctx.userId) {
        return reply.status(401).send({
          error: 'Authentication required for document analysis. Sign in and retry.',
        });
      }

      const caller = appRouter.createCaller(ctx);
      const result = await caller.document.analyzeText({
        text,
        projectContext,
        hourlyRate,
        provider: provider as 'openai' | 'anthropic' | 'openrouter' | undefined,
        model: model && model.length > 0 ? model : undefined,
        reasoningEffort: reasoningEffort as 'low' | 'medium' | 'high' | 'xhigh' | undefined,
      });

      return { ...result, sourceFile: fileName, sourceMimeType: mimeType };
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to process document',
      });
    }
  });

  // OpenAI OAuth callback route for API-server callback mode.
  fastify.get('/auth/openai/callback', async (request, reply) => {
    const {
      code,
      state,
      error,
      error_description,
    } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    if (error) {
      if (state) {
        removePendingFlow(state);
      }
      return reply.status(400).send(errorPage(`OAuth failed: ${error_description ?? error}`, WEB_APP_URL));
    }

    if (!code || !state) {
      return reply.status(400).send(errorPage('Missing code or state parameter', WEB_APP_URL));
    }

    const pendingFlow = getPendingFlow(state);
    if (!pendingFlow) {
      return reply.status(400).send(errorPage('Invalid or expired OAuth state. Please try signing in again.', WEB_APP_URL));
    }

    try {
      const tokens = await exchangeCodeForTokens({
        code,
        codeVerifier: pendingFlow.codeVerifier,
        redirectUri: pendingFlow.redirectUri,
      });

      removePendingFlow(state);

      const { email } = await upsertOpenAIOAuthCredential({
        clerkUserId: pendingFlow.userId,
        tokens,
        defaultModel: 'gpt-5.2',
      });

      return reply
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(successPage(email, WEB_APP_URL));
    } catch (err) {
      removePendingFlow(state);
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[oauth-callback] Error:', errMsg);
      return reply.status(500).send(errorPage(`OAuth failed: ${errMsg}`, WEB_APP_URL));
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

  setupWebSocket(fastify);
  console.log(`API server running at http://${HOST}:${PORT}`);
  console.log(`WebSocket server running at ws://${HOST}:${PORT}/ws`);
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function successPage(email: string | null, webAppUrl: string): string {
  const settingsUrl = `${webAppUrl.replace(/\/+$/, '')}/dashboard/settings`;
  const safeEmail = email ? escapeHtml(email) : null;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EstimatePro - Connected!</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{text-align:center;max-width:420px;padding:48px;border-radius:16px;background:#1a1a1a;border:1px solid #333}
.icon{font-size:48px;margin-bottom:16px}h1{margin:0 0 8px;font-size:24px;color:#22c55e}
p{margin:0;color:#888;line-height:1.5}
.email{color:#60a5fa;font-weight:500}
.btn{display:inline-block;margin-top:24px;padding:10px 24px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:500}
.btn:hover{background:#2563eb}</style></head>
<body><div class="card">
<div class="icon">✅</div>
<h1>OpenAI Connected!</h1>
<p>Your ChatGPT subscription is now linked to EstimatePro.${safeEmail ? `<br><span class="email">${safeEmail}</span>` : ''}</p>
<p style="margin-top:12px;font-size:14px">You can now use AI-powered task extraction with your subscription.</p>
<a href="${settingsUrl}" class="btn">Back to Settings</a>
</div></body></html>`;
}

function errorPage(message: string, webAppUrl: string): string {
  const settingsUrl = `${webAppUrl.replace(/\/+$/, '')}/dashboard/settings`;
  const safeMessage = escapeHtml(message);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EstimatePro - Error</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{text-align:center;max-width:420px;padding:48px;border-radius:16px;background:#1a1a1a;border:1px solid #333}
.icon{font-size:48px;margin-bottom:16px}h1{margin:0 0 8px;font-size:24px;color:#ef4444}
p{margin:0;color:#888;line-height:1.5}
.btn{display:inline-block;margin-top:24px;padding:10px 24px;background:#3b82f6;color:#fff;border-radius:8px;text-decoration:none;font-weight:500}
.btn:hover{background:#2563eb}</style></head>
<body><div class="card">
<div class="icon">❌</div>
<h1>Connection Failed</h1>
<p>${safeMessage}</p>
<a href="${settingsUrl}" class="btn">Back to Settings</a>
</div></body></html>`;
}

start().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
