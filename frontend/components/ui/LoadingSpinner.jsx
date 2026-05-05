'use client';

import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 32, text = 'Loading...', fullScreen = false }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 size={size} className="animate-spin text-[#a1a1aa]" />
      {text && <p className="text-[#71717a] text-sm">{text}</p>}
    </div>
  );
  if (fullScreen) {
    return <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">{content}</div>;
  }
  return content;
}
