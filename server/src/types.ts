// Shared event/payload types. The client mirrors this file so both ends agree on
// the wire format.

export type LetterState = 'correct' | 'present' | 'absent';

export type GameStatus = 'lobby' | 'countdown' | 'playing' | 'ended';

export interface PublicPlayer {
  id: string;
  name: string;
  attempts: number;
  solved: boolean;
  placement: number | null;
  finishedAt: number | null; // ms since game start
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
  // The answer is only revealed when the game has ended.
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

// === Client → Server ===
export interface ClientToServerEvents {
  'presenter:join': () => void;
  'presenter:start': () => void;
  'presenter:reset': () => void;
  'presenter:end': () => void;
  'player:join': (
    payload: { name: string; sessionId: string },
    ack: (response: PlayerJoinAck) => void
  ) => void;
  'player:guess': (
    payload: { guess: string },
    ack: (response: PlayerGuessAck) => void
  ) => void;
}

export type PlayerJoinAck =
  | { ok: true; playerId: string; state: PublicGameState }
  | { ok: false; code: PlayerJoinError; message: string };

export type PlayerJoinError =
  | 'name-taken'
  | 'name-invalid'
  | 'game-in-progress'
  | 'session-conflict'
  | 'lobby-closed';

export type PlayerGuessAck =
  | { ok: true; result: GuessResult }
  | { ok: false; code: GuessError; message: string };

export type GuessError =
  | 'not-playing'
  | 'already-solved'
  | 'invalid-length'
  | 'not-a-word'
  | 'no-attempts-left'
  | 'not-a-player';

// === Server → Client ===
export interface ServerToClientEvents {
  'lobby:state': (state: PublicGameState) => void;
  'player:joined': (player: PublicPlayer) => void;
  'player:left': (playerId: string) => void;
  'game:countdown': (payload: { seconds: number }) => void;
  'game:start': (payload: { startedAt: number; maxAttempts: number; wordLength: number }) => void;
  'player:progress': (payload: { playerId: string; name: string; attempts: number; solved: boolean }) => void;
  'player:finished': (payload: { player: PublicPlayer; placement: number }) => void;
  'leaderboard:update': (entries: LeaderboardEntry[]) => void;
  'activity': (event: ActivityEvent) => void;
  'game:ended': (payload: { winners: LeaderboardEntry[]; answer: string }) => void;
  'error:message': (payload: { code: string; message: string }) => void;
}
