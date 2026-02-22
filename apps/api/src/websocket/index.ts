import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '@clerk/backend';

import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io';

import { hasSessionAccess } from '../services/security/tenant-access';

export interface SessionEvent {
  sessionId: string;
  userId: string;
  data?: unknown;
}

export interface NotificationEvent {
  notificationId: string;
  userId: string;
  type: string;
  data?: unknown;
}

interface SocketClaims {
  org_id?: string;
  orgId?: string;
  organization_id?: string;
  sub?: string;
}

const DEMO_MODE = !process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY.includes('xxxxx');
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

function getAuthToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    return authToken.trim();
  }

  const headerValue = socket.handshake.headers.authorization;
  if (!headerValue || Array.isArray(headerValue)) {
    return null;
  }
  if (!headerValue.startsWith('Bearer ')) {
    return null;
  }
  const token = headerValue.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

function getOrgIdFromHandshake(socket: Socket): string | null {
  const authOrg = socket.handshake.auth?.orgId;
  if (typeof authOrg === 'string' && authOrg.length > 0) {
    return authOrg;
  }

  const headerOrg = socket.handshake.headers['x-org-id'] ?? socket.handshake.headers['x-organization-id'];
  if (Array.isArray(headerOrg)) {
    return headerOrg[0] ?? null;
  }
  if (typeof headerOrg === 'string' && headerOrg.length > 0) {
    return headerOrg;
  }
  return null;
}

function getOrgIdFromClaims(payload: SocketClaims): string | null {
  const candidates = [payload.org_id, payload.orgId, payload.organization_id];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

function getSocketIdentity(socket: Socket): { userId: string; orgId: string } | null {
  const userId = socket.data.userId;
  const orgId = socket.data.orgId;
  if (typeof userId !== 'string' || typeof orgId !== 'string') {
    return null;
  }
  return { userId, orgId };
}

async function authorizeSessionEvent(socket: Socket, sessionId: string): Promise<boolean> {
  const identity = getSocketIdentity(socket);
  if (!identity) {
    socket.emit('session-error', { code: 'UNAUTHORIZED', message: 'Socket is not authenticated' });
    socket.disconnect();
    return false;
  }

  const allowed = await hasSessionAccess(sessionId, identity.orgId);
  if (!allowed) {
    socket.emit('session-error', { code: 'FORBIDDEN', message: 'Session access denied', sessionId });
    return false;
  }

  return true;
}

let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return ioInstance;
}

export function emitNotificationToUser(userId: string, notification: NotificationEvent): void {
  if (!ioInstance) {
    console.warn('WebSocket server not initialized, cannot emit notification');
    return;
  }
  ioInstance.to(`user:${userId}`).emit('notification', notification);
}

export function setupWebSocket(fastify: FastifyInstance): SocketIOServer {
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    path: '/ws',
  });

  ioInstance = io;

  io.use((socket, next) => {
    void (async () => {
      if (DEMO_MODE) {
        const demoUserFromHandshake = socket.handshake.auth?.userId;
        const demoUserId = typeof demoUserFromHandshake === 'string' && demoUserFromHandshake.length > 0
          ? demoUserFromHandshake
          : 'demo-user';
        const orgId = getOrgIdFromHandshake(socket) ?? DEMO_ORG_ID;

        socket.data.userId = demoUserId;
        socket.data.orgId = orgId;
        next();
        return;
      }

      const token = getAuthToken(socket);
      if (!token) {
        next(new Error('UNAUTHORIZED: missing token'));
        return;
      }

      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey || secretKey.includes('xxxxx')) {
        next(new Error('UNAUTHORIZED: Clerk secret key not configured'));
        return;
      }

      try {
        const payload = await verifyToken(token, { secretKey }) as SocketClaims;
        const userId = typeof payload.sub === 'string' ? payload.sub : null;
        const orgId = getOrgIdFromClaims(payload) ?? getOrgIdFromHandshake(socket);

        if (!userId || !orgId) {
          next(new Error('FORBIDDEN: missing user/org context'));
          return;
        }

        socket.data.userId = userId;
        socket.data.orgId = orgId;
        next();
      } catch {
        next(new Error('UNAUTHORIZED: invalid token'));
      }
    })();
  });

  io.on('connection', (socket) => {
    const identity = getSocketIdentity(socket);
    console.log(`Client connected: ${socket.id} user=${identity?.userId ?? 'unknown'}`);

    // Auto-join user-specific room for notifications
    if (identity) {
      socket.join(`user:${identity.userId}`);
      console.log(`User ${identity.userId} joined notification room`);
    }

    socket.on('join-session', async (data: { sessionId: string; userId: string }) => {
      const authorized = await authorizeSessionEvent(socket, data.sessionId);
      if (!authorized) {
        return;
      }
      const currentIdentity = getSocketIdentity(socket);
      if (!currentIdentity) {
        return;
      }

      socket.join(`session:${data.sessionId}`);
      socket.to(`session:${data.sessionId}`).emit('participant-joined', {
        userId: currentIdentity.userId,
        socketId: socket.id,
      });
      console.log(`User ${currentIdentity.userId} joined session ${data.sessionId}`);
    });

    socket.on('leave-session', async (data: { sessionId: string; userId: string }) => {
      const authorized = await authorizeSessionEvent(socket, data.sessionId);
      if (!authorized) {
        return;
      }
      const currentIdentity = getSocketIdentity(socket);
      if (!currentIdentity) {
        return;
      }

      socket.leave(`session:${data.sessionId}`);
      socket.to(`session:${data.sessionId}`).emit('participant-left', {
        userId: currentIdentity.userId,
      });
    });

    socket.on('submit-vote', async (data: { sessionId: string; userId: string; value: string }) => {
      const authorized = await authorizeSessionEvent(socket, data.sessionId);
      if (!authorized) {
        return;
      }
      const currentIdentity = getSocketIdentity(socket);
      if (!currentIdentity) {
        return;
      }

      socket.to(`session:${data.sessionId}`).emit('vote-submitted', {
        userId: currentIdentity.userId,
      });
    });

    socket.on('reveal-votes', async (data: { sessionId: string }) => {
      const authorized = await authorizeSessionEvent(socket, data.sessionId);
      if (!authorized) {
        return;
      }
      io.to(`session:${data.sessionId}`).emit('votes-revealed', {
        sessionId: data.sessionId,
      });
    });

    socket.on('start-new-round', async (data: { sessionId: string; round: number }) => {
      const authorized = await authorizeSessionEvent(socket, data.sessionId);
      if (!authorized) {
        return;
      }
      io.to(`session:${data.sessionId}`).emit('new-round-started', {
        round: data.round,
      });
    });

    socket.on('notification-read', (data: { notificationId: string }) => {
      const currentIdentity = getSocketIdentity(socket);
      if (!currentIdentity) {
        socket.emit('notification-error', { code: 'UNAUTHORIZED', message: 'Socket is not authenticated' });
        return;
      }
      // Acknowledge the read status (actual DB update happens via tRPC)
      socket.emit('notification-read-ack', { notificationId: data.notificationId });
    });

    socket.on('notifications-mark-all-read', () => {
      const currentIdentity = getSocketIdentity(socket);
      if (!currentIdentity) {
        socket.emit('notification-error', { code: 'UNAUTHORIZED', message: 'Socket is not authenticated' });
        return;
      }
      // Acknowledge the mark all read (actual DB update happens via tRPC)
      socket.emit('notifications-mark-all-read-ack', { userId: currentIdentity.userId });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
