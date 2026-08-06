'use client';

import React, { useEffect, useState } from 'react';
import { User, RefreshCw, Calendar, Store, AlertCircle, CheckSquare, MessageSquare } from 'lucide-react';

interface Requirement {
  id: string;
  createdAt: string;
  name: string;
  role: string;
  
  // V2 format
  version?: string;
  laundryType?: string;
  painPoints?: string[];
  features?: string[];
  notes?: string;

  // V1 format
  empathize?: string;
  define?: string;
  ideate?: string;
  prototype?: string;
}

export default function RequirementsResponses() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequirements = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requirements');
      if (res.ok) {
        const data = await res.json();
        // Sort descending by date
        setRequirements(data.sort((a: Requirement, b: Requirement) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      }
    } catch (error) {
      console.error('Failed to fetch requirements', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, []);

  if (loading) {
    return (
      <div className="h-screen overflow-y-auto bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-gray-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Hasil Survei Kasir Laundry
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Daftar tanggapan dari pemilik dan pengelola laundry
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <button
              onClick={fetchRequirements}
              className="inline-flex items-center px-5 py-2.5 rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Data
            </button>
          </div>
        </div>

        {requirements.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <Store className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada tanggapan</h3>
            <p className="mt-1 text-sm text-gray-500">
              Bagikan link form survei ke calon pengguna.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {requirements.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="bg-slate-800 px-6 py-4 flex justify-between items-start text-white">
                  <div className="flex items-start space-x-3">
                    <div className="bg-slate-700 p-2 rounded-full mt-1">
                      <User className="h-5 w-5 text-blue-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{req.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/30 text-blue-100 border border-blue-400/30">
                          {req.role || 'Tidak Disebutkan'}
                        </span>
                        {req.laundryType && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                            {req.laundryType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center text-xs text-slate-300">
                    <Calendar className="mr-1 h-3 w-3" />
                    {new Date(req.createdAt).toLocaleDateString('id-ID', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                
                <div className="p-6 flex-1 flex flex-col gap-6">
                  {req.version === 'v2' || req.laundryType ? (
                    <>
                      {/* V2 Format */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center mb-2 text-red-600 font-bold">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            <h4>Masalah Utama</h4>
                          </div>
                          {req.painPoints && req.painPoints.length > 0 ? (
                            <ul className="space-y-1.5">
                              {req.painPoints.map((pt, i) => (
                                <li key={i} className="text-sm text-gray-700 flex items-start">
                                  <span className="mr-2 mt-0.5">•</span>
                                  <span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Tidak ada masalah yang dipilih.</p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center mb-2 text-green-600 font-bold">
                            <CheckSquare className="h-4 w-4 mr-2" />
                            <h4>Fitur Harapan</h4>
                          </div>
                          {req.features && req.features.length > 0 ? (
                            <ul className="space-y-1.5">
                              {req.features.map((feat, i) => (
                                <li key={i} className="text-sm text-gray-700 flex items-start">
                                  <span className="mr-2 mt-0.5">•</span>
                                  <span>{feat}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Tidak ada fitur yang dipilih.</p>
                          )}
                        </div>

                        {req.notes && (
                          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mt-2">
                            <div className="flex items-center mb-1 text-blue-800 font-bold text-sm">
                              <MessageSquare className="h-4 w-4 mr-2" />
                              <h4>Catatan Tambahan</h4>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-line">{req.notes}</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* V1 Legacy Format */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded p-3 border border-gray-200">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Aktivitas & Masalah</h4>
                          <p className="text-sm text-gray-700">{req.empathize}</p>
                        </div>
                        <div className="bg-red-50 rounded p-3 border border-red-100">
                          <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Inti Masalah</h4>
                          <p className="text-sm text-gray-700">{req.define}</p>
                        </div>
                        <div className="bg-yellow-50 rounded p-3 border border-yellow-100">
                          <h4 className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-1">Ide Solusi</h4>
                          <p className="text-sm text-gray-700">{req.ideate}</p>
                        </div>
                        <div className="bg-green-50 rounded p-3 border border-green-100">
                          <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Ekspektasi (Prototype)</h4>
                          <p className="text-sm text-gray-700">{req.prototype}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
