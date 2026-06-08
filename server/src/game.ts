import { randomUUID } from 'crypto';
import { evaluateGuess } from './wordle';
import { isValidGuess, pickRandomAnswer } from './words';
import type {
  ActivityEvent,
  GameStatus,
  GuessResult,
  LeaderboardEntry,
  PublicGameState,
  PublicPlayer,
} from './types';

export const MAX_ATTEMPTS = 6;
export const WORD_LENGTH = 5;
export const WINNERS_TO_END = 3;
export const COUNTDOWN_SECONDS = 3;

interface Player {
  id: string;
  socketId: string;
  sessionId: string;
  name: string;
  attempts: number;
  solved: boolean;
  placement: number | null;
  finishedAt: number | null; // ms since game start, set when solved
  guesses: { word: string; feedback: ReturnType<typeof evaluateGuess> }[];
}

/**
 * The Game class owns all mutable state. Socket.IO event handlers are kept thin
 * and delegate every state change here so logic stays testable and the wire
 * protocol stays consistent.
 */
export class Game {
  status: GameStatus = 'lobby';
  private answer: string | null = null;
  private players = new Map<string, Player>(); // playerId → Player
  private sessionToPlayer = new Map<string, string>(); // sessionId → playerId
  startedAt: number | null = null;
  private winnersOrder: string[] = []; // playerIds in finish order

  // ===== read APIs =====

  toPublicState(): PublicGameState {
    return {
      status: this.status,
      players: this.publicPlayers(),
      startedAt: this.startedAt,
      maxAttempts: MAX_ATTEMPTS,
      wordLength: WORD_LENGTH,
      winners: this.leaderboard().filter((p) => p.solved).slice(0, WINNERS_TO_END),
      answer: this.status === 'ended' ? this.answer : null,
    };
  }

  publicPlayers(): PublicPlayer[] {
    return Array.from(this.players.values()).map(toPublicPlayer);
  }

  leaderboard(): LeaderboardEntry[] {
    // Solved players sorted by (finishedAt asc, attempts asc).
    // Then unfinished players by (attempts desc — more attempts = more progress).
    const all = Array.from(this.players.values());
    const solved = all
      .filter((p) => p.solved)
      .sort((a, b) => {
        const ta = a.finishedAt ?? Number.POSITIVE_INFINITY;
        const tb = b.finishedAt ?? Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
        return a.attempts - b.attempts;
      });
    const unsolved = all
      .filter((p) => !p.solved)
      .sort((a, b) => b.attempts - a.attempts);
    return [...solved, ...unsolved].map(toPublicPlayer);
  }

  // ===== mutations =====

  /** Add a player. Returns { ok: true, player } or an error code. */
  addPlayer(
    sessionId: string,
    socketId: string,
    rawName: string,
  ):
    | { ok: true; player: PublicPlayer }
    | { ok: false; code: 'name-invalid' | 'name-taken' | 'session-conflict' | 'lobby-closed' } {
    if (this.status !== 'lobby') {
      // Allow reconnection if the same session is already in the game and
      // still mid-play. Otherwise lobby is locked.
      const existing = this.sessionToPlayer.get(sessionId);
      if (existing && this.players.has(existing)) {
        const p = this.players.get(existing)!;
        p.socketId = socketId;
        return { ok: true, player: toPublicPlayer(p) };
      }
      return { ok: false, code: 'lobby-closed' };
    }

    const name = rawName.trim();
    if (name.length < 1 || name.length > 20) return { ok: false, code: 'name-invalid' };
    if (!/^[\p{L}\p{N} _.\-']+$/u.test(name)) return { ok: false, code: 'name-invalid' };

    const lower = name.toLowerCase();

    // Session reconnect path: same browser refreshing during lobby.
    const existingPlayerId = this.sessionToPlayer.get(sessionId);
    if (existingPlayerId && this.players.has(existingPlayerId)) {
      const existing = this.players.get(existingPlayerId)!;
      // Allow a rename only if the new name isn't taken by someone else.
      const takenBySomeoneElse = Array.from(this.players.values()).some(
        (p) => p.id !== existing.id && p.name.toLowerCase() === lower,
      );
      if (takenBySomeoneElse) return { ok: false, code: 'name-taken' };
      existing.name = name;
      existing.socketId = socketId;
      return { ok: true, player: toPublicPlayer(existing) };
    }

    // Brand-new player: duplicate-name check.
    const nameTaken = Array.from(this.players.values()).some(
      (p) => p.name.toLowerCase() === lower,
    );
    if (nameTaken) return { ok: false, code: 'name-taken' };

    const id = randomUUID();
    const player: Player = {
      id,
      socketId,
      sessionId,
      name,
      attempts: 0,
      solved: false,
      placement: null,
      finishedAt: null,
      guesses: [],
    };
    this.players.set(id, player);
    this.sessionToPlayer.set(sessionId, id);
    return { ok: true, player: toPublicPlayer(player) };
  }

  findPlayerBySocket(socketId: string): Player | undefined {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) return p;
    }
    return undefined;
  }

