'use client';

import React, { Suspense } from 'react';
import PosAppRoot from '@/components/PosAppRoot';

export default function TerminalPosInternalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-3" />
          <span className="text-xs font-semibold text-slate-400">Memuat Terminal Kasir Dua SiSi...</span>
        </div>
      }
    >
      <PosAppRoot />
    </Suspense>
  );
}
