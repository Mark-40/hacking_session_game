'use client';

import type { LetterState } from '@/shared/types';

interface Props {
  onKey: (key: string) => void;
  keyStates: Record<string, LetterState | undefined>;
  disabled?: boolean;
}

const ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['ENTER', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'BACK'],
];

const stateClass: Record<LetterState, string> = {
  correct: 'bg-tile-correct text-bg-900',
  present: 'bg-tile-present text-bg-900',
  absent: 'bg-tile-absent text-white/40',
};

export function Keyboard({ onKey, keyStates, disabled }: Props) {
  return (
    <div className="select-none px-1 pb-3">
      {ROWS.map((row, i) => (
        <div key={i} className="mb-1.5 flex justify-center gap-1">
          {row.map((k) => {
            const isSpecial = k === 'ENTER' || k === 'BACK';
            const state = !isSpecial ? keyStates[k] : undefined;
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => onKey(k)}
                className={[
                  'rounded-md font-semibold uppercase transition-colors',
                  isSpecial ? 'px-3 text-xs' : 'flex-1 max-w-[2.5rem] text-sm',
                  'h-12 sm:h-14',
                  state ? stateClass[state] : 'bg-white/10 text-white hover:bg-white/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                {k === 'BACK' ? '⌫' : k}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
