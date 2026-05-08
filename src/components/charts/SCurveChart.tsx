'use client';

import { useMemo, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { calculateSCurve } from '@/lib/scurve';
import type { Project, PartidaWithItems, DailyProgress, SCurvePoint } from '@/lib/types';
import { format, parseISO } from 'date-fns';

interface Props {
  project: Project;
  partidas: PartidaWithItems[];
  dailyProgress: DailyProgress[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  milestones: any[];
  showKPIs?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: ReadonlyArray<any>;
  label?: string | number;
  todayStr?: string;
}

const CustomTooltip = ({ active, payload, label, todayStr }: CustomTooltipProps) => {
  if (active && payload && payload.length && label) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planned = payload.find((p: any) => p.dataKey === 'planned')?.value || 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actual = payload.find((p: any) => p.dataKey === 'actual')?.value || 0;
    const dev = actual - planned;
    const isToday = label === todayStr;

    return (
      <div className="glass-card p-3 border border-primary-500/20 shadow-xl min-w-[200px]">
        <p className="text-sm font-semibold text-surface-100 mb-2 border-b border-surface-700 pb-1">
          {format(parseISO(String(label)), 'dd MMM yyyy')}
          {isToday && <span className="ml-2 text-[10px] bg-accent-500/20 text-accent-400 px-1.5 py-0.5 rounded uppercase">Hoy</span>}
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between items-center gap-4">
            <span className="text-surface-200/70 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary-500"></div>Planificada
            </span>
            <span className="font-medium text-surface-100">{planned.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-surface-200/70 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-accent-500"></div>Real
            </span>
            <span className="font-medium text-surface-100">{actual.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center gap-4 pt-1 mt-1 border-t border-surface-700/50">
            <span className="text-surface-200/70">Desviación</span>
            <span className={`font-semibold ${dev >= 0 ? 'text-accent-400' : 'text-danger-400'}`}>
              {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function SCurveChart({ project, partidas, dailyProgress, milestones, showKPIs = true }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Flatten activities from nested partidas
  const activities = useMemo(() => {
    return partidas
      .flatMap((p) => p.items || [])
      .flatMap((i) => i.activities || []);
  }, [partidas]);

  // Calculate S-Curve data
  const scurveData = useMemo(() => {
    if (activities.length === 0) return null;
    return calculateSCurve(
      project.start_date,
      project.end_date,
      activities,
      dailyProgress
    );
  }, [project, activities, dailyProgress]);

  const { todayStr, milestoneDates } = useMemo(() => ({
    todayStr: format(new Date(), 'yyyy-MM-dd'),
    milestoneDates: (milestones || []).map(m => m.date)
  }), [milestones]);

  const todayPoint = useMemo(() => 
    scurveData?.points?.find((p: SCurvePoint) => p.date === todayStr) || null,
  [scurveData?.points, todayStr]);

  // Sample data points for readability (every 7 days for long projects)
  const sampledPoints = useMemo(() => {
    if (!scurveData || scurveData.points.length === 0) return [];
    return scurveData.points.length > 60
      ? scurveData.points.filter((p: SCurvePoint, i: number, arr: SCurvePoint[]) => 
          i % 7 === 0 || 
          i === arr.length - 1 || 
          p.date === todayStr || 
          p.date === scurveData.latestProgressDate ||
          milestoneDates.includes(p.date)
        )
      : scurveData.points;
  }, [scurveData, todayStr, milestoneDates]);

  if (!scurveData || scurveData.points.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-surface-100 mb-2">
          Sin datos para la Curva S
        </h3>
        <p className="text-sm text-surface-200/60">
          Agrega actividades en el Gantt para ver la Curva S planificada.
          Registra avance diario para la curva real.
        </p>
      </div>
    );
  }

  const spiColor = scurveData.spiIndex >= 0.95
    ? 'text-accent-400'
    : scurveData.spiIndex >= 0.85
    ? 'text-warning-400'
    : 'text-danger-400';

  const deviation = scurveData.currentActual - scurveData.currentPlanned;

  const handleExport = async () => {
    if (chartRef.current) {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(chartRef.current, {
          backgroundColor: '#0f172a',
          scale: 2
        });
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `Curva-S-${project.name.replace(/\s+/g, '-')}-${todayStr}.png`;
        link.href = url;
        link.click();
      } catch (err) {
        console.error("Error al exportar gráfico:", err);
      }
    }
  };

  return (
    <div>
      {showKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-surface-200/60 mb-1">Avance Planificado</p>
            <p className="text-2xl font-bold text-primary-300">{scurveData.currentPlanned.toFixed(1)}%</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-surface-200/60 mb-1">Avance Real</p>
            <p className="text-2xl font-bold text-accent-400">{scurveData.currentActual.toFixed(1)}%</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-surface-200/60 mb-1">Desviación</p>
            <p className={`text-2xl font-bold ${deviation >= 0 ? 'text-accent-400' : 'text-danger-400'}`}>
              {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}%
            </p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-surface-200/60 mb-1">SPI (Índice)</p>
            <p className={`text-2xl font-bold ${spiColor}`}>{scurveData.spiIndex.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="glass-card p-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-surface-100">
            Curva S — Planificada vs. Real
          </h3>
          <button 
            onClick={handleExport}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Exportar gráfico a PNG"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar PNG
          </button>
        </div>
        <div ref={chartRef} className="bg-surface-900 rounded-lg p-2 pb-6">
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={sampledPoints} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3366a8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3366a8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F7C20E" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#F7C20E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(247, 194, 14, 0.05)" />
              <XAxis
                dataKey="date"
                stroke="rgba(148, 163, 184, 0.4)"
                fontSize={11}
                tickFormatter={(val) => {
                  try {
                    return format(parseISO(val), 'dd/MM');
                  } catch {
                    return val;
                  }
                }}
              />
              <YAxis
                stroke="rgba(148, 163, 184, 0.4)"
                fontSize={11}
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip content={(props) => <CustomTooltip {...props} todayStr={todayStr} />} />
              <Legend
                formatter={(value) => (value === 'planned' ? 'Planificada' : 'Real')}
                wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
              />
              <ReferenceLine y={50} stroke="rgba(148, 163, 184, 0.15)" strokeDasharray="5 5" />
              {todayPoint && (
                <ReferenceLine
                  x={todayStr}
                  stroke="#f43f5e"
                  strokeDasharray="3 3"
                  label={{ position: 'insideTop', value: 'HOY', fill: '#f43f5e', fontSize: 10, dy: 15 }}
                />
              )}
              {todayPoint && (
                <ReferenceDot x={todayStr} y={todayPoint.actual} r={4} fill="#f43f5e" stroke="none" />
              )}
              {milestones.map((m) => (
                <ReferenceLine
                  key={m.id}
                  x={m.date}
                  stroke="rgba(247, 194, 14, 0.4)"
                  strokeDasharray="4 4"
                  label={{ 
                    position: 'insideBottomLeft', 
                    value: m.name.toUpperCase(), 
                    fill: 'rgba(247, 194, 14, 0.6)', 
                    fontSize: 9,
                    fontWeight: '800',
                    angle: -90,
                    dx: 12,
                    dy: -20
                  }}
                />
              ))}
              <Area type="monotone" dataKey="planned" stroke="#3366a8" fillOpacity={1} fill="url(#colorPlanned)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="actual" stroke="#F7C20E" fillOpacity={1} fill="url(#colorActual)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
