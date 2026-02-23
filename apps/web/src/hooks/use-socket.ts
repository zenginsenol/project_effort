'use client';

import { useEffect, useRef, useState } from 'react';

import type { Socket } from 'socket.io-client';

export interface UseSocketOptions {
  url: string;
  path?: string;
  auth?: {
    userId: string;
    orgId: string;
  };
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

export interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempt: number;
}

const DEFAULT_RECONNECTION_DELAY = 1000; // 1 second
const DEFAULT_RECONNECTION_DELAY_MAX = 30000; // 30 seconds
const DEFAULT_RECONNECTION_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * Custom hook for managing Socket.io connections with exponential backoff reconnection.
 *
 * @param options - Socket connection options
 * @returns Socket instance, connection state, and error information
 *
 * @example
 * const { socket, isConnected, error } = useSocket({
 *   url: 'http://localhost:4000',
 *   path: '/ws',
 *   auth: { userId: 'user-123', orgId: 'org-456' },
 *   autoConnect: true,
 *   reconnection: true,
 * });
 */
export function useSocket(options: UseSocketOptions): UseSocketReturn {
  const {
    url,
    path = '/ws',
    auth,
    autoConnect = true,
    reconnection = true,
    reconnectionDelay = DEFAULT_RECONNECTION_DELAY,
    reconnectionDelayMax = DEFAULT_RECONNECTION_DELAY_MAX,
    reconnectionAttempts = DEFAULT_RECONNECTION_ATTEMPTS,
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!autoConnect || !auth) {
      return;
    }

    // Capture auth in local scope to avoid TypeScript narrowing issues
    const authData = auth;
    let cancelled = false;

    async function connectSocket(): Promise<void> {
      if (cancelled || !isMountedRef.current) {
        return;
      }

      setIsConnecting(true);
      setError(null);

      try {
        const { io } = await import('socket.io-client');
        if (cancelled || !isMountedRef.current) {
          return;
        }

        const socketInstance = io(url, {
          path,
          transports: ['websocket'],
          auth: {
            userId: authData.userId,
            orgId: authData.orgId,
          },
          reconnection: false, // We handle reconnection manually with exponential backoff
        });

        if (cancelled || !isMountedRef.current) {
          socketInstance.disconnect();
          return;
        }

        socketInstance.on('connect', () => {
          if (!isMountedRef.current) {
            return;
          }

          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          setReconnectAttempt(0);
          hasConnectedOnceRef.current = true;

          // Clear any pending reconnection timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }

          // Start heartbeat ping to keep connection alive
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }

          heartbeatIntervalRef.current = setInterval(() => {
            if (socketInstance.connected) {
              socketInstance.emit('ping');
            }
          }, HEARTBEAT_INTERVAL);
        });

        socketInstance.on('connect_error', (connectError) => {
          if (!isMountedRef.current) {
            return;
          }

          const errorMessage = connectError.message || 'Connection error';
          setError(errorMessage);
          setIsConnecting(false);
          setIsConnected(false);

          // Attempt reconnection with exponential backoff
          if (reconnection && reconnectAttempt < reconnectionAttempts) {
            scheduleReconnect();
          }
        });

        socketInstance.on('disconnect', (reason) => {
          if (!isMountedRef.current) {
            return;
          }

          setIsConnected(false);
          setIsConnecting(false);

          // Clear heartbeat interval on disconnect
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }

          // Only attempt reconnection if disconnect was not initiated by the client
          if (
            reconnection &&
            hasConnectedOnceRef.current &&
            reason !== 'io client disconnect' &&
            reconnectAttempt < reconnectionAttempts
          ) {
            scheduleReconnect();
          }
        });

        socketInstance.on('error', (socketError: Error) => {
          if (!isMountedRef.current) {
            return;
          }

          const errorMessage = socketError.message || 'Socket error';
          setError(errorMessage);
        });

        setSocket(socketInstance);
      } catch (importError) {
        if (!isMountedRef.current) {
          return;
        }

        const errorMessage =
          importError instanceof Error ? importError.message : 'Failed to load socket.io-client';
        setError(errorMessage);
        setIsConnecting(false);
      }
    }

    function scheduleReconnect(): void {
      if (!isMountedRef.current || reconnectTimeoutRef.current) {
        return;
      }

      const attempt = reconnectAttempt + 1;
      setReconnectAttempt(attempt);

      // Calculate delay with exponential backoff: delay * 2^attempt
      const delay = Math.min(reconnectionDelay * Math.pow(2, attempt - 1), reconnectionDelayMax);

      setIsConnecting(true);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }

        reconnectTimeoutRef.current = null;

        // Disconnect old socket if it exists
        if (socket) {
          socket.disconnect();
        }

        // Attempt to reconnect
        void connectSocket();
      }, delay);
    }

    void connectSocket();

    return () => {
      cancelled = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (socket) {
        socket.disconnect();
      }
    };
  }, [
    url,
    path,
    auth,
    autoConnect,
    reconnection,
    reconnectionDelay,
    reconnectionDelayMax,
    reconnectionAttempts,
    reconnectAttempt,
    socket,
  ]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    reconnectAttempt,
  };
}
