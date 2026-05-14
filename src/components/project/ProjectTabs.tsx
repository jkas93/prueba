'use client';

import { useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Project, Alert } from '@/lib/types';

// Componente de Skeleton para mientras carga cada pestaña
const TabSkeleton = () => (
  <div className="w-full bg-surface-900/30 rounded-xl border border-surface-800/50 p-6 flex flex-col gap-4 animate-pulse">
    <div className="h-8 w-1/4 bg-surface-800 rounded"></div>
    <div className="h-48 w-full bg-surface-800 rounded-lg"></div>
  </div>
);

// Lazy loading de las pestañas
const GanttView = dynamic(() => import('@/components/gantt/GanttView').then(mod => mod.GanttView), { 
  loading: () => <TabSkeleton />, ssr: false 
});
const SCurveChart = dynamic(() => import('@/components/charts/SCurveChart').then(mod => mod.SCurveChart), { 
  loading: () => <TabSkeleton />, ssr: false 
});
const DailyPulseView = dynamic(() => import('@/components/project/DailyPulseView').then(mod => mod.DailyPulseView), { 
  loading: () => <TabSkeleton />, ssr: false 
});
const AlertBanner = dynamic(() => import('@/components/alerts/AlertBanner').then(mod => mod.AlertBanner), { 
  loading: () => <TabSkeleton />, ssr: false 
});

interface Props {
  project: Project;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  partidas: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyProgress: any[];
  alerts: Alert[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  milestones: any[];
}

const VALID_TABS = ['gantt', 'scurve', 'progress', 'alerts'] as const;
type TabId = typeof VALID_TABS[number];

const tabs = [
  { id: 'gantt' as TabId, label: 'Gantt', icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' },
  { id: 'scurve' as TabId, label: 'Curva S', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
  { id: 'progress' as TabId, label: 'Pulso Diario', icon: 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'alerts' as TabId, label: 'Alertas', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
];

export function ProjectTabs({ project, partidas, dailyProgress, alerts, milestones }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'gantt');

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tabId);
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
  };

  // Count unread alerts
  const unreadAlerts = alerts.filter((a) => !a.is_read).length;

  // Count active restrictions for today (usando fecha local correcta)
  const todayStr = new Intl.DateTimeFormat('sv-SE').format(new Date()); // Fix #3 parcial: yyyy-MM-dd en zona local
  const activeRestrictions = dailyProgress.filter((dp) => dp.date === todayStr && dp.has_restriction).length;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-surface-900/50 border border-accent-400/10 w-full overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap flex-shrink-0 font-bold ${
              activeTab === tab.id
                ? 'bg-accent-400 text-primary-900 shadow-md shadow-accent-400/20'
                : 'text-surface-300 hover:text-surface-100 hover:bg-surface-800/80'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
            </svg>
            {tab.label}
            {tab.id === 'alerts' && unreadAlerts > 0 && (
              <span className="w-5 h-5 rounded-full bg-danger-500 text-white text-xs flex items-center justify-center font-bold">
                {unreadAlerts}
              </span>
            )}
            {tab.id === 'progress' && activeRestrictions > 0 && (
              <span className="w-5 h-5 rounded-full bg-danger-500 text-white text-xs flex items-center justify-center font-bold" title="Restricciones activas hoy">
                {activeRestrictions}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'gantt' && (
          <GanttView
            projectId={project.id}
            partidas={partidas}
            dailyProgress={dailyProgress}
          />
        )}
        {activeTab === 'scurve' && (
          <SCurveChart
            project={project}
            partidas={partidas}
            dailyProgress={dailyProgress}
            milestones={milestones}
          />
        )}
        {activeTab === 'progress' && (
          <DailyPulseView
            projectId={project.id}
            partidas={partidas}
            dailyProgress={dailyProgress}
          />
        )}
        {activeTab === 'alerts' && (
          <AlertBanner
            alerts={alerts}
            projectId={project.id}
          />
        )}
      </div>
    </div>
  );
}
