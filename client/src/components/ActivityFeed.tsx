'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ActivityEvent } from '@/shared/types';

interface Props {
  events: ActivityEvent[];
}

const kindStyle: Record<ActivityEvent['kind'], string> = {
  join: 'border-neon-cyan/30 text-neon-cyan',
  progress: 'border-white/15 text-white/80',
  solve: 'border-neon-green/40 text-neon-green',
  system: 'border-neon-magenta/30 text-neon-magenta',
};

export function ActivityFeed({ events }: Props) {
  return (
    <div className="no-scrollbar flex h-full flex-col gap-2 overflow-y-auto">
      <AnimatePresence initial={false}>
        {events.map((e) => (
          <motion.div
            key={e.id}
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className={[
              'rounded-lg border-l-2 bg-bg-800/60 px-3 py-2 text-sm',
              kindStyle[e.kind],
            ].join(' ')}
          >
            {e.message}
          </motion.div>
        ))}
      </AnimatePresence>
      {events.length === 0 && (
        <p className="text-center text-sm text-white/30">
          Activity will show up here as players join and play.
        </p>
      )}
    </div>
  );
}
