'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ReconnectingSocket, type SocketStatus } from './ws';

/**
 * React hook over ReconnectingSocket. One socket per mounted component.
 *
 *   const { status, send } = useSocket<ChatEvent>({
 *     enabled: Boolean(user),
 *     onMessage: (evt) => { ... },
 *   });
 */
export function useSocket<T = unknown>(opts: {
  enabled?: boolean;
  url?: string;
  onMessage?: (data: T) => void;
}) {
  const { enabled = true, url } = opts;
  const [status, setStatus] = useState<SocketStatus>('idle');
  const sockRef = useRef<ReconnectingSocket<T> | null>(null);
  // Keep the latest handler without reconnecting when it changes.
  const handlerRef = useRef(opts.onMessage);
  handlerRef.current = opts.onMessage;

  useEffect(() => {
    if (!enabled) return;
    const sock = new ReconnectingSocket<T>({
      url,
      onStatus: setStatus,
      onMessage: (d) => handlerRef.current?.(d),
    });
    sockRef.current = sock;
    void sock.connect().catch(() => setStatus('closed'));
    return () => {
      sock.close();
      sockRef.current = null;
    };
  }, [enabled, url]);

  const send = useCallback((payload: unknown) => sockRef.current?.send(payload) ?? false, []);
  return { status, send };
}
