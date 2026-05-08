'use client';

import React, { useState } from 'react';
import { GanttView } from '@/components/gantt/GanttView';
import { SCurveChart } from '@/components/charts/SCurveChart';
import { PublicDailyProgressView } from './PublicDailyProgressView';
import type { Project, PartidaWithItems, DailyProgress } from '@/lib/types';

interface Props {
  project: Project;
  partidas: PartidaWithItems[];
  dailyProgress: DailyProgress[];
  milestones: unknown[];
}

export function ShareContentTabs({ project, partidas, dailyProgress, milestones }: Props) {
  const [activeTab, setActiveTab] = useState<'gantt' | 'scurve' | 'daily'>('gantt');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex overflow-x-auto border-b border-surface-700 custom-scrollbar pb-[-1px]">
        <div className="flex gap-8 px-2">
          <button
            onClick={() => setActiveTab('gantt')}
            className={`pb-4 pt-2 px-1 text-sm font-bold tracking-wide uppercase transition-all whitespace-nowrap relative ${
              activeTab === 'gantt'
                ? 'text-accent-500'
                : 'text-surface-300 hover:text-surface-100'
            }`}
          >
            Cronograma Gantt
            {activeTab === 'gantt' && (
              <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-accent-500 rounded-t-full shadow-[0_-2px_8px_rgba(247,194,14,0.5)]" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('scurve')}
            className={`pb-4 pt-2 px-1 text-sm font-bold tracking-wide uppercase transition-all whitespace-nowrap relative ${
              activeTab === 'scurve'
                ? 'text-accent-500'
                : 'text-surface-300 hover:text-surface-100'
            }`}
          >
            Curva S
            {activeTab === 'scurve' && (
              <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-accent-500 rounded-t-full shadow-[0_-2px_8px_rgba(247,194,14,0.5)]" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('daily')}
            className={`pb-4 pt-2 px-1 text-sm font-bold tracking-wide uppercase transition-all whitespace-nowrap relative ${
              activeTab === 'daily'
                ? 'text-accent-500'
                : 'text-surface-300 hover:text-surface-100'
            }`}
          >
            <div className="flex items-center gap-2">
              Avances Diarios
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
              </span>
            </div>
            {activeTab === 'daily' && (
              <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-accent-500 rounded-t-full shadow-[0_-2px_8px_rgba(247,194,14,0.5)]" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content Panels */}
      <div className="fade-in pt-4">
        {activeTab === 'gantt' && (
          <section className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-surface-700 animate-fade-in">
            <GanttView
              projectId={project.id}
              partidas={partidas || []}
              dailyProgress={dailyProgress}
              readonly={true}
            />
          </section>
        )}

        {activeTab === 'scurve' && (
          <section className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-surface-700 animate-fade-in">
            <SCurveChart
              project={project}
              partidas={partidas || []}
              dailyProgress={dailyProgress}
              milestones={milestones}
              showKPIs={false}
            />
          </section>
        )}

        {activeTab === 'daily' && (
          <section className="animate-fade-in">
            <PublicDailyProgressView
              project={project}
              partidas={partidas || []}
              dailyProgress={dailyProgress}
            />
          </section>
        )}
      </div>
    </div>
  );
}
