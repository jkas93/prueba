import { adminDb } from '@/lib/firebase/server';
import { getTokens } from 'next-firebase-auth-edge';
import { cookies } from 'next/headers';
import { NewProjectButton } from '@/components/dashboard/NewProjectButton';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { calculateSCurve } from '@/lib/scurve';
import { FIREBASE_AUTH_CONFIG } from '@/lib/auth/config';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const tokens = await getTokens(cookieStore, FIREBASE_AUTH_CONFIG);

  if (!tokens) return null;
  const user = tokens.decodedToken;

  const userDoc = await adminDb.collection('users').doc(user.uid).get();
  const profile = userDoc.data();
  const isSuperadmin = profile?.system_role === 'superadmin';

  type ProjectData = {
    id: string;
    name: string;
    description: string | null;
    start_date: string;
    end_date: string;
    status: string;
    created_at: string;
    owner_id: string;
    userRole: 'owner' | 'superadmin' | 'admin' | 'editor' | 'viewer';
  };

  let allProjects: ProjectData[] = [];

  if (isSuperadmin) {
    const projectsSnap = await adminDb.collection('projects').orderBy('created_at', 'desc').get();
    allProjects = projectsSnap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<ProjectData, 'id' | 'userRole'>),
      userRole: doc.data().owner_id === user.uid ? 'owner' : 'superadmin'
    })) as ProjectData[];
  } else {
    // Fetch projects where user is owner or member
    const ownedSnap = await adminDb.collection('projects').where('owner_id', '==', user.uid).get();
    const memberSnap = await adminDb.collection('projects').where('members', 'array-contains', user.uid).get();

    const ownedProjects = ownedSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<ProjectData, 'id' | 'userRole'>), userRole: 'owner' as const }));
    const memberProjects = memberSnap.docs
      .filter(doc => doc.data().owner_id !== user.uid)
      .map(doc => ({ id: doc.id, ...(doc.data() as Omit<ProjectData, 'id' | 'userRole'>), userRole: 'editor' as const })); // Defaults to editor if member

    allProjects = [...ownedProjects, ...memberProjects].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) as ProjectData[];
  }

  // PRE-FETCH OPTIMIZADO
  const projectIds = allProjects.map(p => p.id);

  // 1. Fetch de Alertas
  const unreadAlertsMap: Record<string, number> = {};
  if (projectIds.length > 0) {
    // Firestore 'in' query supports max 10 values. We chunk it.
    const chunkedIds = [];
    for (let i = 0; i < projectIds.length; i += 10) {
      chunkedIds.push(projectIds.slice(i, i + 10));
    }
    for (const chunk of chunkedIds) {
      const alertsSnap = await adminDb.collection('alerts')
        .where('project_id', 'in', chunk)
        .where('is_read', '==', false)
        .get();
      alertsSnap.docs.forEach(doc => {
        const pid = doc.data().project_id;
        unreadAlertsMap[pid] = (unreadAlertsMap[pid] || 0) + 1;
      });
    }
  }

  // 2. Fetch de Actividades y Daily Progress
  const activitiesByProject: Record<string, any[]> = {};
  const allActivityIds: string[] = [];

  if (projectIds.length > 0) {
    const chunkedIds = [];
    for (let i = 0; i < projectIds.length; i += 10) {
      chunkedIds.push(projectIds.slice(i, i + 10));
    }
    
    for (const chunk of chunkedIds) {
      const activitiesSnap = await adminDb.collection('gantt_elements')
        .where('project_id', 'in', chunk)
        .where('type', '==', 'activity')
        .get();
      
      activitiesSnap.docs.forEach(doc => {
        const act = { id: doc.id, ...doc.data() } as { id: string; project_id: string; [key: string]: unknown };
        const pid = act.project_id;
        if (!activitiesByProject[pid]) activitiesByProject[pid] = [];
        activitiesByProject[pid].push(act);
        allActivityIds.push(doc.id);
      });
    }
  }

  // 3. Fetch de Daily Progress
  const allDailyProgress: any[] = [];
  if (allActivityIds.length > 0) {
    const chunkedActIds = [];
    for (let i = 0; i < allActivityIds.length; i += 10) {
      chunkedActIds.push(allActivityIds.slice(i, i + 10));
    }

    for (const chunk of chunkedActIds) {
      const dpSnap = await adminDb.collection('daily_progress')
        .where('activity_id', 'in', chunk)
        .get();
      allDailyProgress.push(...dpSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
  }

  const dailyProgressByActivity = allDailyProgress.reduce((acc: Record<string, any[]>, dp: any) => {
    if (!acc[dp.activity_id]) acc[dp.activity_id] = [];
    acc[dp.activity_id].push(dp);
    return acc;
  }, {});

  // 4. Precalcular Métricas + Fechas efectivas
  const projectsWithMetrics = allProjects.map(project => {
    const activities = activitiesByProject[project.id] || [];
    const dailyProgress = activities.flatMap(a => dailyProgressByActivity[a.id] || []);
    
    // Calcular fechas efectivas desde las actividades reales
    let effectiveStart = project.start_date;
    let effectiveEnd = project.end_date;
    if (activities.length > 0) {
      const activityStarts = activities.map((a: { start_date: string }) => a.start_date).filter(Boolean);
      const activityEnds = activities.map((a: { end_date: string }) => a.end_date).filter(Boolean);
      if (activityStarts.length > 0) effectiveStart = activityStarts.sort()[0];
      if (activityEnds.length > 0) effectiveEnd = activityEnds.sort().reverse()[0];
      // Use whichever is earlier/later between project dates and activity dates
      if (effectiveStart > project.start_date) effectiveStart = project.start_date;
      if (effectiveEnd < project.end_date) effectiveEnd = project.end_date;
    }

    const scurveData = calculateSCurve(
      effectiveStart,
      effectiveEnd,
      activities,
      dailyProgress
    );

    return {
      ...project,
      effective_start_date: effectiveStart,
      effective_end_date: effectiveEnd,
      unreadAlerts: unreadAlertsMap[project.id] || 0,
      scurveData
    };
  });

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-surface-100">Mis Proyectos</h1>
          <p className="text-sm text-surface-200/60 mt-1">
            {allProjects.length} proyecto{allProjects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <NewProjectButton />
      </div>

      {allProjects.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-accent-400/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-surface-100 mb-2">
            Sin proyectos aún
          </h3>
          <p className="text-sm text-surface-200/60 mb-6">
            Crea tu primer proyecto para comenzar a planificar
          </p>
          <NewProjectButton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projectsWithMetrics.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              unreadAlerts={project.unreadAlerts} 
              scurveData={project.scurveData} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
