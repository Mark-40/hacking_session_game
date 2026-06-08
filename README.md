# Quick Mental Reset — Live Word Challenge

A real-time multiplayer Wordle game built for live company presentations. Audience
members scan a QR code on their phones, join the lobby, and race to solve the same
5-letter word. The presenter dashboard shows a live leaderboard, activity feed, and
auto-celebrates the top-3 winners with confetti.

---

## Tech stack

| Layer    | Stack                                                                  |
|----------|------------------------------------------------------------------------|
| Frontend | Next.js (App Router) · TypeScript · TailwindCSS · Framer Motion · Socket.IO Client |
| Backend  | Node.js · Express · Socket.IO Server · TypeScript                      |
| State    | In-memory (single global game)                                         |

---

## Quick start

### 1. Install dependencies

```bash
npm run install:all
```

This installs the root, `server/`, and `client/` workspaces.

### 2. Configure environment

The defaults work for local dev. To customize:

```bash
# server/.env (optional)
PORT=4000
CLIENT_ORIGIN=http://localhost:3000

# client/.env.local (optional)
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_PUBLIC_URL=http://<your-lan-ip>:3000
```

> **For live presentations:** set `NEXT_PUBLIC_PUBLIC_URL` to the LAN address that
> phones can reach (e.g. `http://192.168.1.42:3000`). That value is what the QR
> code encodes — `localhost` will not work from a phone.

### 3. Run in dev mode

```bash
npm run dev
```

- Presenter dashboard → http://localhost:3000/presenter
- Player join screen  → http://localhost:3000/play

### 4. Build for production

```bash
npm run build
npm start
```

---

## Live presentation checklist

1. Connect your laptop and audience phones to the same Wi-Fi network.
2. Find your laptop's LAN IP (`ipconfig` on Windows, `ifconfig`/`ip a` on macOS/Linux).
3. Set `NEXT_PUBLIC_PUBLIC_URL=http://<lan-ip>:3000` in `client/.env.local`.
4. Run `npm run dev`.
5. Open http://localhost:3000/presenter on the projector.
6. Audience scans the QR → enters name → joins lobby.
7. Click **Start Game** — everyone gets the same word simultaneously.
8. First 3 to solve are crowned. Confetti fires automatically.

---

## Architecture

```
Hacking_Session/
├── server/           # Express + Socket.IO backend
│   └── src/
│       ├── index.ts      # Server entry, Socket.IO wiring
│       ├── game.ts       # Game state machine, ranking
│       ├── wordle.ts     # Guess evaluation logic
│       ├── words.ts      # Word lists (answers + valid guesses)
│       └── types.ts      # Shared event/payload types
└── client/           # Next.js App Router frontend
    └── src/
        ├── app/
        │   ├── page.tsx            # Landing
        │   ├── presenter/page.tsx  # Presenter dashboard
        │   └── play/page.tsx       # Player flow
        ├── components/             # Board, keyboard, leaderboard, etc.
        ├── lib/
        │   ├── socket.tsx          # Socket.IO React context
        │   └── sounds.ts           # WebAudio sound effects
        └── shared/types.ts         # Same shape as server/types.ts
```

### Socket.IO events

| Event                    | Direction | Payload                                       |
|--------------------------|-----------|-----------------------------------------------|
| `presenter:join`         | C → S     | —                                             |
| `presenter:start`        | C → S     | —                                             |
| `presenter:reset`        | C → S     | —                                             |
| `presenter:end`          | C → S     | —                                             |
| `player:join`            | C → S     | `{ name, sessionId }`                         |
| `player:guess`           | C → S     | `{ guess }`                                   |
| `lobby:state`            | S → C     | full `GameState` snapshot                     |
| `player:joined`          | S → C     | `{ player }`                                  |
| `game:countdown`         | S → C     | `{ seconds }`                                 |
| `game:start`             | S → C     | `{ startedAt, maxAttempts }`                  |
| `guess:result`           | S → C     | `{ guess, feedback, attempts, solved }`       |
| `player:progress`        | S → C     | `{ playerId, attempts, solved }`              |
| `player:finished`        | S → C     | `{ player, placement }`                       |
| `leaderboard:update`     | S → C     | `Leaderboard[]`                               |
| `activity`               | S → C     | `{ message, timestamp }`                      |
| `game:ended`             | S → C     | `{ winners, word }`                           |
| `error`                  | S → C     | `{ code, message }`                           |

---

## Deployment recommendations

The simplest split that keeps Socket.IO sticky:

- **Backend** → Render / Railway / Fly.io single instance (Socket.IO needs sticky
  sessions; a single dyno is easiest for an MVP).
- **Frontend** → Vercel. Set `NEXT_PUBLIC_SOCKET_URL` to the backend's public HTTPS
  URL and `NEXT_PUBLIC_PUBLIC_URL` to the Vercel deployment URL.

For an internal hackathon demo, running both locally on a laptop on the conference
Wi-Fi is usually the smoothest option — no cold starts, no rate limits.

---

## Anti-cheat & guardrails (MVP-level)

- One session per player via `localStorage`-stored UUID.
- Duplicate names rejected case-insensitively.
- Lobby locked once `presenter:start` fires — late joiners are bounced.
- Players cannot replay after finishing (board is locked).
- Word/answer never leaves the server until game start; guesses are evaluated
  server-side, so clients cannot fake a solve.
