'use client';

import { motion } from 'framer-motion';
import type { LeaderboardEntry } from '@/shared/types';
import { formatDuration } from '@/lib/format';

interface Props {
  winners: LeaderboardEntry[];
  answer: string | null;
}

/** Big "winner card" layout used inside the presenter celebration overlay. */
export function WinnerPodium({ winners, answer }: Props) {
  // Reorder so 1st is centered, 2nd left, 3rd right (classic podium layout)
  const [first, second, third] = [winners[0], winners[1], winners[2]];
  const ordered = [second, first, third];
  const heights = ['h-44', 'h-56', 'h-36'];
  const accent = [
    'border-neon-cyan shadow-neon-cyan',
    'border-neon-green shadow-neon',
    'border-neon-magenta shadow-neon-magenta',
  ];
  const place = ['2nd', '1st', '3rd'];
  const placeColor = ['text-neon-cyan', 'text-neon-green', 'text-neon-magenta'];

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {answer && (
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">
            The word was
          </p>
          <p className="mt-2 font-mono text-5xl font-black text-white tracking-[0.3em]">
            {answer.toUpperCase()}
          </p>
        </div>
      )}
      <div className="flex w-full max-w-4xl items-end justify-center gap-6">
        {ordered.map((p, i) => (
          <motion.div
            key={p?.id ?? `slot-${i}`}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.18, type: 'spring', stiffness: 200, damping: 22 }}
            className={[
              'flex w-1/3 max-w-[18rem] flex-col items-center justify-end rounded-2xl border-2 bg-bg-800/80 p-6 text-center',
              heights[i],
              p ? accent[i] : 'border-white/10',
            ].join(' ')}
          >
            <p
              className={[
                'text-xs uppercase tracking-[0.3em]',
                p ? placeColor[i] : 'text-white/30',
              ].join(' ')}
            >
              {place[i]}
            </p>
            <p className="mt-2 truncate text-2xl font-black">
              {p?.name ?? '—'}
            </p>
            {p && (
              <div className="mt-3 flex gap-4 text-sm text-white/70">
                <span className="font-mono">{formatDuration(p.finishedAt)}</span>
                <span className="text-white/40">·</span>
                <span className="font-mono">{p.attempts} guesses</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
