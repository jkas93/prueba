import { adminDb } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ProjectTabs } from '@/components/project/ProjectTabs';
import { ProjectActionsMenu } from '@/components/project/ProjectActionsMenu';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DailyProgress, Alert } from '@/lib/types';
import { FIREBASE_AUTH_CONFIG } from '@/lib/auth/config';
import { buildPartidaTree, getEffectiveDates } from '@/lib/firebase/data-utils';
import type { GanttElementRaw } from '@/lib/firebase/data-utils';

interface Props {
  params: Promise<{ id: string }>;
}

// Disable ISR caching so edits are always reflected immediately.
export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;

  const cookieStore = await cookies();
  const tokens      = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);

  if (!tokens) notFound();
  const userId = tokens.decodedToken.uid;

  const projectSnap = await adminDb.collection('projects').doc(id).get();
  if (!projectSnap.exists) notFound();
  const project = { id: projectSnap.id, ...projectSnap.data() } as {
    id: string; name: string; description?: string;
    start_date: string; end_date: string; owner_id: string; share_token?: string | null;
  };

  const isOwner = userId === project.owner_id;

  // ── Fetch gantt elements ──────────────────────────────────────
  const ganttSnap = await adminDb
    .collection('gantt_elements')
    .where('project_id', '==', id)
    .orderBy('sort_order')
    .get();

  const elements = ganttSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as GanttElementRaw)
  );

  // ── Build tree + effective dates (shared utility) ────────────
  const partidas       = buildPartidaTree(elements, id);
  const { effectiveStart, effectiveEnd } = getEffectiveDates(
    project.start_date,
    project.end_date,
    partidas
  );

  // ── Fetch daily progress (chunked by 10 — Firestore limit) ───
  const activityIds = elements
    .filter((e) => e.type === 'activity')
    .map((e) => e.id);

  let dailyProgress: DailyProgress[] = [];
  if (activityIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < activityIds.length; i += 10) {
      chunks.push(activityIds.slice(i, i + 10));
    }
    const progressSnaps = await Promise.all(
      chunks.map((chunk) =>
        adminDb
          .collection('daily_progress')
          .where('activity_id', 'in', chunk)
          .orderBy('date')
          .get()
      )
    );
    dailyProgress = progressSnaps.flatMap((snap) =>
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as DailyProgress))
    );
  }

  // ── Alerts + Milestones ───────────────────────────────────────
  const [alertsSnap, milestonesSnap] = await Promise.all([
    adminDb
      .collection('alerts')
      .where('project_id', '==', id)
      .orderBy('created_at', 'desc')
      .limit(20)
      .get(),
    adminDb
      .collection('project_milestones')
      .where('project_id', '==', id)
      .orderBy('date')
      .get(),
  ]);

  const alerts     = alertsSnap.docs.map((d)     => ({ id: d.id, ...d.data() } as unknown as Alert));
  const milestones = milestonesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const effectiveProject = { ...project, start_date: effectiveStart, end_date: effectiveEnd };

  return (
    <div className="p-3 md:p-6 max-w-full mx-auto fade-in">
      <div className="flex flex-col gap-2 mb-4">

        <div className="flex items-center gap-2 text-[10px] md:text-sm text-surface-200/30 uppercase tracking-widest font-bold">
          <Link href="/dashboard" className="hover:text-accent-400 transition-colors">
            Dashboard
          </Link>
          <span className="opacity-50">/</span>
          <span className="text-surface-200/60 truncate max-w-[150px] md:max-w-xs">{project.name}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-surface-100 leading-tight">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-xs text-surface-200/50 mt-0.5 max-w-2xl line-clamp-1">{project.description}</p>
            )}
          </div>

          <div className="flex-shrink-0 pt-0.5">
            <ProjectActionsMenu project={project} partidas={partidas} isOwner={isOwner} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[10px] md:text-xs text-surface-200 bg-white border border-surface-700/50 px-3 py-1.5 rounded-lg flex-shrink-0 shadow-sm font-medium">
            <span className="font-bold mr-1 uppercase tracking-wider text-surface-400">Periodo:</span>{' '}
            {format(parseISO(effectiveStart), 'dd MMM yyyy', { locale: es })}{' '}
            <span className="text-accent-500 font-bold mx-1">→</span>{' '}
            {format(parseISO(effectiveEnd), 'dd MMM yyyy', { locale: es })}
          </div>
        </div>
      </div>

      <ProjectTabs
        project={effectiveProject as import('@/lib/types').Project}
        partidas={partidas}
        dailyProgress={dailyProgress}
        alerts={alerts}
        milestones={milestones}
      />
    </div>
  );
}
