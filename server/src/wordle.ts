import type { LetterState } from './types';

/**
 * Evaluate a guess against a target word using standard Wordle rules:
 *
 * 1. First pass marks letters in the correct position as `correct` and removes
 *    them from the pool of "remaining" target letters.
 * 2. Second pass marks any remaining guess letter that still appears in the
 *    leftover pool as `present`, decrementing the pool so duplicate letters
 *    behave correctly (e.g. guessing "SPEED" against "ABIDE" gives only one
 *    yellow on the E).
 *
 * Both inputs are expected to be lowercased 5-letter strings. Returns an array
 * of LetterState of the same length as the guess.
 */
export function evaluateGuess(guess: string, answer: string): LetterState[] {
  if (guess.length !== answer.length) {
    throw new Error(`evaluateGuess: length mismatch (${guess.length} vs ${answer.length})`);
  }

  const result: LetterState[] = new Array(guess.length).fill('absent');
  const remaining: Record<string, number> = {};

  // Pass 1: mark exact matches and tally non-matched answer letters.
  for (let i = 0; i < guess.length; i++) {
    const g = guess[i]!;
    const a = answer[i]!;
    if (g === a) {
      result[i] = 'correct';
    } else {
      remaining[a] = (remaining[a] ?? 0) + 1;
    }
  }

  // Pass 2: mark presents only if the letter is still in the leftover pool.
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    const g = guess[i]!;
    if ((remaining[g] ?? 0) > 0) {
      result[i] = 'present';
      remaining[g] = remaining[g]! - 1;
    }
  }

  return result;
}
