'use client';

import { useEffect, useState } from 'react';
import { getMuted, setMuted } from '@/lib/sounds';

export function SoundToggle({ className }: { className?: string }) {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(getMuted());
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
      }}
      className={[
        'inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/30 hover:text-white',
        className ?? '',
      ].join(' ')}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
    >
      <span className="text-base">{muted ? '🔇' : '🔊'}</span>
      <span>{muted ? 'Muted' : 'Sound on'}</span>
    </button>
  );
}
