// Mirror of server/src/types.ts. Keep these in sync.

export type LetterState = 'correct' | 'present' | 'absent';

export type GameStatus = 'lobby' | 'countdown' | 'playing' | 'ended';

export interface PublicPlayer {
  id: string;
  name: string;
  attempts: number;
  solved: boolean;
  placement: number | null;
  finishedAt: number | null;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  attempts: number;
  solved: boolean;
  placement: number | null;
  finishedAt: number | null;
}

export interface PublicGameState {
  status: GameStatus;
  players: PublicPlayer[];
  startedAt: number | null;
  maxAttempts: number;
  wordLength: number;
  winners: LeaderboardEntry[];
  answer: string | null;
}

export interface GuessResult {
  guess: string;
  feedback: LetterState[];
  attempts: number;
  attemptsLeft: number;
  solved: boolean;
  outOfAttempts: boolean;
}

export interface ActivityEvent {
  id: string;
  message: string;
  timestamp: number;
  kind: 'join' | 'progress' | 'solve' | 'system';
}

export type PlayerJoinAck =
  | { ok: true; playerId: string; state: PublicGameState }
  | { ok: false; code: string; message: string };

export type PlayerGuessAck =
  | { ok: true; result: GuessResult }
  | { ok: false; code: string; message: string };
