'use client';

import { useEffect, useState } from 'react';
import { Download, X, Check } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIOSInstalled = (navigator as any).standalone === true;
    
    if (isStandalone || isIOSInstalled) {
      setIsInstalled(true);
      return;
    }

    // Check localStorage untuk user yang sudah dismiss
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      return;
    }

    // Listen untuk beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      // Tampilkan modal setelah 2 detik
      setTimeout(() => {
        setShowModal(true);
      }, 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Untuk iOS, tampilkan instruksi manual
    if (isIOS && !isIOSInstalled) {
      setTimeout(() => {
        setShowModal(true);
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowModal(false);
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowModal(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isInstalled || !showModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1E4648] to-[#11292B] p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur">
              <Download className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Install Dua SiSi POS</h3>
              <p className="text-sm text-white/80 mt-1">Akses lebih cepat & bisa offline</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#B5C9C9]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-[#1E4648] stroke-[3]" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Akses Instan</p>
                <p className="text-xs text-slate-500">Buka langsung dari home screen, tanpa browser</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#B5C9C9]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-[#1E4648] stroke-[3]" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Mode Offline</p>
                <p className="text-xs text-slate-500">Tetap bisa buka aplikasi walau koneksi terputus</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#B5C9C9]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3.5 h-3.5 text-[#1E4648] stroke-[3]" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">Performa Maksimal</p>
                <p className="text-xs text-slate-500">Loading lebih cepat dengan teknologi PWA</p>
              </div>
            </div>
          </div>

          {isIOS ? (
            // iOS Manual Instructions
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-blue-900 mb-2">Cara Install di iOS:</p>
              <ol className="space-y-1 text-blue-800 text-xs">
                <li>1. Tap tombol <strong>Share</strong> di Safari (icon kotak dengan panah)</li>
                <li>2. Scroll ke bawah, pilih <strong>&quot;Add to Home Screen&quot;</strong></li>
                <li>3. Tap <strong>&quot;Add&quot;</strong> di kanan atas</li>
              </ol>
            </div>
          ) : (
            // Android/Desktop Install Button
            <button
              onClick={handleInstall}
              className="w-full bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-3.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Download className="w-5 h-5" />
              Install Sekarang
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="w-full text-slate-500 hover:text-slate-700 text-sm font-medium py-2 transition"
          >
            Nanti Saja
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
