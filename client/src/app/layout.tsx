import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SocketProvider } from '@/lib/socket';

export const metadata: Metadata = {
  title: 'Quick Mental Reset — Live Word Challenge',
  description:
    'A real-time multiplayer Wordle for live presentations. Scan, join, and race to solve the same word.',
};

export const viewport: Viewport = {
  themeColor: '#06070d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-display">
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}
