'use client';

import React, { useMemo, useState } from 'react';
import { PartidaWithItems, DailyProgress } from '@/lib/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Props {
  partidas: PartidaWithItems[];
  dailyProgress: DailyProgress[];
}

export function PublicItemValidationView({ partidas, dailyProgress }: Props) {
  // Create a map of accumulated progress per activity
  const accumulatedProgress = useMemo(() => {
    const map: Record<string, number> = {};
    dailyProgress.forEach(dp => {
      if (!map[dp.activity_id]) {
        map[dp.activity_id] = 0;
      }
      map[dp.activity_id] += dp.progress_percent || 0;
    });
    return map;
  }, [dailyProgress]);

  // Transform to Services > Items > Activities
  const services = useMemo(() => {
    // 1. Deep clone
    const newPartidas: PartidaWithItems[] = JSON.parse(JSON.stringify(partidas));

    // 2. Define moves
    const moves = [
      { name: 'Bandas de casco: Desmontaje de banda de casco Backup, Inst. de tapa metálica en el chute', toPartida: 'BANDA DE CASCOS', toItem: 'Bandas de casco' },
      { name: 'Bandas de casco: Traslado y acopio de piezas desmontadas de BC Backup', toPartida: 'BANDA DE CASCOS', toItem: 'Bandas de casco' },
      { name: 'Archa B1: Inst. Bandejas electricas nuevas - Pt. 01', toPartida: 'REUBICACIÓN ARCHA B1', toItem: 'Archa B1: Eléctrico' },
      { name: 'Archa B1: Inst. de cables de acometida y tierra', toPartida: 'REUBICACIÓN ARCHA B1', toItem: 'Archa B1: Eléctrico' },
      { name: 'Archa B1: Inst. Bandejas electricas nuevas - Pt. 02', toPartida: 'REUBICACIÓN ARCHA B1', toItem: 'Archa B1: Eléctrico' },
      { name: 'Archa D3: Inst. Bandejas electricas nuevas.', toPartida: 'REUBICACIÓN ARCHA D3', toItem: 'Archa D3: Eléctrico' },
      { name: 'Tin Hood D4: Fabricar Ducto Inox. y soportes', toPartida: 'REUBICACIÓN TIN HOOD B1', toItem: 'Tin Hood B1: Mecánico' },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractedActivities: { act: any, toPartida: string, toItem: string }[] = [];

    for (const p of newPartidas) {
      if (!p.items) continue;
      for (const i of p.items) {
        if (!i.activities) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const remainingActivities: any[] = [];
        for (const act of i.activities) {
          const move = moves.find(m => act.name.includes(m.name) || m.name.includes(act.name));
          if (move) {
            extractedActivities.push({ act, toPartida: move.toPartida, toItem: move.toItem });
          } else {
            remainingActivities.push(act);
          }
        }
        i.activities = remainingActivities;
      }
    }

    for (const ext of extractedActivities) {
      let destPartida = newPartidas.find(p => p.name === ext.toPartida);
      if (!destPartida) {
        destPartida = {
          id: `virtual-partida-${ext.toPartida.replace(/\s+/g, '-')}`,
          project_id: newPartidas[0]?.project_id || '',
          name: ext.toPartida,
          sort_order: 999,
          created_at: new Date().toISOString(),
          items: []
        };
        newPartidas.push(destPartida);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let destItem = destPartida.items.find((i: any) => i.name === ext.toItem);
      if (!destItem) {
        destItem = {
          id: `virtual-item-${ext.toItem.replace(/\s+/g, '-')}`,
          partida_id: destPartida.id,
          name: ext.toItem,
          sort_order: 999,
          created_at: new Date().toISOString(),
          activities: []
        };
        destPartida.items.push(destItem);
      }
      destItem.activities.push(ext.act);
    }

    const finalPartidas = newPartidas.map(p => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p.items = p.items.filter((i: any) => i.activities && i.activities.length > 0);
      return p;
    }).filter(p => p.items && p.items.length > 0);

    // 3. Group into Services
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceBanda: any = { name: 'BANDA DE CASCOS', items: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceInterferencias: any = { name: 'MOVIMIENTO DE INTERFERENCIAS', items: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceArchas: any = { name: 'MOVIMIENTO DE ARCHAS OWENS', items: [] };

    for (const p of finalPartidas) {
      const isBanda = p.name === 'BANDA DE CASCOS';
      for (const i of p.items) {
        // Calculate Item accumulated progress based on activities
        let totalWeight = 0;
        let weightedProgress = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        i.activities.forEach((act: any) => {
          const actAcc = Math.min(accumulatedProgress[act.id] || 0, 100);
          const w = act.weight || 1;
          totalWeight += w;
          weightedProgress += (actAcc * w);
        });

        const itemAcc = totalWeight > 0 ? (weightedProgress / totalWeight) : 0;
        const itemName = (i.name === 'Ítem por Defecto') ? p.name : i.name;

        const processedItem = {
          ...i,
          displayName: itemName,
          accumulatedPercent: itemAcc
        };

        if (isBanda) {
          serviceBanda.items.push(processedItem);
        } else if (i.name === 'MOVIMIENTO DE INTERFERENCIAS') {
          serviceInterferencias.items.push(processedItem);
        } else {
          serviceArchas.items.push(processedItem);
        }
      }
    }

    return [serviceBanda, serviceArchas, serviceInterferencias].filter(s => s.items.length > 0);
  }, [partidas, accumulatedProgress]);

  // State to manage which Services are open in the accordion
  const [openServices, setOpenServices] = useState<Record<string, boolean>>({
    'BANDA DE CASCOS': true,
    'MOVIMIENTO DE ARCHAS OWENS': true,
    'MOVIMIENTO DE INTERFERENCIAS': true
  });

  // Items are closed by default to keep the UI clean
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleService = (name: string) => {
    setOpenServices(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6 fade-in">
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-surface-700">
          <div className="space-y-6">
            {services.map(service => (
              <div key={service.name} className="border border-surface-700/50 rounded-xl overflow-hidden shadow-sm bg-white">
                {/* Service Header (Accordion Toggle) */}
                <button 
                  onClick={() => toggleService(service.name)}
                  className={`w-full bg-white px-5 py-4 flex items-center justify-between hover:bg-surface-50 transition-colors text-left ${openServices[service.name] ? 'border-b border-surface-700/30' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-surface-400 font-bold block mb-0.5">Servicio</span>
                      <h3 className="font-bold text-lg text-primary-900">{service.name}</h3>
                    </div>
                  </div>
                  <svg 
                    className={`w-6 h-6 text-surface-400 transition-transform duration-300 ${openServices[service.name] ? 'rotate-180' : ''}`} 
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Items List */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${openServices[service.name] ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="divide-y divide-surface-700/30 p-2 md:p-4 space-y-4">
                    {service.items.map((item: any) => (
                      <div key={item.id} className="bg-surface-50 rounded-xl border border-surface-700/40 overflow-hidden shadow-sm transition-all">
                        {/* Item Header as Accordion Button */}
                        <button 
                          onClick={() => toggleItem(item.id)}
                          className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-white border-b border-surface-700/40 hover:bg-surface-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 md:gap-3 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <svg className="w-4 h-4 text-accent-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <span className="text-[10px] uppercase tracking-wider text-primary-700 font-bold bg-primary-50 border border-primary-200/60 px-1.5 py-0.5 rounded shrink-0">Ítem</span>
                            <span className="text-sm md:text-base text-primary-900 font-semibold line-clamp-2">{item.displayName}</span>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 pl-6 sm:pl-0 shrink-0 mt-1 sm:mt-0">
                            <div className="w-full sm:w-24 md:w-32 h-2 bg-surface-200/30 rounded-full overflow-hidden flex-1 sm:flex-none">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${item.accumulatedPercent >= 100 ? 'bg-success-500' : 'bg-primary-500'}`} 
                                style={{ width: `${Math.min(item.accumulatedPercent, 100)}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[11px] md:text-xs font-bold px-2 py-1 rounded min-w-[65px] text-center shadow-sm ${
                                item.accumulatedPercent >= 100 ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-white text-primary-700 border border-surface-700/50'
                              }`}>
                                {item.accumulatedPercent.toFixed(2)}%
                              </span>
                              <svg 
                                className={`w-4 h-4 text-surface-400 transition-transform duration-300 ${openItems[item.id] ? 'rotate-180' : ''}`} 
                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                        
                        {/* Activities Accordion Content */}
                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${openItems[item.id] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="p-3 md:p-4 space-y-2">
                            {item.activities.map((act: any) => {
                              const acc = Math.min(accumulatedProgress[act.id] || 0, 100);
                              return (
                                <div key={act.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-2.5 md:p-3 rounded-lg border border-surface-700/40 hover:border-surface-600 hover:shadow-sm transition-all gap-2 md:gap-3">
                                  <div className="flex items-start gap-2.5 w-full sm:w-auto">
                                    <svg className="w-3.5 h-3.5 text-surface-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    <span className="text-[13px] md:text-sm text-surface-100 font-medium leading-snug">{act.name}</span>
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2.5 pl-6 sm:pl-0 shrink-0 mt-1 sm:mt-0">
                                    <div className="w-full sm:w-20 h-1.5 bg-surface-200/40 rounded-full overflow-hidden flex-1 sm:flex-none">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${acc >= 100 ? 'bg-success-400' : 'bg-accent-500'}`} 
                                        style={{ width: `${acc}%` }}
                                      ></div>
                                    </div>
                                    <span className={`text-[10px] md:text-[11px] font-bold px-1.5 py-0.5 rounded min-w-[55px] text-center shrink-0 ${
                                      acc >= 100 ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-surface-50 text-surface-400 border border-surface-700/50'
                                    }`}>
                                      {acc.toFixed(2)}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {service.items.length === 0 && (
                      <p className="text-sm text-surface-300 italic p-4">No hay ítems en este servicio.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {services.length === 0 && (
               <div className="text-center py-10 text-surface-300 bg-surface-50 rounded-xl border border-surface-700/50">
                 No hay datos de servicios para mostrar en este proyecto.
               </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
