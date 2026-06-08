'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { LeaderboardEntry } from '@/shared/types';
import { formatDuration, ordinal } from '@/lib/format';

interface Props {
  entries: LeaderboardEntry[];
}

export function Leaderboard({ entries }: Props) {
  return (
    <ol className="space-y-2">
      <AnimatePresence initial={false}>
        {entries.map((p, i) => {
          const rank = i + 1;
          const isPodium = p.solved && rank <= 3;
          const podiumColor =
            rank === 1
              ? 'border-neon-green shadow-neon'
              : rank === 2
                ? 'border-neon-cyan shadow-neon-cyan'
                : rank === 3
                  ? 'border-neon-magenta shadow-neon-magenta'
                  : 'border-white/5';
          return (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={[
                'flex items-center justify-between rounded-xl border bg-bg-800/60 px-4 py-3',
                isPodium ? podiumColor : 'border-white/5',
              ].join(' ')}
            >
              <div className="flex items-center gap-4">
                <span
                  className={[
                    'w-8 text-center font-mono text-lg font-bold',
                    rank === 1
                      ? 'text-neon-green'
                      : rank === 2
                        ? 'text-neon-cyan'
                        : rank === 3
                          ? 'text-neon-magenta'
                          : 'text-white/50',
                  ].join(' ')}
                >
                  {p.solved ? ordinal(rank) : '—'}
                </span>
                <span className="text-lg font-semibold">{p.name}</span>
                {p.solved && (
                  <span className="rounded-full bg-neon-green/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-neon-green">
                    solved
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    Time
                  </p>
                  <p className="font-mono text-neon-cyan">
                    {p.solved ? formatDuration(p.finishedAt) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    Guesses
                  </p>
                  <p className="font-mono">{p.attempts}</p>
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
      {entries.length === 0 && (
        <li className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-white/40">
          No players yet — share the QR code to fill the lobby.
        </li>
      )}
    </ol>
  );
}
