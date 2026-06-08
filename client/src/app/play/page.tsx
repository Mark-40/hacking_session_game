'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getSessionId, useSocket } from '@/lib/socket';
import { playSound } from '@/lib/sounds';
import { WordleBoard, type BoardRow } from '@/components/WordleBoard';
import { Keyboard } from '@/components/Keyboard';
import { Confetti } from '@/components/Confetti';
import { SoundToggle } from '@/components/SoundToggle';
import { formatDuration, ordinal } from '@/lib/format';
import type {
  GuessResult,
  LetterState,
  PlayerGuessAck,
  PlayerJoinAck,
  PublicGameState,
} from '@/shared/types';

type Phase = 'join' | 'lobby' | 'countdown' | 'playing' | 'finished';

interface FinishedInfo {
  placement: number;
  attempts: number;
  durationMs: number;
}

function makeEmptyRows(rowCount: number, wordLength: number): BoardRow[] {
  return Array.from({ length: rowCount }, () => ({
    letters: Array(wordLength).fill(''),
    feedback: Array(wordLength).fill(null) as (LetterState | null)[],
    submitted: false,
  }));
}

export default function PlayPage() {
  const { socket, connected } = useSocket();
  const [phase, setPhase] = useState<Phase>('join');
  const [name, setName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [state, setState] = useState<PublicGameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Game state
  const [rows, setRows] = useState<BoardRow[]>(makeEmptyRows(6, 5));
  const [input, setInput] = useState('');
  const [keyStates, setKeyStates] = useState<Record<string, LetterState | undefined>>({});
  const [invalidShake, setInvalidShake] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [finished, setFinished] = useState<FinishedInfo | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const startedAtRef = useRef<number | null>(null);
  const [outOfAttempts, setOutOfAttempts] = useState(false);

  // ===== Subscribe to socket events =====
  useEffect(() => {
    if (!socket) return;

    const onLobbyState = (s: PublicGameState) => {
      setState(s);
      // Resize board if word length / attempts differ
      setRows((prev) =>
        prev.length === s.maxAttempts && prev[0]?.letters.length === s.wordLength
          ? prev
          : makeEmptyRows(s.maxAttempts, s.wordLength),
      );
      // Bring already-joined players back to lobby UI when the host resets.
      if (s.status === 'lobby' && playerId) {
        setPhase((cur) => (cur === 'finished' || cur === 'playing' || cur === 'countdown' ? 'lobby' : cur));
        setRows(makeEmptyRows(s.maxAttempts, s.wordLength));
        setInput('');
        setKeyStates({});
        setFinished(null);
        setStatusMessage(null);
        setOutOfAttempts(false);
        startedAtRef.current = null;
        setElapsed(0);
      }
    };

    const onCountdown = (p: { seconds: number }) => {
      setCountdown(p.seconds);
      if (playerId) setPhase('countdown');
      playSound('tick');
    };

    const onStart = (p: { startedAt: number; maxAttempts: number; wordLength: number }) => {
      startedAtRef.current = p.startedAt;
      setRows(makeEmptyRows(p.maxAttempts, p.wordLength));
      setInput('');
      setKeyStates({});
      setStatusMessage(null);
      setFinished(null);
      setOutOfAttempts(false);
      setCountdown(null);
      if (playerId) setPhase('playing');
    };

    const onGameEnded = (p: { winners: { id: string; name: string; placement: number | null }[]; answer: string }) => {
      // If we didn't finish, still surface the answer & ranking.
      setStatusMessage((cur) =>
        cur ?? `Game over. The word was "${p.answer.toUpperCase()}".`,
      );
      if (playerId) {
        // Update phase only if we're not already in finished
        setPhase((cur) => (cur === 'finished' ? cur : 'playing'));
      }
    };

    socket.on('lobby:state', onLobbyState);
    socket.on('game:countdown', onCountdown);
    socket.on('game:start', onStart);
    socket.on('game:ended', onGameEnded);

    return () => {
      socket.off('lobby:state', onLobbyState);
      socket.off('game:countdown', onCountdown);
      socket.off('game:start', onStart);
      socket.off('game:ended', onGameEnded);
    };
  }, [socket, playerId]);

  // Ticking elapsed time for the live timer.
  useEffect(() => {
    if (phase !== 'playing' || finished) return;
    const id = setInterval(() => {
      if (startedAtRef.current) setElapsed(Date.now() - startedAtRef.current);
    }, 100);
    return () => clearInterval(id);
  }, [phase, finished]);

  // ===== Actions =====
  const submitJoin = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!socket) return;
      const cleanName = name.trim();
      if (cleanName.length < 1) {
        setJoinError('Please enter a name.');
        return;
      }
      setJoining(true);
      setJoinError(null);
      socket.emit(
        'player:join',
        { name: cleanName, sessionId: getSessionId() },
        (ack: PlayerJoinAck) => {
          setJoining(false);
          if (!ack.ok) {
            setJoinError(ack.message);
            return;
          }
          setPlayerId(ack.playerId);
          setState(ack.state);
          if (ack.state.status === 'lobby') setPhase('lobby');
          else if (ack.state.status === 'countdown') setPhase('countdown');
          else if (ack.state.status === 'playing') setPhase('playing');
          else setPhase('lobby');
        },
      );
    },
    [socket, name],
  );

  const applyGuessResult = useCallback(
    (guess: string, r: GuessResult) => {
      setRows((prev) => {
        const next = prev.map((row) => ({ ...row }));
        const idx = next.findIndex((row) => !row.submitted);
        if (idx === -1) return prev;
        next[idx] = {
          letters: guess.split(''),
          feedback: r.feedback as LetterState[],
          submitted: true,
        };
        return next;
      });

      setKeyStates((prev) => {
        const next = { ...prev };
        guess.split('').forEach((ch, i) => {
          const fb = r.feedback[i];
          if (!fb) return;
          // Priority: correct > present > absent
          const cur = next[ch];
          if (cur === 'correct') return;
          if (cur === 'present' && fb === 'absent') return;
          next[ch] = fb;
        });
        return next;
      });

      setInput('');

      if (r.solved) {
        playSound('victory');
      } else if (r.outOfAttempts) {
        playSound('wrong');
        setOutOfAttempts(true);
        setStatusMessage('Out of guesses. Good luck next round!');
      } else {
        playSound('correct'); // a soft confirm for any non-failing guess
      }
    },
    [],
  );

  const submitGuess = useCallback(() => {
    if (!socket) return;
    if (phase !== 'playing' || finished) return;
    if (input.length !== (state?.wordLength ?? 5)) {
      setInvalidShake(true);
      setStatusMessage(`Need ${state?.wordLength ?? 5} letters.`);
      setTimeout(() => setInvalidShake(false), 450);
      return;
    }
    const guess = input.toLowerCase();
    socket.emit('player:guess', { guess }, (ack: PlayerGuessAck) => {
      if (!ack.ok) {
        setInvalidShake(true);
        setStatusMessage(ack.message);
        playSound('wrong');
        setTimeout(() => setInvalidShake(false), 450);
        return;
      }
      setStatusMessage(null);
      applyGuessResult(guess, ack.result);
      if (ack.result.solved && startedAtRef.current) {
        const duration = Date.now() - startedAtRef.current;
        // Placement comes via `player:finished` for everyone, but for self we
        // can pre-fill from the current state once the server broadcasts it.
      }
    });
  }, [socket, phase, finished, input, state, applyGuessResult]);

  // Listen for our own finish broadcast to lock the board and show the placement screen.
  useEffect(() => {
    if (!socket) return;
    const onFinished = (p: { player: { id: string; attempts: number; finishedAt: number | null }; placement: number }) => {
      if (!playerId || p.player.id !== playerId) return;
      setFinished({
        placement: p.placement,
        attempts: p.player.attempts,
        durationMs: p.player.finishedAt ?? 0,
      });
      setPhase('finished');
    };
    socket.on('player:finished', onFinished);
    return () => {
      socket.off('player:finished', onFinished);
    };
  }, [socket, playerId]);

  // Keyboard input (physical + on-screen)
  const handleKey = useCallback(
    (key: string) => {
      if (phase !== 'playing' || finished || outOfAttempts) return;
      const wl = state?.wordLength ?? 5;
      if (key === 'ENTER') {
        submitGuess();
        return;
      }
      if (key === 'BACK') {
        setInput((s) => s.slice(0, -1));
        return;
      }
      if (/^[a-z]$/i.test(key) && input.length < wl) {
        setInput((s) => (s + key).toLowerCase());
      }
    },
    [phase, finished, outOfAttempts, state, input, submitGuess],
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        handleKey('ENTER');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKey('BACK');
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKey(e.key.toLowerCase());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, handleKey]);

  const playerCount = state?.players.length ?? 0;
  const wordLength = state?.wordLength ?? 5;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-neon-cyan/70">
            Live Word Challenge
          </p>
          <h1 className="text-lg font-bold">Quick Mental Reset</h1>
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <span
            className={[
              'inline-block h-2 w-2 rounded-full',
              connected ? 'bg-neon-green shadow-neon' : 'bg-red-500',
            ].join(' ')}
            title={connected ? 'Connected' : 'Disconnected'}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {phase === 'join' && (
          <motion.section
            key="join"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-1 flex-col justify-center"
          >
            <div className="card p-6">
              <h2 className="text-2xl font-bold">Join the game</h2>
              <p className="mt-1 text-sm text-white/60">
                Pick a name your team will recognize on the leaderboard.
              </p>
              <form onSubmit={submitJoin} className="mt-6 space-y-3">
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={20}
                  className="w-full rounded-xl border border-white/10 bg-bg-700 px-4 py-3 text-lg outline-none focus:border-neon-green focus:shadow-neon"
                />
                {joinError && (
                  <p className="text-sm text-red-400">{joinError}</p>
                )}
                <button
                  type="submit"
                  disabled={joining || !connected}
                  className="btn-neon w-full text-lg"
                >
                  {!connected ? 'Connecting…' : joining ? 'Joining…' : 'Join Game'}
                </button>
              </form>
            </div>
          </motion.section>
        )}

        {phase === 'lobby' && (
          <motion.section
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center text-center"
          >
            <div className="card flex w-full flex-col items-center px-6 py-10">
              <div className="relative mb-6 h-16 w-16">
                <div className="absolute inset-0 animate-pulse-soft rounded-full border-4 border-neon-cyan/40" />
                <div className="absolute inset-2 animate-pulse-soft rounded-full border-4 border-neon-green/40" />
                <div className="absolute inset-4 animate-pulse-soft rounded-full border-4 border-neon-magenta/40" />
              </div>
              <h2 className="text-2xl font-bold">Waiting for the host…</h2>
              <p className="mt-2 text-sm text-white/60">
                You're in. The game will start when the presenter hits Start.
              </p>
              <p className="mt-6 text-xs uppercase tracking-widest text-white/40">
                Players in lobby
              </p>
              <p className="text-4xl font-black text-neon-green">{playerCount}</p>
            </div>
          </motion.section>
        )}

        {phase === 'countdown' && (
          <motion.section
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">Get ready</p>
            <motion.div
              key={countdown ?? 'go'}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-4 text-[10rem] font-black leading-none text-neon-green drop-shadow-[0_0_30px_rgba(34,255,136,0.5)]"
            >
              {countdown && countdown > 0 ? countdown : 'GO'}
            </motion.div>
          </motion.section>
        )}

        {phase === 'playing' && (
          <motion.section
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col"
          >
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-white/50">
                Players: <span className="text-white">{playerCount}</span>
              </span>
              <span className="rounded-full bg-bg-700 px-3 py-1 font-mono text-neon-cyan">
                {formatDuration(elapsed)}
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-center">
              <WordleBoard
                rows={rows}
                wordLength={wordLength}
                currentInput={input}
                invalidShake={invalidShake}
              />
              {statusMessage && (
                <p className="mt-3 text-center text-sm text-neon-magenta">
                  {statusMessage}
                </p>
              )}
            </div>

            <div className="mt-4">
              <Keyboard
                onKey={handleKey}
                keyStates={keyStates}
                disabled={outOfAttempts}
              />
            </div>
          </motion.section>
        )}

        {phase === 'finished' && finished && (
          <motion.section
            key="finished"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 flex-col items-center justify-center text-center"
          >
            <Confetti active />
            <p className="text-sm uppercase tracking-[0.4em] text-neon-cyan/80">
              Solved!
            </p>
            <p className="mt-4 text-7xl font-black text-neon-green drop-shadow-[0_0_30px_rgba(34,255,136,0.5)]">
              {ordinal(finished.placement)}
            </p>
            <p className="mt-1 text-sm text-white/60">place</p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="card px-6 py-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40">
                  Time
                </p>
                <p className="font-mono text-2xl text-neon-cyan">
                  {formatDuration(finished.durationMs)}
                </p>
              </div>
              <div className="card px-6 py-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40">
                  Guesses
                </p>
                <p className="font-mono text-2xl text-neon-magenta">
                  {finished.attempts}
                </p>
              </div>
            </div>

            <p className="mt-8 text-sm text-white/50">
              Stick around — winners will be announced on the big screen!
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
