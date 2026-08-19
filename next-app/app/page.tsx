'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ENotaView from '@/components/ENotaView';
import CustomerLandingPage from '@/components/CustomerLandingPage';
import PosAppRoot from '@/components/PosAppRoot';
import { parseSessionToken, isSessionIdleExpired } from '@/lib/api';

function PageDispatcher() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const publicNotaParam = searchParams.get('nota');
  const publicNotaToken = searchParams.get('t');
  const sourceParam = searchParams.get('source');
  const [isPwaOrStaff, setIsPwaOrStaff] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Check if opened via PWA standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      sourceParam === 'pwa';

    // 2. Check if active staff session exists
    const payload = parseSessionToken();
    const hasValidSession = payload && !isSessionIdleExpired();

    if (isStandalone) {
      // PWA app directly opens POS terminal
      router.replace('/terminal-pos-internal?source=pwa');
      setIsPwaOrStaff(true);
    } else {
      setIsPwaOrStaff(false);
    }
  }, [sourceParam, router]);

  // If there's an E-Nota token or nota query, render E-Nota immediately without login flash
  if (publicNotaParam || publicNotaToken) {
    return (
      <ENotaView
        noNota={publicNotaParam || ''}
        token={publicNotaToken || undefined}
      />
    );
  }

  // If standalone PWA redirecting
  if (isPwaOrStaff === true) {
    return <PosAppRoot />;
  }

  // Otherwise render Public Customer Landing Page
  return <CustomerLandingPage />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0C1E20] flex flex-col items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mb-3" />
          <span className="text-xs font-semibold text-teal-300">Memuat Dua SiSi Laundry...</span>
        </div>
      }
    >
      <PageDispatcher />
    </Suspense>
  );
}
