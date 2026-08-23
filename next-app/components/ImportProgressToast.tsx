'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X, CheckCircle2, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';

interface ImportProgressToastProps {
  isOpen: boolean;
  title?: string;
  fileName?: string;
  statusText?: string;
  progressPercent?: number;
  isComplete?: boolean;
  isError?: boolean;
  onClose?: () => void;
}

export default function ImportProgressToast({
  isOpen,
  title = 'Mengimpor Data',
  fileName = 'file.csv',
  statusText = 'Sedang memproses...',
  progressPercent = 0,
  isComplete = false,
  isError = false,
  onClose
}: ImportProgressToastProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-88 bg-white rounded-xl shadow-2xl border border-slate-200/90 overflow-hidden font-sans animate-in slide-in-from-bottom-5 duration-200">
      {/* Header bar styled like Google Drive */}
      <div className="bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-2 min-w-0">
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : isError ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-teal-300 animate-spin shrink-0" />
          )}
          <span className="text-xs font-bold truncate">
            {isComplete ? 'Import Selesai' : isError ? 'Import Gagal' : title}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white transition cursor-pointer"
            title={isMinimized ? 'Perbesar' : 'Kecilkan'}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-300 hover:text-white transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body content */}
      {!isMinimized && (
        <div className="p-3.5 space-y-2.5 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#1E4648] border border-teal-100 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{fileName}</p>
              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{statusText}</p>
            </div>
            {isComplete ? (
              <span className="text-[11px] font-bold text-emerald-600 shrink-0">100%</span>
            ) : isError ? (
              <span className="text-[11px] font-bold text-rose-600 shrink-0">Gagal</span>
            ) : (
              <span className="text-[11px] font-bold text-[#1E4648] shrink-0 font-mono">
                {Math.round(progressPercent || 0)}%
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isComplete
                  ? 'bg-emerald-500'
                  : isError
                  ? 'bg-rose-500'
                  : 'bg-[#1E4648]'
              }`}
              style={{
                width: isComplete ? '100%' : `${Math.max(5, Math.min(100, progressPercent || 0))}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
