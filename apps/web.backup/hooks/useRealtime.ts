import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const useRealtime = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('vitalcv:selected-role') : null;

    if (!socketRef.current) {
      socketRef.current = io(API_URL, {
        transports: ['websocket'],
        query: {
           role: role || 'unknown',
           userId: typeof window !== 'undefined' ? localStorage.getItem('vitalcv:user-id') || 'anon-' + Math.random().toString(36).substr(2, 9) : 'anon'
        }
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        console.log('Socket connected');
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
        console.log('Socket disconnected');
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const onCredentialUpdate = (callback: (data: any) => void) => {
    if (!socketRef.current) return () => {};
    socketRef.current.on('credential:updated', callback);
    return () => {
      socketRef.current?.off('credential:updated', callback);
    };
  };

  const onVerificationUpdate = (callback: (data: any) => void) => {
    if (!socketRef.current) return () => {};
    socketRef.current.on('verification:submitted', callback);
    return () => {
      socketRef.current?.off('verification:submitted', callback);
    };
  };

  const onUserPresence = (callback: (event: 'online' | 'offline', data: any) => void) => {
    if (!socketRef.current) return () => {};

    const handleOnline = (data: any) => callback('online', data);
    const handleOffline = (data: any) => callback('offline', data);

    socketRef.current.on('user:online', handleOnline);
    socketRef.current.on('user:offline', handleOffline);

    return () => {
      socketRef.current?.off('user:online', handleOnline);
      socketRef.current?.off('user:offline', handleOffline);
    };
  };

  return {
    socket: socketRef.current,
    isConnected,
    onCredentialUpdate,
    onVerificationUpdate,
    onUserPresence
  };
};

