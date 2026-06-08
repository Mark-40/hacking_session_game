import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import {
  Game,
  COUNTDOWN_SECONDS,
  MAX_ATTEMPTS,
  WORD_LENGTH,
  makeActivity,
} from './game';
import type {
  ClientToServerEvents,
  PlayerJoinError,
  ServerToClientEvents,
} from './types';

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN.split(',') }));
app.get('/healthz', (_req, res) => res.json({ ok: true, status: 'up' }));

const httpServer = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN.split(','),
    methods: ['GET', 'POST'],
  },
});

// Single global game. The MVP only supports one round at a time which matches
// the live-presentation use case.
const game = new Game();
const PRESENTER_ROOM = 'presenters';
const PLAYERS_ROOM = 'players';

const joinErrorMessages: Record<PlayerJoinError, string> = {
  'name-taken': 'That name is already taken — try another.',
  'name-invalid': 'Names must be 1–20 characters (letters, numbers, spaces).',
  'game-in-progress': 'A game is already in progress.',
  'session-conflict': 'You are already joined from another tab.',
  'lobby-closed': 'The lobby is closed — the game has already started.',
};

function broadcastLobbyState() {
  io.emit('lobby:state', game.toPublicState());
}

function broadcastLeaderboard() {
  io.emit('leaderboard:update', game.leaderboard());
}

io.on('connection', (socket) => {
  // Always push current state on connect so reconnecting clients hydrate fast.
  socket.emit('lobby:state', game.toPublicState());

  // -------- Presenter --------
  socket.on('presenter:join', () => {
    socket.join(PRESENTER_ROOM);
    socket.emit('lobby:state', game.toPublicState());
    socket.emit('leaderboard:update', game.leaderboard());
  });

  socket.on('presenter:start', () => {
    if (game.status !== 'lobby') return;
    if (game.publicPlayers().length === 0) {
      socket.emit('error:message', {
        code: 'no-players',
        message: 'Nobody has joined yet.',
      });
      return;
    }
    game.setCountdown();
    broadcastLobbyState();
    io.emit('activity', makeActivity('system', `Game starting in ${COUNTDOWN_SECONDS}…`));

    // Countdown ticks every second, then start.
    let remaining = COUNTDOWN_SECONDS;
    io.emit('game:countdown', { seconds: remaining });
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        io.emit('game:countdown', { seconds: remaining });
      } else {
        clearInterval(interval);
        const meta = game.start();
        io.emit('game:start', meta);
        broadcastLobbyState();
        broadcastLeaderboard();
        io.emit('activity', makeActivity('system', 'Go! The word is live.'));
      }
    }, 1000);
  });

  socket.on('presenter:reset', () => {
    game.reset();
    broadcastLobbyState();
    broadcastLeaderboard();
    io.emit('activity', makeActivity('system', 'Lobby reset by the presenter.'));
  });

  socket.on('presenter:end', () => {
    const { answer, winners } = game.end();
    broadcastLobbyState();
    broadcastLeaderboard();
    io.emit('game:ended', { winners, answer: answer ?? '' });
    io.emit('activity', makeActivity('system', 'Game ended by the presenter.'));
  });

  // -------- Player --------
  socket.on('player:join', (payload, ack) => {
    const sessionId = String(payload?.sessionId ?? '').trim();
    const name = String(payload?.name ?? '');
    if (!sessionId) {
      ack({ ok: false, code: 'session-conflict', message: 'Missing session id.' });
      return;
    }
    const res = game.addPlayer(sessionId, socket.id, name);
    if (!res.ok) {
      ack({
        ok: false,
        code: res.code,
        message: joinErrorMessages[res.code] ?? 'Could not join.',
      });
      return;
    }
    socket.join(PLAYERS_ROOM);
    socket.data.playerId = res.player.id;

    ack({ ok: true, playerId: res.player.id, state: game.toPublicState() });

    io.emit('player:joined', res.player);
    io.emit('activity', makeActivity('join', `${res.player.name} joined the game`));
    broadcastLobbyState();
    broadcastLeaderboard();
  });

  socket.on('player:guess', (payload, ack) => {
    const playerId = socket.data.playerId as string | undefined;
    if (!playerId) {
      ack({ ok: false, code: 'not-a-player', message: 'Join the lobby first.' });
      return;
    }
    const res = game.submitGuess(playerId, String(payload?.guess ?? ''));
    if (!res.ok) {
      const msg: Record<typeof res.code, string> = {
        'not-playing': 'No active game right now.',
        'already-solved': 'You already solved it!',
        'invalid-length': `Guess must be ${WORD_LENGTH} letters.`,
        'not-a-word': 'Not in the word list.',
        'no-attempts-left': `Max ${MAX_ATTEMPTS} attempts reached.`,
        'not-a-player': 'You are not in this game.',
      };
      ack({ ok: false, code: res.code, message: msg[res.code] });
      return;
    }

    ack({ ok: true, result: res.result });

    const player = game.findPlayerById(playerId);
    if (!player) return;

    io.emit('player:progress', {
      playerId,
      name: player.name,
      attempts: res.result.attempts,
      solved: res.result.solved,
    });

    if (res.result.solved && res.finishedPlacement) {
      io.emit('player:finished', {
        player: {
          id: player.id,
          name: player.name,
          attempts: player.attempts,
          solved: player.solved,
          placement: player.placement,
          finishedAt: player.finishedAt,
        },
        placement: res.finishedPlacement,
      });
      io.emit(
        'activity',
        makeActivity(
          'solve',
          `${player.name} solved it in ${player.attempts} ${player.attempts === 1 ? 'guess' : 'guesses'} (#${res.finishedPlacement})`,
        ),
      );
    } else {
      io.emit(
        'activity',
        makeActivity('progress', `${player.name} is on attempt ${res.result.attempts}`),
      );
    }

    broadcastLeaderboard();

    if (res.gameEndedNow) {
      const winners = game.topWinners();
      const answer = game.getAnswer() ?? '';
      io.emit('game:ended', { winners, answer });
      io.emit('activity', makeActivity('system', `Game over! The word was "${answer.toUpperCase()}".`));
      broadcastLobbyState();
    }
  });

  socket.on('disconnect', () => {
    const removed = game.removeBySocket(socket.id);
    if (removed) {
      io.emit('player:left', removed.id);
      io.emit('activity', makeActivity('system', `${removed.name} left the lobby`));
      broadcastLobbyState();
      broadcastLeaderboard();
    }
  });
});

httpServer.listen(PORT, () => {
  // Listening on all interfaces by default so phones on the LAN can connect.
  console.log(`[qmr-server] listening on http://localhost:${PORT}`);
  console.log(`[qmr-server] cors origin: ${CLIENT_ORIGIN}`);
});
