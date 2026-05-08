import React from 'react';
import Image from 'next/image';
import { ActivityProgress } from '@/lib/types';

interface Props {
  activity: ActivityProgress;
  onPhotoClick: (activityId: string, index: number) => void;
}

export function ProgressActivityCard({ activity, onPhotoClick }: Props) {
  return (
    <div className="p-5 flex flex-col lg:flex-row gap-6">
      {/* Info & Badges */}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h4 className="text-base font-bold text-surface-100">{activity.name}</h4>
            {activity.accumulatedProgress !== undefined && (
              <p className="text-xs text-surface-300 font-medium mt-0.5">
                Acumulado actual: <span className="text-primary-600 font-bold">{activity.accumulatedProgress.toFixed(2)}%</span>
              </p>
            )}
          </div>
          {activity.progressToday > 0 && (
            <span className="shrink-0 inline-flex items-center justify-center px-3 py-1 rounded-full bg-accent-400/10 text-accent-600 font-bold border border-accent-400/20 shadow-sm text-sm whitespace-nowrap">
               + {activity.progressToday}% Hoy
            </span>
          )}
        </div>

        {/* Restricción */}
        {activity.hasRestriction && (
          <div className="mb-4 bg-danger-500/10 border-l-4 border-danger-500 p-3 rounded-r-lg">
            <h5 className="text-xs font-bold text-danger-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              Restricción Reportada
            </h5>
            <p className="text-sm text-danger-700/90 font-medium">
              {activity.restrictionReason || "Sin justificación detallada."}
            </p>
          </div>
        )}

        {/* Comentarios / Notas */}
        {activity.notes && (
          <div className="bg-surface-50 border border-surface-700/50 p-3 rounded-xl relative">
            <div className="absolute top-3 left-3 text-surface-300">
              <svg className="w-5 h-5 opacity-50" fill="currentColor" viewBox="0 0 32 32"><path d="M10 12c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm0-6c-1.103 0-2 .897-2 2s.897 2 2 2 2-.897 2-2-.897-2-2-2zm12 6c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm0-6c-1.103 0-2 .897-2 2s.897 2 2 2 2-.897 2-2-.897-2-2-2zM2 28v-2.5c0-3.033 2.467-5.5 5.5-5.5h5c3.033 0 5.5 2.467 5.5 5.5V28h-2v-2.5c0-1.93-1.57-3.5-3.5-3.5h-5c-1.93 0-3.5 1.57-3.5 3.5V28H2zm14 0v-2.5c0-3.033 2.467-5.5 5.5-5.5h5c3.033 0 5.5 2.467 5.5 5.5V28h-2v-2.5c0-1.93-1.57-3.5-3.5-3.5h-5c-1.93 0-3.5 1.57-3.5 3.5V28h-2z" /></svg>
            </div>
            <p className="pl-8 text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">
              {activity.notes}
            </p>
          </div>
        )}
        
        {!activity.notes && !activity.hasRestriction && activity.progressToday > 0 && (
          <p className="text-sm text-surface-300 italic flex items-center gap-1.5 mt-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Avanzado sin novedades.
          </p>
        )}
      </div>

      {/* Fotos */}
      {activity.photos && activity.photos.length > 0 && (
        <div className="shrink-0 lg:w-[280px]">
          <h5 className="text-[10px] font-bold text-surface-200 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>Evidencia Fotográfica</span>
            <span className="bg-surface-700/50 px-1.5 py-0.5 rounded text-surface-200">{activity.photos.length}</span>
          </h5>
          <div className="flex gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
            {activity.photos.map((photoUrl: string, idx: number) => (
              <div 
                key={idx} 
                onClick={() => onPhotoClick(activity.id, idx)}
                className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-surface-700/50 shadow-sm cursor-zoom-in group"
              >
                <Image 
                  src={photoUrl} 
                  alt="Evidencia de avance" 
                  fill
                  style={{ objectFit: 'cover' }}
                  unoptimized
                  className="transition-transform duration-300 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-primary-900/0 group-hover:bg-primary-900/20 transition-colors flex items-center justify-center">
                   <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow-md transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
