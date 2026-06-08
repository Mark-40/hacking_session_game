'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL && process.env.NEXT_PUBLIC_SOCKET_URL.length > 0
    ? process.env.NEXT_PUBLIC_SOCKET_URL
    : 'http://localhost:4000';

interface Ctx {
  socket: Socket | null;
  connected: boolean;
}

const SocketCtx = createContext<Ctx>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Create the socket inside an effect so it lives entirely on the client and
  // each StrictMode cleanup/remount gets a fresh instance. Doing this in
  // useMemo was racing the connect event against listener attachment, and the
  // dev-mode cleanup was tearing down the connection before the second effect
  // could re-attach listeners.
  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    // If the connection already finished before we got here, sync state.
    if (s.connected) setConnected(true);

    setSocket(s);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.disconnect();
    };
  }, []);

  return (
    <SocketCtx.Provider value={{ socket, connected }}>
      {children}
    </SocketCtx.Provider>
  );
}

export function useSocket(): Ctx {
  return useContext(SocketCtx);
}

const SESSION_KEY = 'qmr.sessionId';

/** Stable, per-browser session id stored in localStorage. */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let existing = window.localStorage.getItem(SESSION_KEY);
  if (!existing) {
    // crypto.randomUUID is available in all evergreen browsers.
    existing =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(SESSION_KEY, existing);
  }
  return existing;
}
