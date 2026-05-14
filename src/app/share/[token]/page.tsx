import { notFound } from 'next/navigation';
import { ShareContentTabs } from '@/components/project/ShareContentTabs';
import { format, parseISO, differenceInDays } from 'date-fns';
import { calculateSCurve } from '@/lib/scurve';
import { es } from 'date-fns/locale';
import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebase/server';
import type { PartidaWithItems, DailyProgress } from '@/lib/types';

type GanttElement = {
  id: string;
  type: 'partida' | 'item' | 'activity';
  parent_id: string | null;
  project_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  weight?: number;
  sort_order?: number;
  created_at?: string;
};

export const revalidate = 60; // ISR cache por 60 segundos
export const dynamicParams = true;

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  
  const projectsSnap = await adminDb.collection('projects').where('share_token', '==', token).limit(1).get();
  const project = projectsSnap.empty ? null : projectsSnap.docs[0].data();

  return {
    title: project ? `${project.name} — Avance del Proyecto` : 'Proyecto no encontrado',
    description: project?.description || 'Vista pública del avance del proyecto y métricas de ejecución.',
    openGraph: {
      title: project ? `${project.name} — Avance del Proyecto` : 'Proyecto no encontrado',
      description: project?.description || 'Consulta el avance actualizado de este proyecto.',
      type: 'website',
    }
  };
}

/**
 * Public share page — accessible without authentication.
 * Shows a read-only S-Curve chart for the project.
 */
