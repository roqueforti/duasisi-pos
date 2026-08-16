'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

type DialogType = 'info' | 'success' | 'warning' | 'error';

interface DialogOptions {
  message: string;
  title?: string;
  type?: DialogType;
  isConfirm?: boolean;
  isPrompt?: boolean;
}

interface DialogContextProps {
  showAlert: (message: string, type?: DialogType, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
  showPrompt: (message: string, title?: string, defaultValue?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextProps | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({ message: '' });
  const [inputValue, setInputValue] = useState('');
  
  // Use references to store resolve functions
  const [resolveFn, setResolveFn] = useState<{ fn: (val: any) => void } | null>(null);

  const showAlert = useCallback((message: string, type: DialogType = 'info', title?: string) => {
    return new Promise<void>((resolve) => {
      setOptions({ message, type, title, isConfirm: false });
      setResolveFn({ fn: resolve });
      setIsOpen(true);
    });
  }, []);

  const showConfirm = useCallback((message: string, title?: string) => {
    return new Promise<boolean>((resolve) => {
      setOptions({ message, type: 'warning', title: title || 'Konfirmasi', isConfirm: true, isPrompt: false });
      setResolveFn({ fn: resolve });
      setIsOpen(true);
    });
  }, []);

  const showPrompt = useCallback((message: string, title?: string, defaultValue?: string) => {
    return new Promise<string | null>((resolve) => {
      setOptions({ message, type: 'info', title: title || 'Input Dibutuhkan', isConfirm: false, isPrompt: true });
      setInputValue(defaultValue || '');
      setResolveFn({ fn: resolve });
      setIsOpen(true);
    });
  }, []);

  const handleClose = (result: boolean) => {
    setIsOpen(false);
    if (resolveFn) {
      if (options.isPrompt) {
        resolveFn.fn(result ? inputValue : null);
      } else {
        resolveFn.fn(result);
      }
      setResolveFn(null);
    }
  };

  const getIcon = () => {
    switch (options.type) {
      case 'success': return <CheckCircle2 className="w-10 h-10 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-10 h-10 text-amber-500" />;
      case 'error': return <XCircle className="w-10 h-10 text-rose-500" />;
      default: return <Info className="w-10 h-10 text-blue-500" />;
    }
  };

  const getTitle = () => {
    if (options.title) return options.title;
    switch (options.type) {
      case 'success': return 'Berhasil';
      case 'warning': return 'Peringatan';
      case 'error': return 'Kesalahan';
      default: return 'Informasi';
    }
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-slate-50 rounded-full">
                {getIcon()}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">{getTitle()}</h3>
                <p className="text-sm text-slate-500 mt-2">{options.message}</p>
                {options.isPrompt && (
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full mt-4 px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#1E4648]"
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              {options.isConfirm || options.isPrompt ? (
                <>
                  <button
                    onClick={() => handleClose(false)}
                    className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => handleClose(true)}
                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-600/20"
                  >
                    {options.isPrompt ? 'Simpan' : 'Ya, Lanjutkan'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleClose(true)}
                  className="w-full px-4 py-2.5 text-sm font-bold text-white bg-[#1E4648] hover:bg-[#163536] rounded-xl transition shadow-md shadow-[#1E4648]/20"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