  findPlayerById(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  removeBySocket(socketId: string): PublicPlayer | null {
    // We only fully remove during the lobby phase. Once a game is running we
    // keep their record so the leaderboard remains coherent if they reconnect
    // (or if they don't, their progress is still visible).
    const p = this.findPlayerBySocket(socketId);
    if (!p) return null;
    if (this.status === 'lobby') {
      this.players.delete(p.id);
      this.sessionToPlayer.delete(p.sessionId);
      return toPublicPlayer(p);
    }
    // During play, just null out the socketId so guess events from a stale
    // socket can't sneak through. Their record stays.
    p.socketId = '';
    return null;
  }

  /** Begin the game. Picks a word and resets timing. */
  start(): { startedAt: number; maxAttempts: number; wordLength: number } {
    this.answer = pickRandomAnswer();
    this.status = 'playing';
    this.startedAt = Date.now();
    this.winnersOrder = [];
    // Reset any leftover state from a prior round (in case reset wasn't called).
    for (const p of this.players.values()) {
      p.attempts = 0;
      p.solved = false;
      p.placement = null;
      p.finishedAt = null;
      p.guesses = [];
    }
    return { startedAt: this.startedAt, maxAttempts: MAX_ATTEMPTS, wordLength: WORD_LENGTH };
  }

  setCountdown(): void {
    this.status = 'countdown';
  }

  /** Submit a guess. Returns the public result or an error. */
  submitGuess(
    playerId: string,
    rawGuess: string,
  ):
    | { ok: true; result: GuessResult; finishedPlacement?: number; gameEndedNow: boolean }
    | {
        ok: false;
        code:
          | 'not-playing'
          | 'already-solved'
          | 'invalid-length'
          | 'not-a-word'
          | 'no-attempts-left'
          | 'not-a-player';
      } {
    if (this.status !== 'playing' || !this.answer) return { ok: false, code: 'not-playing' };

    const player = this.players.get(playerId);
    if (!player) return { ok: false, code: 'not-a-player' };
    if (player.solved) return { ok: false, code: 'already-solved' };
    if (player.attempts >= MAX_ATTEMPTS) return { ok: false, code: 'no-attempts-left' };

    const guess = rawGuess.toLowerCase().trim();
    if (guess.length !== WORD_LENGTH || !/^[a-z]+$/.test(guess)) {
      return { ok: false, code: 'invalid-length' };
    }
    if (!isValidGuess(guess)) return { ok: false, code: 'not-a-word' };

    const feedback = evaluateGuess(guess, this.answer);
    player.attempts += 1;
    player.guesses.push({ word: guess, feedback });

    const solved = feedback.every((s) => s === 'correct');
    let finishedPlacement: number | undefined;
    let gameEndedNow = false;

    if (solved) {
      player.solved = true;
      player.finishedAt = Date.now() - (this.startedAt ?? Date.now());
      this.winnersOrder.push(player.id);
      player.placement = this.winnersOrder.length;
      finishedPlacement = player.placement;

      if (this.winnersOrder.length >= WINNERS_TO_END) {
        this.status = 'ended';
        gameEndedNow = true;
      }
    }

    const result: GuessResult = {
      guess,
      feedback,
      attempts: player.attempts,
      attemptsLeft: MAX_ATTEMPTS - player.attempts,
      solved,
      outOfAttempts: !solved && player.attempts >= MAX_ATTEMPTS,
    };
    return { ok: true, result, finishedPlacement, gameEndedNow };
  }

  /** End the game manually (presenter pressed End). */
  end(): { answer: string | null; winners: LeaderboardEntry[] } {
    this.status = 'ended';
    return { answer: this.answer, winners: this.topWinners() };
  }

  topWinners(): LeaderboardEntry[] {
    return this.leaderboard()
      .filter((p) => p.solved)
      .slice(0, WINNERS_TO_END);
  }

  getAnswer(): string | null {
    return this.answer;
  }

  /** Reset everything back to a fresh lobby. */
  reset(): void {
    this.status = 'lobby';
    this.answer = null;
    this.startedAt = null;
    this.winnersOrder = [];
    for (const p of this.players.values()) {
      p.attempts = 0;
      p.solved = false;
      p.placement = null;
      p.finishedAt = null;
      p.guesses = [];
    }
  }
}

function toPublicPlayer(p: Player): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    attempts: p.attempts,
    solved: p.solved,
    placement: p.placement,
    finishedAt: p.finishedAt,
  };
}

export function makeActivity(
  kind: ActivityEvent['kind'],
  message: string,
): ActivityEvent {
  return {
    id: randomUUID(),
    kind,
    message,
    timestamp: Date.now(),
  };
}
