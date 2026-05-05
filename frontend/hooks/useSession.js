'use client';

import { useState, useEffect } from 'react';
import { sessionApi } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

/**
 * Hook to sync session data (cart, orders) in real-time.
 */
export function useSession(sessionId) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) return;

    // Initial load
    sessionApi.getById(sessionId)
      .then(res => setSession(res.data.session))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));

    // Subscribe to socket updates
    const socket = connectSocket();
    socket.on('cart-updated', (data) => {
      setSession(prev => prev ? { ...prev, cart: data.cart, total: data.total, subtotal: data.subtotal } : prev);
    });
    socket.on('order-placed', () => {
      sessionApi.getById(sessionId).then(res => setSession(res.data.session)).catch(() => {});
    });
    socket.on('bill-finalized', (data) => {
      setSession(prev => prev ? { ...prev, status: 'billed', ...data.bill } : prev);
    });

    return () => {
      socket.off('cart-updated');
      socket.off('order-placed');
      socket.off('bill-finalized');
    };
  }, [sessionId]);

  return { session, loading, error, setSession };
}

export default useSession;
