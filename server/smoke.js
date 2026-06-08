// End-to-end Socket.IO smoke test for qmr-server.
//
// We can't deterministically force a solve from the outside (the answer is
// random and only revealed on game:ended), so this script verifies the wire
// contract instead — every event handler, every error path, and the full state
// machine from lobby → countdown → playing → ended → lobby.

const { io } = require('socket.io-client');

const URL = 'http://localhost:4000';
const STEP_TIMEOUT_MS = 8_000;
const TOTAL_TIMEOUT_MS = 60_000;

const failures = [];
function assert(cond, msg) {
  if (!cond) {
    failures.push(msg);
    console.error('  ✗ ' + msg);
  } else {
    console.log('  ✓ ' + msg);
  }
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeSocket(label) {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  s.label = label;
  return s;
}

function nextEvent(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[${socket.label}] timed out waiting for ${name}`));
    }, STEP_TIMEOUT_MS);
    const handler = (...args) => {
      if (predicate(...args)) {
        clearTimeout(timer);
        socket.off(name, handler);
        resolve(args.length === 1 ? args[0] : args);
      }
    };
    socket.on(name, handler);
  });
}

function emitWithAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`ack timeout for ${event}`)), STEP_TIMEOUT_MS);
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

(async () => {
  const overall = setTimeout(() => {
    console.error('OVERALL TIMEOUT REACHED');
    process.exit(2);
  }, TOTAL_TIMEOUT_MS);

  console.log('▸ Connect presenter + 4 players to', URL);
  const presenter = makeSocket('presenter');
  const p1 = makeSocket('alice');
  const p2 = makeSocket('bob');
  const p3 = makeSocket('carol');
  const p4 = makeSocket('dave');
  const all = [presenter, p1, p2, p3, p4];
  await Promise.all(all.map((s) => new Promise((res) => s.once('connect', res))));
  console.log('  ✓ all five sockets connected\n');

  console.log('▸ Presenter announces itself');
  presenter.emit('presenter:join');
  const presenterState = await nextEvent(presenter, 'lobby:state');
  assert(presenterState.status === 'lobby', 'initial state is "lobby"');
  assert(presenterState.players.length === 0, 'initial lobby has 0 players');
  assert(presenterState.maxAttempts === 6, 'maxAttempts=6 in state');
  assert(presenterState.wordLength === 5, 'wordLength=5 in state');
  assert(presenterState.answer === null, 'answer hidden during lobby');

  console.log('\n▸ Player joins succeed');
  const ack1 = await emitWithAck(p1, 'player:join', { name: 'Alice', sessionId: 'sess-1' });
  const ack2 = await emitWithAck(p2, 'player:join', { name: 'Bob', sessionId: 'sess-2' });
  const ack3 = await emitWithAck(p3, 'player:join', { name: 'Carol', sessionId: 'sess-3' });
  const ack4 = await emitWithAck(p4, 'player:join', { name: 'Dave', sessionId: 'sess-4' });
  assert(ack1.ok && ack2.ok && ack3.ok && ack4.ok, 'all four joins succeeded');
  assert(new Set([ack1.playerId, ack2.playerId, ack3.playerId, ack4.playerId]).size === 4, 'distinct player ids');

  console.log('\n▸ Validation errors on join');
  const dup = await emitWithAck(p1, 'player:join', { name: 'Bob', sessionId: 'sess-DUP' });
  assert(!dup.ok && dup.code === 'name-taken', 'duplicate name rejected');

  const tooLong = await emitWithAck(p1, 'player:join', { name: 'x'.repeat(50), sessionId: 'sess-LONG' });
  assert(!tooLong.ok && tooLong.code === 'name-invalid', 'over-long name rejected');

  const empty = await emitWithAck(p1, 'player:join', { name: '   ', sessionId: 'sess-EMPTY' });
  assert(!empty.ok && empty.code === 'name-invalid', 'whitespace-only name rejected');

  console.log('\n▸ Same-session rejoin path');
  const rejoin = await emitWithAck(p1, 'player:join', { name: 'Alice', sessionId: 'sess-1' });
  assert(rejoin.ok, 'same session can re-emit join without conflict');

  console.log('\n▸ Roster broadcast to presenter');
  const rosterState = await nextEvent(presenter, 'lobby:state', (s) => s.players.length === 4);
  assert(rosterState.players.length === 4, 'presenter sees 4 players in roster');
  assert(rosterState.players.every((p) => p.attempts === 0 && !p.solved), 'all players start with 0 attempts');

  console.log('\n▸ Guessing before game start is rejected');
  const earlyGuess = await emitWithAck(p1, 'player:guess', { guess: 'apple' });
  assert(!earlyGuess.ok && earlyGuess.code === 'not-playing', 'guess in lobby rejected as not-playing');

  console.log('\n▸ Presenter starts the game (countdown)');
  const countdownPromise = nextEvent(presenter, 'game:countdown');
  presenter.emit('presenter:start');
  const cd = await countdownPromise;
  assert(typeof cd.seconds === 'number' && cd.seconds >= 1, 'received countdown tick');

  console.log('\n▸ Late-join during countdown is blocked');
  const late = makeSocket('late');
  await new Promise((res) => late.once('connect', res));
  const lateAck = await emitWithAck(late, 'player:join', { name: 'LateLarry', sessionId: 'sess-late' });
  assert(!lateAck.ok && lateAck.code === 'lobby-closed', 'late join blocked with lobby-closed');
  late.disconnect();

  console.log('\n▸ Wait for game:start');
  const startMeta = await nextEvent(presenter, 'game:start');
  assert(typeof startMeta.startedAt === 'number', 'game:start has startedAt');
  assert(startMeta.maxAttempts === 6, 'game:start.maxAttempts=6');
  assert(startMeta.wordLength === 5, 'game:start.wordLength=5');

  console.log('\n▸ Guess validation shapes');
  // Valid 5-letter dictionary word: should always come back ok with full feedback,
  // regardless of whether it happens to be the answer.
  const validGuess = await emitWithAck(p1, 'player:guess', { guess: 'crane' });
  assert(validGuess.ok, 'valid 5-letter guess accepted');
  assert(validGuess.ok && Array.isArray(validGuess.result.feedback), 'guess result has feedback array');
  assert(
    validGuess.ok && validGuess.result.feedback.length === 5 &&
      validGuess.result.feedback.every((f) => ['correct', 'present', 'absent'].includes(f)),
    'feedback is 5 LetterStates'
  );
  assert(validGuess.ok && validGuess.result.attempts === 1, 'attempts incremented to 1');
  assert(validGuess.ok && validGuess.result.attemptsLeft === 5, 'attemptsLeft=5');

  // Wrong length
  const shortGuess = await emitWithAck(p1, 'player:guess', { guess: 'cat' });
  assert(!shortGuess.ok && shortGuess.code === 'invalid-length', 'short guess rejected');

  // Non-alphabetic
  const symGuess = await emitWithAck(p1, 'player:guess', { guess: 'ab!cd' });
  assert(!symGuess.ok && symGuess.code === 'invalid-length', 'symbol guess rejected');

  // Not in dictionary
  const garbage = await emitWithAck(p1, 'player:guess', { guess: 'zzzzz' });
  assert(!garbage.ok && garbage.code === 'not-a-word', 'non-word rejected');

  console.log('\n▸ Activity events flow to presenter');
  const activityPromise = nextEvent(presenter, 'activity', (e) => e.kind === 'progress');
  await emitWithAck(p2, 'player:guess', { guess: 'slate' });
  const activity = await activityPromise;
  assert(typeof activity.message === 'string' && activity.message.length > 0, 'activity has message');
  assert(typeof activity.timestamp === 'number', 'activity has timestamp');

  console.log('\n▸ Leaderboard update event fires');
  const lbPromise = nextEvent(presenter, 'leaderboard:update');
  await emitWithAck(p3, 'player:guess', { guess: 'house' });
  const lb = await lbPromise;
  assert(Array.isArray(lb) && lb.length === 4, 'leaderboard has 4 entries');

  console.log('\n▸ Player:progress broadcast received by everyone');
  const progressPromise = nextEvent(p4, 'player:progress');
  await emitWithAck(p2, 'player:guess', { guess: 'about' });
  const prog = await progressPromise;
  assert(typeof prog.playerId === 'string' && typeof prog.name === 'string', 'progress has playerId/name');

  console.log('\n▸ Exhaust one player to 6 attempts (out-of-attempts path)');
  // Alice has already used 1 attempt above; use 5 more identical-shape valid words.
  const fillers = ['crane', 'slate', 'house', 'piano', 'world']; // 5 valid words
  let lastResult = null;
  for (const g of fillers) {
    const r = await emitWithAck(p1, 'player:guess', { guess: g });
    if (r.ok) lastResult = r.result;
    if (r.ok && r.result.solved) break;
  }
  if (lastResult && lastResult.solved) {
    console.log('  (Alice solved organically — skipping out-of-attempts assertion)');
  } else {
    const overflow = await emitWithAck(p1, 'player:guess', { guess: 'world' });
    assert(
      !overflow.ok && overflow.code === 'no-attempts-left',
      '7th guess rejected with no-attempts-left'
    );
  }

  console.log('\n▸ Presenter:end produces game:ended with answer');
  const endedPromise = new Promise((resolve) => presenter.once('game:ended', resolve));
  presenter.emit('presenter:end');
  const ended = await endedPromise;
  assert(typeof ended.answer === 'string' && ended.answer.length === 5, 'game:ended.answer is 5 letters: ' + ended.answer);
  assert(Array.isArray(ended.winners), 'game:ended.winners is an array');

  console.log('\n▸ Guess after end is rejected');
  const postEnd = await emitWithAck(p2, 'player:guess', { guess: 'crane' });
  assert(!postEnd.ok && postEnd.code === 'not-playing', 'guess after game end rejected');

  console.log('\n▸ Reset returns us to the lobby');
  const resetPromise = nextEvent(presenter, 'lobby:state', (s) => s.status === 'lobby');
  presenter.emit('presenter:reset');
  const lobbyAgain = await resetPromise;
  assert(lobbyAgain.status === 'lobby', 'status returns to "lobby" after reset');
  assert(lobbyAgain.answer === null, 'answer hidden again after reset');
  assert(lobbyAgain.players.every((p) => p.attempts === 0), 'player attempts cleared by reset');

  console.log('\n▸ After reset, can start a fresh round');
  const cd2Promise = nextEvent(presenter, 'game:countdown');
  presenter.emit('presenter:start');
  await cd2Promise;
  const start2 = await nextEvent(presenter, 'game:start');
  assert(typeof start2.startedAt === 'number', 'second game starts cleanly');
  presenter.emit('presenter:end');
  await nextEvent(presenter, 'game:ended');

  console.log('\n▸ Cleanup');
  all.forEach((s) => s.disconnect());
  clearTimeout(overall);

  if (failures.length) {
    console.error(`\n✖  ${failures.length} assertion(s) failed`);
    process.exit(1);
  }
  console.log('\n✔  All assertions passed.');
  process.exit(0);
})().catch((err) => {
  console.error('UNCAUGHT:', err);
  process.exit(2);
});
