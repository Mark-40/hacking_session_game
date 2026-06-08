import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-3 text-xs uppercase tracking-[0.4em] text-neon-cyan/80">
        Live Word Challenge
      </p>
      <h1 className="bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta bg-clip-text text-5xl font-black leading-tight text-transparent sm:text-7xl">
        Quick Mental Reset
      </h1>
      <p className="mt-6 max-w-xl text-balance text-white/70">
        A real-time multiplayer Wordle for live presentations. Scan, join, and race to
        solve the same 5-letter word as everyone in the room.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/presenter" className="btn-neon">
          Open Presenter Dashboard
        </Link>
        <Link href="/play" className="btn-neon-cyan">
          Join as Player
        </Link>
      </div>

      <footer className="mt-16 text-xs text-white/30">
        Built for the internal hackathon · Tap the presenter link on your projector,
        the player link on a phone.
      </footer>
    </main>
  );
}
