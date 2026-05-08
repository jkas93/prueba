'use client';

import React, { useState } from 'react';
import { PartidaWithItems, DailyProgress, Project, PartidaProgress, ItemProgress, ActivityProgress } from '@/lib/types';
import { useProjectProgress } from '@/hooks/useProjectProgress';
import { ProgressHeader } from './progress/ProgressHeader';
import { ProgressActivityCard } from './progress/ProgressActivityCard';
import { ProgressLightbox } from './progress/ProgressLightbox';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Props {
  project?: Project;
  partidas: PartidaWithItems[];
  dailyProgress: DailyProgress[];
}

export function PublicDailyProgressView({ partidas, dailyProgress = [] }: Props) {
  const { 
    selectedDate, 
    dataForSelectedDate, 
    stats, 
    changeDate, 
    isToday 
  } = useProjectProgress(partidas, dailyProgress);

  const [lightboxData, setLightboxData] = useState<{ activityId: string, index: number } | null>(null);

  const handlePhotoClick = (activityId: string, index: number) => {
    setLightboxData({ activityId, index });
  };

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-6 fade-in">
        
        {/* Date Navigation & Stats Header */}
        <ProgressHeader 
          selectedDate={selectedDate}
          isToday={isToday}
          onNavigate={changeDate}
          stats={stats}
        />

        {/* Progress Timeline List */}
        {dataForSelectedDate.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-surface-300 border border-surface-700/50 shadow-sm flex flex-col items-center">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30 text-surface-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="text-lg font-bold text-surface-100 mb-1">Sin Avances Reportados</h3>
            <p className="max-w-md mx-auto">No hay registros de avance físico, fotografías ni notas reportadas para esta fecha.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {dataForSelectedDate.map((partida: PartidaProgress) => (
              <div key={partida.id} className="relative">
                {/* Partida Line Anchor */}
                <div className="absolute left-[27px] top-10 bottom-0 w-0.5 bg-surface-700/50 -z-10 hidden md:block"></div>
                
                <div className="flex items-center gap-3 mb-4 sticky top-0 bg-surface-950/80 backdrop-blur-sm z-20 py-2">
                  <div className="w-14 h-14 rounded-2xl bg-primary-600 shadow-md flex items-center justify-center shrink-0 border border-primary-500">
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-primary-900">{partida.name}</h2>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-surface-200">Partida Principal</p>
                      {partida.accumulatedPercent !== undefined && (
                        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100">
                          {partida.accumulatedPercent.toFixed(2)}% Acumulado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pl-4 md:pl-16 space-y-6">
                  {partida.items.map((item: ItemProgress) => (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-surface-700/60 overflow-hidden transition-all hover:border-surface-600">
                      <div className="bg-surface-50 px-5 py-3 border-b border-surface-700/60">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-surface-200 flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            {item.name}
                          </h3>
                          {item.accumulatedPercent !== undefined && (
                            <span className="text-xs font-bold text-surface-400 bg-white px-2 py-0.5 rounded-md border border-surface-700/50 shadow-sm">
                              {item.accumulatedPercent.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-surface-700/30">
                        {item.activities.map((activity: ActivityProgress) => (
                          <ProgressActivityCard 
                            key={activity.id}
                            activity={activity}
                            onPhotoClick={handlePhotoClick}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LIGHTBOX NATIVO */}
        {lightboxData && (() => {
           const flatActivities = dataForSelectedDate.flatMap(p => p.items).flatMap((i: ItemProgress) => i.activities);
           const activity = flatActivities.find((a: ActivityProgress) => a.id === lightboxData.activityId);
           if (!activity) return null;

           return (
             <ProgressLightbox 
               photoUrls={activity.photos}
               initialIndex={lightboxData.index}
               date={selectedDate}
               onClose={() => setLightboxData(null)}
             />
           );
        })()}
      </div>
    </ErrorBoundary>
  );
}
