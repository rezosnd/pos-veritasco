'use client';

import { useEffect, useRef } from 'react';
import { connectSocket } from '@/lib/socket';

/**
 * Hook for managing Socket.IO connection with automatic cleanup.
 * @param {Object} options
 * @param {Function} options.onConnect
 * @param {Function} options.onDisconnect
 * @param {Object} options.events - { eventName: handler }
 * @returns {socket}
 */
export function useSocket({ onConnect, onDisconnect, events = {} } = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    if (onConnect) socket.on('connect', onConnect);
    if (onDisconnect) socket.on('disconnect', onDisconnect);

    // Register all event handlers
    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      if (onConnect) socket.off('connect', onConnect);
      if (onDisconnect) socket.off('disconnect', onDisconnect);
      Object.entries(events).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return socketRef.current;
}

export default useSocket;
