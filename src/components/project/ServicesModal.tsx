'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProjectServices } from '@/app/actions/services';
import type { Project, PartidaWithItems, ProjectService } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface ServicesModalProps {
  project: Project;
  partidas: PartidaWithItems[];
  isOwner: boolean;
  variant?: 'button' | 'menuItem';
}

export function ServicesModal({ project, partidas, isOwner, variant = 'button' }: ServicesModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [services, setServices] = useState<ProjectService[]>(project.services || []);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  if (!isOwner) return null;

  const handleAddService = () => {
    setServices([...services, {
      id: uuidv4(),
      project_id: project.id,
      name: 'Nuevo Servicio',
      partida_ids: [],
      sort_order: services.length
    }]);
  };

  const handleRemoveService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleUpdateServiceName = (id: string, name: string) => {
    setServices(services.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleTogglePartida = (serviceId: string, partidaId: string) => {
    setServices(services.map(s => {
      if (s.id !== serviceId) return s;
      const isSelected = s.partida_ids.includes(partidaId);
      const newPartidaIds = isSelected 
        ? s.partida_ids.filter(id => id !== partidaId)
        : [...s.partida_ids, partidaId];
      return { ...s, partida_ids: newPartidaIds };
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Normalize sort_order
      const normalizedServices = services.map((s, idx) => ({ ...s, sort_order: idx }));
      const result = await saveProjectServices(project.id, normalizedServices);
      if (result.success) {
        setIsOpen(false);
        router.refresh();
      } else {
        alert(result.error || 'Error al guardar los servicios');
      }
    } catch (e) {
      console.error(e);
      alert('Ocurrió un error inesperado');
    } finally {
      setIsSaving(false);
    }
  };

  // Rest of the UI
  return (
    <>
      {variant === 'menuItem' ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full text-left px-4 py-2 text-sm text-surface-200 hover:bg-surface-800 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Configurar Servicios
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-surface-200 bg-surface-800 border border-surface-700/50 rounded-lg hover:bg-surface-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Configurar Servicios
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSaving && setIsOpen(false)} />
          
          <div className="relative bg-surface-900 border border-surface-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
            <div className="p-5 md:p-6 border-b border-surface-800 flex justify-between items-center bg-surface-900/50">
              <div>
                <h2 className="text-xl font-bold text-surface-50">Configurar Servicios</h2>
                <p className="text-sm text-surface-400 mt-1">
                  Agrupa partidas del Gantt para mostrarlas al cliente en la vista de servicios.
                </p>
              </div>
              <button
                onClick={() => !isSaving && setIsOpen(false)}
                className="p-2 text-surface-400 hover:text-white bg-surface-800 hover:bg-surface-700 rounded-lg transition-all"
                disabled={isSaving}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
              {services.map((service, index) => (
                <div key={service.id} className="bg-surface-800/50 border border-surface-700/50 rounded-xl overflow-hidden relative">
                  <div className="p-4 border-b border-surface-700/50 flex gap-4 items-center bg-surface-800">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={service.name}
                        onChange={(e) => handleUpdateServiceName(service.id, e.target.value)}
                        className="w-full bg-surface-900 border border-surface-700 text-surface-50 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-500 transition-colors font-semibold"
                        placeholder="Nombre del servicio (ej. MOVIMIENTO DE ARCHAS)"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveService(service.id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Eliminar servicio"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="p-4">
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Partidas vinculadas</p>
                    {partidas.length === 0 ? (
                      <p className="text-sm text-surface-500 italic">No hay partidas en el proyecto.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {partidas.map(partida => {
                          const isSelected = service.partida_ids.includes(partida.id);
                          return (
                            <label key={partida.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-primary-500/10 border-primary-500/50' : 'bg-surface-900 border-surface-700/50 hover:border-surface-600'}`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleTogglePartida(service.id, partida.id)}
                                className="w-4 h-4 rounded border-surface-600 text-primary-500 focus:ring-primary-500/20 focus:ring-offset-0 bg-surface-800"
                              />
                              <span className={`text-sm font-medium line-clamp-2 ${isSelected ? 'text-primary-100' : 'text-surface-300'}`}>
                                {partida.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={handleAddService}
                className="w-full py-4 border-2 border-dashed border-surface-700 rounded-xl text-surface-400 font-semibold hover:border-surface-500 hover:text-surface-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Añadir Nuevo Servicio
              </button>
            </div>

            <div className="p-5 md:p-6 border-t border-surface-800 flex gap-3 bg-surface-900/50">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
                className="flex-1 py-2.5 px-4 bg-surface-800 hover:bg-surface-700 text-surface-200 font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || services.some(s => !s.name.trim())}
                className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
