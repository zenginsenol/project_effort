'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { getApiBaseUrl } from '@/lib/api-url';

interface NotificationContextValue {
  socket: Socket | null;
  connected: boolean;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Initialize WebSocket connection
    const apiBaseUrl = getApiBaseUrl();
    const wsUrl = apiBaseUrl.replace(/^http/, 'ws');

    const socketInstance = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      auth: {
        // Demo mode: provide a demo user ID
        userId: 'demo-user',
        orgId: '00000000-0000-0000-0000-000000000000',
      },
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected:', socketInstance.id);
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socketInstance.on('notification', (notification: unknown) => {
      console.log('Notification received:', notification);
      // Increment unread count when new notification arrives
      setUnreadCount((prev) => prev + 1);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const value: NotificationContextValue = {
    socket,
    connected,
    unreadCount,
    setUnreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
