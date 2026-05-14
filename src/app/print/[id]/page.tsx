'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase/client';
import { SCurveChart } from '@/components/charts/SCurveChart';
import { GanttView } from '@/components/gantt/GanttView';
import { use } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import type { PartidaWithItems, DailyProgress } from '@/lib/types';

type Project = {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  owner_id: string;
  share_token?: string | null;
};

type Milestone = { id: string; name: string; date: string };

export default function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [partidas, setPartidas] = useState<PartidaWithItems[]>([]);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // 1. Fetch project
      const projectSnap = await getDoc(doc(db, 'projects', id));
      if (!projectSnap.exists()) { setLoading(false); return; }
      const pData = { id: projectSnap.id, ...projectSnap.data() } as Project;

      // 2. Fetch gantt elements
      const ganttSnap = await getDocs(
        query(collection(db, 'gantt_elements'), where('project_id', '==', id), orderBy('sort_order'))
      );
      const elements = ganttSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<{
        id: string; type: string; parent_id: string | null; name: string;
        start_date?: string; end_date?: string; weight?: number; sort_order?: number;
      }>;

      // Rebuild PartidaWithItems structure from flat elements
      const partidasRaw = elements.filter(e => e.type === 'partida');
      const itemsRaw = elements.filter(e => e.type === 'item');
      const activitiesRaw = elements.filter(e => e.type === 'activity');

      const pList: PartidaWithItems[] = partidasRaw.map(p => ({
        id: p.id,
        project_id: id,
        name: p.name,
        sort_order: p.sort_order ?? 0,
        created_at: '',
        items: itemsRaw
          .filter(i => i.parent_id === p.id)
          .map(i => ({
            id: i.id,
            partida_id: p.id,
            name: i.name,
            sort_order: i.sort_order ?? 0,
            created_at: '',
            activities: activitiesRaw
              .filter(a => a.parent_id === i.id)
              .map(a => ({
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

      // 3. Fetch daily progress
      const activityIds = activitiesRaw.map(a => a.id);
      let dpList: DailyProgress[] = [];
      if (activityIds.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < activityIds.length; i += 10) chunks.push(activityIds.slice(i, i + 10));
        const snaps = await Promise.all(
          chunks.map(chunk => getDocs(query(collection(db, 'daily_progress'), where('activity_id', 'in', chunk))))
        );
        dpList = snaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyProgress)));
      }

      // 4. Fetch milestones
      const msSnap = await getDocs(
        query(collection(db, 'project_milestones'), where('project_id', '==', id), orderBy('date'))
      );
      const msList = msSnap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone));

      setProject(pData);
      setPartidas(pList);
      setDailyProgress(dpList);
      setMilestones(msList);
      setLoading(false);

      setTimeout(() => { window.print(); }, 1500);
    }
    fetchData();
  }, [id]);

  if (loading) return <div className="p-10 text-center"><span className="spinner" /> Generando PDF...</div>;
  if (!project) return <div className="p-10 text-center">Proyecto no encontrado.</div>;

  return (
    <div className="bg-white text-black min-h-screen p-8 print:p-0">
      
      <div className="flex justify-between items-center mb-8 border-b pb-4 border-surface-200/30 print:hidden">
         <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-accent-600">
            Vista de Impresión / PDF
         </h1>
         <button onClick={() => window.print()} className="btn-primary flex gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Imprimir Ahora
         </button>
      </div>

      <div className="max-w-[1200px] mx-auto print:max-w-full">
         
         <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-primary-800 uppercase tracking-widest">{project.name}</h1>
            <p className="text-sm text-surface-400 mt-2 font-medium">REPORTE OFICIAL DE AVANCE</p>
            <p className="text-xs text-surface-400 mt-1">
              {format(parseISO(project.start_date), 'dd MMM yyyy', { locale: es })} → {format(parseISO(project.end_date), 'dd MMM yyyy', { locale: es })}
            </p>
         </div>

         <div className="mb-12 page-break-after">
            <h2 className="text-xl font-bold border-b border-surface-200/30 pb-2 mb-4 text-primary-700">1. Analíticas Curva S (EVM)</h2>
            <div className="h-[400px] rounded-lg border border-surface-200/20 bg-surface-50 p-4 print:border-none print:shadow-none">
              <SCurveChart 
                project={project as import('@/lib/types').Project} 
                partidas={partidas} 
                dailyProgress={dailyProgress} 
                milestones={milestones} 
              />
            </div>
         </div>

         <div className="mb-12">
            <h2 className="text-xl font-bold border-b border-surface-200/30 pb-2 mb-4 text-primary-700">2. Cronograma General (Gantt)</h2>
            <div className="rounded-lg border border-surface-200/20 print:border-none print:shadow-none">
              <GanttView projectId={project.id} partidas={partidas} dailyProgress={dailyProgress} readonly={true} />
            </div>
         </div>

         <div className="mt-20 pt-8 border-t border-surface-200/30 text-center text-xs text-surface-400 font-mono">
            Reporte generado automáticamente por Cronograma Golden Tower Construction.
         </div>

      </div>

      <style>{`
        @media print {
          body { background-color: white !important; color: black !important; }
          .glass-card, .bg-mesh { display: none !important; }
          .page-break-after { page-break-after: always; }
          .gantt_container { border: 1px solid #ddd !important; }
          #__next-build-watcher, .nextjs-toast-errors-parent { display: none !important; }
        }
      `}</style>
    </div>
  );
}