export default async function SharePage({ params }: Props) {
  const { token } = await params;

  // Fetch project by share token
  const projectsSnap = await adminDb.collection('projects').where('share_token', '==', token).limit(1).get();
  
  if (projectsSnap.empty) {
    notFound();
  }
  
  const project = { id: projectsSnap.docs[0].id, ...projectsSnap.docs[0].data() } as any;

  // Fetch gantt elements
  const ganttSnap = await adminDb.collection('gantt_elements')
    .where('project_id', '==', project.id)
    .orderBy('sort_order')
    .get();

  const elements = ganttSnap.docs.map(d => ({ id: d.id, ...d.data() } as GanttElement));

  const partidasRaw = elements.filter((e) => e.type === 'partida');
  const itemsRaw = elements.filter((e) => e.type === 'item');
  const activitiesRaw = elements.filter((e) => e.type === 'activity');

  const partidas: PartidaWithItems[] = partidasRaw.map((p) => ({
    id: p.id,
    project_id: project.id,
    name: p.name,
    sort_order: p.sort_order ?? 0,
    created_at: '',
    items: itemsRaw
      .filter((i) => i.parent_id === p.id)
      .map((i) => ({
        id: i.id,
        partida_id: p.id,
        name: i.name,
        sort_order: i.sort_order ?? 0,
        created_at: '',
        activities: activitiesRaw
          .filter((a) => a.parent_id === i.id)
          .map((a) => ({
            id: a.id,
            item_id: i.id,
            name: a.name,
            start_date: a.start_date ?? '',
            end_date: a.end_date ?? '',
            weight: a.weight ?? 1,
            sort_order: a.sort_order ?? 0,
            created_at: '',
            updated_at: '',
          })),
      })),
  }));

  // Fetch daily progress
  const activityIds = activitiesRaw.map((a) => a.id);
  let dailyProgress: DailyProgress[] = [];

  if (activityIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < activityIds.length; i += 10) {
      chunks.push(activityIds.slice(i, i + 10));
    }
    const progressSnaps = await Promise.all(
      chunks.map((chunk) =>
        adminDb.collection('daily_progress').where('activity_id', 'in', chunk).orderBy('date').get()
      )
    );
    dailyProgress = progressSnaps.flatMap((snap) =>
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as DailyProgress))
    );
  }

  // Fetch milestones
  const milestonesSnap = await adminDb.collection('project_milestones')
    .where('project_id', '==', project.id)
    .orderBy('date')
    .get();
  const milestones = milestonesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Detect RLS Block issue: No longer applicable for Firebase Admin, but we can keep variable for logic
  const isRLSBlocked = false;

  // Calculate SCurve Data for Executive Summary
  const flatActivities = (partidas || [])
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    .flatMap((p: any) => p.items || [])
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    .flatMap((i: any) => i.activities || []);

  let effectiveStart = project.start_date;
  let effectiveEnd = project.end_date;
  if (flatActivities.length > 0) {
    const actStarts = flatActivities.map(a => a.start_date).filter(Boolean);
    const actEnds = flatActivities.map(a => a.end_date).filter(Boolean);
    if (actStarts.length > 0) {
      const minStart = actStarts.sort()[0];
      if (minStart < effectiveStart) effectiveStart = minStart;
    }
    if (actEnds.length > 0) {
      const maxEnd = actEnds.sort().reverse()[0];
      if (maxEnd > effectiveEnd) effectiveEnd = maxEnd;
    }
  }

  const effectiveProject = { ...project, start_date: effectiveStart, end_date: effectiveEnd };

  const scurveData = calculateSCurve(
    effectiveStart,
    effectiveEnd,
    flatActivities,
    dailyProgress
  );

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 bg-surface-50">
      <div className="max-w-[1600px] w-full mx-auto fade-in">

        {isRLSBlocked && (
          <div className="bg-red-500/10 border-l-4 border-red-500 text-red-700 p-4 mb-8 rounded-r-lg">
            <h3 className="font-bold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Acceso a Lectura Bloqueado (Seguridad Supabase)
            </h3>
            <p className="mt-2 text-sm text-red-600/90">
              La solicitud de este enlace externo al servidor fue rechazada. Supabase bloquea por defecto la lectura de tus tareas (0 partidas recibidas) mediante sus Políticas RLS para usuarios externos sin cuenta (Anonymous). <br /><br />
              <strong>¡OBLIGATORIO PARA PRODUCCIÓN!</strong> <br />
              Para solucionarlo: En el archivo del proyecto <strong><code>public_read_access_fix.sql</code></strong>, copia todo el SQL que he programado y córrelo en la pestaña &quot;SQL Editor&quot; de tu plataforma Supabase. Eso deseará acceso de lectura &quot;Reader&quot; a cualquier invitado válido que porte un Link seguro.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 bg-white p-6 rounded-2xl shadow-sm border border-surface-700">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary-600 to-primary-400 shadow-md shadow-primary-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-surface-100">{project.name}</h1>
            </div>
            {project.description && (
              <p className="text-sm text-surface-200/80 max-w-2xl">{project.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <span className="px-3 py-1 text-[11px] font-bold tracking-wide uppercase rounded-full bg-accent-400/10 text-accent-500 border border-accent-400/20">
              Vista de Cliente — Solo Lectura
            </span>
            <div className="text-xs text-surface-200/60 font-medium">
              {format(parseISO(effectiveStart), 'dd MMM yyyy', { locale: es })} → {format(parseISO(effectiveEnd), 'dd MMM yyyy', { locale: es })}
            </div>
          </div>
        </div>

        {/* Resumen Ejecutivo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border border-surface-700 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-wider text-surface-200 font-bold mb-1">Avance Programado</span>
            <span className="text-2xl font-bold text-surface-100">{scurveData.currentPlanned}%</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-surface-700 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-wider text-surface-200 font-bold mb-1">Avance Real</span>
            <span className={`text-2xl font-bold ${scurveData.currentActual >= scurveData.currentPlanned ? 'text-success-600' : 'text-danger-600'}`}>
              {scurveData.currentActual}%
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-surface-700 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-wider text-surface-200 font-bold mb-1">Estado (SPI)</span>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${scurveData.spiIndex >= 1 ? 'text-success-600' : scurveData.spiIndex >= 0.9 ? 'text-warning-600' : 'text-danger-600'}`}>
                {scurveData.spiIndex.toFixed(2)}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${scurveData.spiIndex >= 1 ? 'bg-success-50 text-success-700 border border-success-200' : scurveData.spiIndex >= 0.9 ? 'bg-warning-50 text-warning-700 border border-warning-200' : 'bg-danger-50 text-danger-700 border border-danger-200'}`}>
                {scurveData.spiIndex >= 1 ? 'Adelantado' : scurveData.spiIndex >= 0.9 ? 'En Riesgo' : 'Retrasado'}
              </span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-surface-700 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-wider text-surface-200 font-bold mb-1">Días Restantes</span>
            <span className="text-2xl font-bold text-surface-100">
              {Math.max(0, differenceInDays(parseISO(effectiveEnd), new Date()))}
            </span>
          </div>
        </div>

        <div className="mt-8">
          <ShareContentTabs 
            project={effectiveProject} 
            partidas={partidas || []} 
            dailyProgress={dailyProgress} 
            milestones={milestones || []}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-xs font-medium text-surface-200/70">
            Reporte desarrollado por{' '}
            <a 
              href="https://wa.me/51975226913" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-bold text-primary-500 hover:text-primary-400 hover:underline transition-colors"
            >
              Kevin Avalos
            </a>
            {' '}· Control de Proyectos
          </p>
        </div>
      </div>
    </main>
  );
}
