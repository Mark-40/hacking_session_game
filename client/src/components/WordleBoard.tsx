'use client';

import { motion } from 'framer-motion';
import type { LetterState } from '@/shared/types';

export interface BoardRow {
  letters: string[]; // length = wordLength, padded with '' for empty slots
  feedback: (LetterState | null)[]; // null = not yet evaluated
  submitted: boolean;
}

interface Props {
  rows: BoardRow[];
  wordLength: number;
  currentInput: string;
  invalidShake?: boolean;
}

const tileColor: Record<LetterState, string> = {
  correct: 'bg-tile-correct text-bg-900 border-tile-correct',
  present: 'bg-tile-present text-bg-900 border-tile-present',
  absent: 'bg-tile-absent text-white/70 border-tile-absent',
};

export function WordleBoard({ rows, wordLength, currentInput, invalidShake }: Props) {
  // Find the first non-submitted row to render the current input into.
  const activeRowIndex = rows.findIndex((r) => !r.submitted);

  return (
    <div className="mx-auto grid w-fit gap-1.5">
      {rows.map((row, rIdx) => {
        const isActiveRow = rIdx === activeRowIndex;
        const inputLetters = isActiveRow ? currentInput.split('') : [];
        return (
          <motion.div
            key={rIdx}
            className="flex gap-1.5"
            animate={isActiveRow && invalidShake ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {Array.from({ length: wordLength }).map((_, cIdx) => {
              const submittedLetter = row.letters[cIdx] ?? '';
              const state = row.feedback[cIdx];
              const showInput = isActiveRow && cIdx < inputLetters.length;
              const letter = showInput ? inputLetters[cIdx]! : submittedLetter;
              const filled = letter.length > 0;
              const submitted = row.submitted && state != null;
              return (
                <motion.div
                  key={cIdx}
                  initial={false}
                  animate={
                    submitted
                      ? { rotateX: [0, 90, 0], scale: [1, 1, 1] }
                      : filled
                        ? { scale: [1, 1.08, 1] }
                        : { scale: 1 }
                  }
                  transition={{
                    duration: submitted ? 0.5 : 0.15,
                    delay: submitted ? cIdx * 0.12 : 0,
                  }}
                  className={[
                    'flex h-14 w-14 items-center justify-center rounded-md border-2',
                    'text-2xl font-black uppercase select-none',
                    'sm:h-16 sm:w-16 sm:text-3xl',
                    submitted
                      ? tileColor[state!]
                      : filled
                        ? 'border-white/40 bg-tile-filled text-white'
                        : 'border-tile-border bg-tile-empty text-white/30',
                  ].join(' ')}
                >
                  {letter.toUpperCase()}
                </motion.div>
              );
            })}
          </motion.div>
        );
      })}
    </div>
  );
}
