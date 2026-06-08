'use client';

import { QRCodeSVG } from 'qrcode.react';

interface Props {
  url: string;
}

export function QRDisplay({ url }: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-white p-4 shadow-neon">
        <QRCodeSVG value={url} size={220} level="M" />
      </div>
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-white/40">Join URL</p>
        <p className="font-mono text-sm text-neon-cyan break-all">{url}</p>
      </div>
    </div>
  );
}
