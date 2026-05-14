'use client';

import { useState } from 'react';
import { useFirebase } from '@/hooks/useFirebase';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Alert } from '@/lib/types';

interface Props {
  alerts: Alert[];
  projectId: string;
}

const severityConfig = {
  info: {
    bg: 'bg-accent-400/10',
    border: 'border-accent-400/20',
    text: 'text-accent-400',
    icon: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
    label: 'Info',
  },
  warning: {
    bg: 'bg-warning-500/10',
    border: 'border-warning-500/20',
    text: 'text-warning-400',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    label: 'Advertencia',
  },
  critical: {
    bg: 'bg-danger-500/10',
    border: 'border-danger-500/20',
    text: 'text-danger-400',
    icon: 'M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    label: 'Crítico',
  },
};

/**
 * AlertBanner — Displays project alerts with severity-based styling.
 * Allows marking individual alerts as read.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AlertBanner({ alerts, projectId: _projectId }: Props) {
  const [localAlerts, setLocalAlerts] = useState(alerts);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');
  const { db } = useFirebase();

  const markAsRead = async (alertId: string) => {
    await updateDoc(doc(db, 'alerts', alertId), { is_read: true });

    setLocalAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
    );
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    const unreadAlerts = localAlerts.filter(a => !a.is_read);
    
    unreadAlerts.forEach(a => {
      batch.update(doc(db, 'alerts', a.id), { is_read: true });
    });
    
    await batch.commit();

    setLocalAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
  };

  const unreadCount = localAlerts.filter((a) => !a.is_read).length;

  // Apply filters
  const filteredAlerts = localAlerts.filter(alert => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterType !== 'all' && alert.type !== filterType) return false;
    if (filterRead === 'read' && !alert.is_read) return false;
    if (filterRead === 'unread' && alert.is_read) return false;
    return true;
  });

  if (localAlerts.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-accent-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-surface-100 mb-2">
          Sin alertas
        </h3>
        <p className="text-sm text-surface-200/60">
          El proyecto no tiene desviaciones significativas. ¡Todo en orden!
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-surface-200/60">
          {unreadCount > 0
            ? `${unreadCount} alerta${unreadCount > 1 ? 's' : ''} sin leer de ${localAlerts.length} total`
            : `Todas las ${localAlerts.length} alertas leídas`}
        </p>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="btn-secondary text-xs"
            >
              Marcar todo leído
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl bg-surface-900/50 border border-accent-400/10">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-surface-200/50">Severidad</label>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-md text-xs px-2 py-1.5 focus:border-accent-400 outline-none text-surface-100">
            <option value="all">Todas</option>
            <option value="critical">Críticas</option>
            <option value="warning">Advertencias</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-surface-200/50">Tipo</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-md text-xs px-2 py-1.5 focus:border-accent-400 outline-none text-surface-100">
            <option value="all">Todos</option>
            <option value="progress_deviation">Desviación global</option>
            <option value="schedule_delay">Retraso específico</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-surface-200/50">Estado</label>
          <select value={filterRead} onChange={e => setFilterRead(e.target.value)} className="bg-surface-800 border border-surface-700 rounded-md text-xs px-2 py-1.5 focus:border-accent-400 outline-none text-surface-100">
            <option value="all">Leídas y No leídas</option>
            <option value="unread">Solo no leídas</option>
            <option value="read">Solo leídas</option>
          </select>
        </div>
      </div>

      {filteredAlerts.length === 0 && (
        <div className="text-center py-8 text-surface-200/50 text-sm">
          No hay alertas que coincidan con los filtros seleccionados.
        </div>
      )}

      {/* Alerts list */}
      <div className="space-y-3">
        {filteredAlerts.map((alert) => {
          const config = severityConfig[alert.severity];
          return (
            <div
              key={alert.id}
              className={`glass-card p-4 flex items-start gap-4 transition-opacity ${
                alert.is_read ? 'opacity-50' : ''
              }`}
            >
              {/* Severity icon */}
              <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                <svg className={`w-5 h-5 ${config.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text} border ${config.border}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-surface-200/40">
                    {alert.type === 'schedule_delay' ? 'Retraso' : 'Desviación'}
                  </span>
                </div>
                <p className="text-sm text-surface-200/80">{alert.message}</p>
                <p className="text-xs text-surface-200/40 mt-1">
                  {new Date(alert.created_at).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {/* Mark as read */}
              {!alert.is_read && (
                <button
                  onClick={() => markAsRead(alert.id)}
                  className="shrink-0 p-2 rounded-lg hover:bg-surface-700/50 transition-colors"
                  title="Marcar como leída"
                >
                  <svg className="w-4 h-4 text-surface-200/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
