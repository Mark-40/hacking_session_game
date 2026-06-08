'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSocket } from '@/lib/socket';
import { QRDisplay } from '@/components/QRDisplay';
import { Leaderboard } from '@/components/Leaderboard';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Confetti } from '@/components/Confetti';
import { WinnerPodium } from '@/components/WinnerPodium';
import { SoundToggle } from '@/components/SoundToggle';
import { playSound } from '@/lib/sounds';
import type {
  ActivityEvent,
  LeaderboardEntry,
  PublicGameState,
} from '@/shared/types';

const MAX_ACTIVITY_EVENTS = 30;

export default function PresenterPage() {
  const { socket, connected } = useSocket();
  const [state, setState] = useState<PublicGameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [endedPayload, setEndedPayload] = useState<{ winners: LeaderboardEntry[]; answer: string } | null>(null);
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Build the QR target URL. Prefer NEXT_PUBLIC_PUBLIC_URL (set this to the
  // laptop's LAN IP for live demos); fall back to current origin which is
  // helpful during local development on the same machine.
  useEffect(() => {
    const fromEnv = process.env.NEXT_PUBLIC_PUBLIC_URL;
    const base = fromEnv && fromEnv.length > 0 ? fromEnv : window.location.origin;
    setJoinUrl(`${base.replace(/\/$/, '')}/play`);
  }, []);

  // Track fullscreen state for the toggle UI.
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignored — some browsers reject without a user gesture */
    }
  }, []);

  // ===== Socket subscriptions =====
  useEffect(() => {
    if (!socket) return;
    socket.emit('presenter:join');

    const onState = (s: PublicGameState) => {
      setState(s);
      if (s.status !== 'ended') setEndedPayload(null);
    };
    const onLeaderboard = (entries: LeaderboardEntry[]) => setLeaderboard(entries);
    const onActivity = (ev: ActivityEvent) =>
      setActivity((cur) => [ev, ...cur].slice(0, MAX_ACTIVITY_EVENTS));
    const onCountdown = (p: { seconds: number }) => {
      setCountdown(p.seconds);
      playSound('tick');
    };
    const onStart = () => {
      setCountdown(null);
      playSound('victory');
    };
    const onEnded = (p: { winners: LeaderboardEntry[]; answer: string }) => {
      setEndedPayload(p);
      playSound('victory');
    };
    const onErr = (p: { code: string; message: string }) => {
      setErrorMsg(p.message);
      setTimeout(() => setErrorMsg(null), 4000);
    };

    socket.on('lobby:state', onState);
    socket.on('leaderboard:update', onLeaderboard);
    socket.on('activity', onActivity);
    socket.on('game:countdown', onCountdown);
    socket.on('game:start', onStart);
    socket.on('game:ended', onEnded);
    socket.on('error:message', onErr);

    return () => {
      socket.off('lobby:state', onState);
      socket.off('leaderboard:update', onLeaderboard);
      socket.off('activity', onActivity);
      socket.off('game:countdown', onCountdown);
      socket.off('game:start', onStart);
      socket.off('game:ended', onEnded);
      socket.off('error:message', onErr);
    };
  }, [socket]);

  const start = () => socket?.emit('presenter:start');
  const reset = () => {
    if (confirm('Reset the lobby? All players will need to wait for a new round.')) {
      socket?.emit('presenter:reset');
      setEndedPayload(null);
    }
  };
  const endNow = () => {
    if (confirm('End the game now?')) socket?.emit('presenter:end');
  };

  const status = state?.status ?? 'lobby';
  const players = state?.players ?? [];
  const winnersFromState = state?.winners ?? [];
  const winners = endedPayload?.winners ?? winnersFromState;
  const answer = endedPayload?.answer ?? state?.answer ?? null;

  return (
    <main className="min-h-dvh px-6 py-6 lg:px-10 lg:py-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-neon-cyan/80">
            Presenter Dashboard
          </p>
          <h1 className="bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta bg-clip-text text-4xl font-black text-transparent lg:text-5xl">
            Quick Mental Reset
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <span
            className={[
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
              connected
                ? 'border-neon-green/40 text-neon-green'
                : 'border-red-500/60 text-red-400',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-2 w-2 rounded-full',
                connected ? 'bg-neon-green animate-pulse' : 'bg-red-500',
              ].join(' ')}
            />
            {connected ? 'Connected' : 'Reconnecting…'}
          </span>
          <SoundToggle />
          <button onClick={toggleFullscreen} className="btn-ghost text-xs px-3 py-1.5">
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column: QR + controls */}
        <aside className="lg:col-span-4 space-y-6">
          <section className="card p-6">
            <h2 className="text-sm uppercase tracking-widest text-white/50">
              Scan to play
            </h2>
            <div className="mt-4">
              {joinUrl ? (
                <QRDisplay url={joinUrl} />
              ) : (
                <div className="h-64 animate-pulse rounded-xl bg-bg-700" />
              )}
            </div>
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm uppercase tracking-widest text-white/50">
                Players
              </h2>
              <p className="text-3xl font-black text-neon-green">
                {players.length}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {players.length === 0 && (
                <p className="text-sm text-white/40">Waiting for players to join…</p>
              )}
              {players.map((p) => (
                <motion.span
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-full border border-white/10 bg-bg-700 px-3 py-1 text-sm text-white/80"
                >
                  {p.name}
                </motion.span>
              ))}
            </div>
          </section>

          <section className="card p-6 space-y-3">
            <h2 className="text-sm uppercase tracking-widest text-white/50">
              Controls
            </h2>
            <button
              onClick={start}
              disabled={status !== 'lobby' || players.length === 0}
              className="btn-neon w-full text-base"
            >
              ▶ Start Game
            </button>
            <button
              onClick={endNow}
              disabled={status !== 'playing' && status !== 'countdown'}
              className="btn-neon-magenta w-full text-base"
            >
              ■ End Game
            </button>
            <button onClick={reset} className="btn-ghost w-full text-base">
              ↻ Reset Lobby
            </button>
          </section>
        </aside>

        {/* Middle column: leaderboard */}
        <section className="lg:col-span-5 card p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm uppercase tracking-widest text-white/50">
              Live Leaderboard
            </h2>
            <p className="text-xs text-white/40">
              Ranked by fastest solve · ties broken by fewest guesses
            </p>
          </div>
          <Leaderboard entries={leaderboard} />
        </section>

        {/* Right column: activity feed */}
        <section className="lg:col-span-3 card flex max-h-[36rem] flex-col p-6">
          <h2 className="mb-3 text-sm uppercase tracking-widest text-white/50">
            Activity Feed
          </h2>
          <ActivityFeed events={activity} />
        </section>
      </div>

      {/* Countdown overlay */}
      <AnimatePresence>
        {countdown !== null && status === 'countdown' && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-bg-900/85 backdrop-blur-sm"
          >
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              Game starts in
            </p>
            <motion.div
              key={countdown}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-4 text-[14rem] font-black leading-none text-neon-green drop-shadow-[0_0_40px_rgba(34,255,136,0.5)]"
            >
              {countdown > 0 ? countdown : 'GO'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ended / winners overlay */}
      <AnimatePresence>
        {status === 'ended' && (
          <motion.div
            key="ended"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-bg-900/92 px-6 py-12 backdrop-blur-sm"
          >
            <Confetti active />
            <motion.h2
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-12 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta bg-clip-text text-6xl font-black text-transparent"
            >
              We have winners! 🎉
            </motion.h2>
            <WinnerPodium winners={winners} answer={answer} />
            <div className="mt-12 flex gap-3">
              <button onClick={reset} className="btn-neon-cyan">
                Reset for next round
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function StatusBadge({ status }: { status: PublicGameState['status'] }) {
  const map: Record<PublicGameState['status'], { label: string; cls: string }> = {
    lobby: { label: 'Lobby open', cls: 'border-neon-cyan/40 text-neon-cyan' },
    countdown: { label: 'Starting…', cls: 'border-neon-yellow/40 text-neon-yellow' },
    playing: { label: 'In progress', cls: 'border-neon-green/40 text-neon-green' },
    ended: { label: 'Ended', cls: 'border-neon-magenta/40 text-neon-magenta' },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={[
        'rounded-full border px-3 py-1 text-xs uppercase tracking-widest',
        cls,
      ].join(' ')}
    >
      {label}
    </span>
  );
}
