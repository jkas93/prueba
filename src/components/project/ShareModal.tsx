'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/hooks/useFirebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

interface ShareModalProps {
  projectId: string;
  initialToken: string | null;
  projectName: string;
  variant?: 'button' | 'menuItem';
}

export function ShareModal({ projectId, initialToken, projectName, variant = 'button' }: ShareModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { db } = useFirebase();
  const router = useRouter();

  // Reset copied state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  const shareUrl = typeof window !== 'undefined' && token 
    ? `${window.location.origin}/share/${token}` 
    : '';

  const handleCopy = async () => {
    try {
      if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const updateShareToken = async (newToken: string | null) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        share_token: newToken
      });
      setToken(newToken);
      router.refresh();
    } catch (err) {
      console.error('Error updating share token:', err);
      alert('Hubo un error al actualizar el enlace. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (token) {
      // Disable sharing
      updateShareToken(null);
    } else {
      // Enable sharing (generate new token)
      const newToken = crypto.randomUUID().replace(/-/g, '');
      updateShareToken(newToken);
    }
  };

  const handleRegenerate = () => {
    const confirmRegenerate = window.confirm(
      '¿Estás seguro de que quieres regenerar el enlace? El enlace anterior dejará de funcionar inmediatamente.'
    );
    if (confirmRegenerate) {
      const newToken = crypto.randomUUID().replace(/-/g, '');
      updateShareToken(newToken);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={variant === 'menuItem' ? "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-200 hover:bg-surface-800 hover:text-surface-100 transition-colors" : "btn-secondary text-xs flex items-center gap-2 flex-shrink-0"}
        title="Gestionar el acceso público al proyecto"
      >
        <svg className="w-4 h-4 text-surface-400 group-hover:text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
        <span className={variant === 'menuItem' ? '' : 'hidden sm:inline'}>Compartir</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-surface-800 bg-surface-800/50">
              <h3 className="text-lg font-bold text-surface-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Compartir Proyecto
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-surface-400 hover:text-surface-100 transition-colors p-1"
                title="Cerrar modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-sm text-surface-200/80 mb-6">
                Gestiona el acceso de lectura público de <strong className="text-surface-100">{projectName}</strong>. Los invitados podrán visualizar el Gantt y la Curva S sin necesidad de iniciar sesión.
              </p>

              {/* Toggle Access */}
              <div className="flex items-center justify-between p-4 bg-surface-800 rounded-xl mb-6 border border-surface-700/50">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-surface-100">Acceso mediante enlace</span>
                  <span className="text-xs text-surface-400 mt-0.5">
                    {token ? 'Cualquiera con el enlace puede acceder' : 'El enlace de invitación está desactivado'}
                  </span>
                </div>
                <button
                  onClick={handleToggle}
                  disabled={loading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2 focus:ring-offset-surface-900 ${
                    token ? 'bg-accent-500' : 'bg-surface-600'
                  }`}
                >
                  <span className="sr-only">Toggle share access</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      token ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* URL Display */}
              {token && (
                <div className="space-y-4 fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-surface-300 uppercase tracking-widest mb-2">
                      Enlace público
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 overflow-hidden bg-surface-950 border border-surface-700/50 rounded-lg flex items-center px-3 py-2.5">
                        <span className="text-sm text-surface-100 truncate w-full select-all font-mono">
                          {shareUrl}
                        </span>
                      </div>
                      <button
                        onClick={handleCopy}
                        className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 min-w-[100px] justify-center ${
                          copied
                            ? 'bg-success-500/20 text-success-400 border border-success-500/30'
                            : 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                        }`}
                      >
                        {copied ? (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            ¡Copiado!
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Regenerate URL Option */}
                  <div className="pt-4 mt-2 border-t border-surface-800 flex justify-between items-center">
                    <div className="flex flex-col">
                       <span className="text-xs font-semibold text-surface-200">¿El enlace se ha filtrado?</span>
                       <span className="text-[11px] text-surface-400">Puedes regenerarlo para invalidar el anterior.</span>
                    </div>
                    <button
                      onClick={handleRegenerate}
                      disabled={loading}
                      className="text-xs font-bold text-accent-400 hover:text-accent-300 transition-colors flex items-center gap-1.5 p-1.5 rounded-md hover:bg-accent-400/10"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerar enlace
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
