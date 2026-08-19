'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ENotaView from '@/components/ENotaView';

function ENotaContent() {
  const searchParams = useSearchParams();
  const noNota = searchParams.get('nota') || '';
  const token = searchParams.get('t') || undefined;

  return (
    <ENotaView
      noNota={noNota}
      token={token}
      onBackToApp={() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }}
    />
  );
}

export default function StandaloneENotaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E4648]" />
      </div>
    }>
      <ENotaContent />
    </Suspense>
  );
}
