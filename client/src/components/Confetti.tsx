'use client';

import { useEffect, useRef } from 'react';

interface Props {
  active: boolean;
  /** Particle count. Default 160. */
  count?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rot: number;
  vr: number;
  life: number;
}

const COLORS = ['#22ff88', '#00e4ff', '#ff39c2', '#ffd93d', '#9b6bff'];

/**
 * Lightweight canvas confetti. No dependency, runs ~6 seconds, then idles.
 * `active` retriggers the burst when it transitions false → true.
 */
export function Confetti({ active, count = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastActive = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ps = particlesRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]!;
        p.vy += 0.12; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        if (p.life <= 0 || p.y > canvas.height + 40) {
          ps.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Spawn new particles each time `active` flips on.
  useEffect(() => {
    if (active && !lastActive.current) {
      const ps = particlesRef.current;
      const w = window.innerWidth;
      for (let i = 0; i < count; i++) {
        ps.push({
          x: w / 2 + (Math.random() - 0.5) * w * 0.4,
          y: -20,
          vx: (Math.random() - 0.5) * 8,
          vy: Math.random() * 3 + 2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
          size: Math.random() * 8 + 6,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          life: 240,
        });
      }
    }
    lastActive.current = active;
  }, [active, count]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden
    />
  );
}
