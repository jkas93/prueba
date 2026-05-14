import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminDb, adminAuth } from '@/lib/firebase/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const results: any = {};

    // 1. Migrar Perfiles (users)
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
      const batch = adminDb.batch();
      for (const profile of profiles) {
        // Asegurarse de que el usuario exista en Auth
        try {
          await adminAuth.getUser(profile.id);
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            await adminAuth.createUser({
              uid: profile.id,
              email: profile.email || `${profile.id}@placeholder.com`,
              displayName: profile.full_name || '',
            });
          }
        }
        
        // Crear documento en Firestore
        const userRef = adminDb.collection('users').doc(profile.id);
        batch.set(userRef, {
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          system_role: profile.system_role || 'user',
          email: profile.email || '',
          created_at: profile.created_at,
        }, { merge: true });
      }
      await batch.commit();
      results.users = profiles.length;
    }

    // 2. Migrar Proyectos
    const { data: projects } = await supabase.from('projects').select('*');
    if (projects) {
      const batch = adminDb.batch();
      for (const project of projects) {
        const pRef = adminDb.collection('projects').doc(project.id);
        batch.set(pRef, {
          name: project.name,
          description: project.description || '',
          start_date: project.start_date,
          end_date: project.end_date,
          owner_id: project.owner_id,
          share_token: project.share_token,
          created_at: project.created_at,
          updated_at: project.updated_at || project.created_at,
          members: [] // Se llenará en el siguiente paso
        }, { merge: true });
      }
      await batch.commit();
      results.projects = projects.length;
    }

    // 3. Migrar Miembros de Proyectos y Roles
    const { data: members } = await supabase.from('project_members').select('*');
    if (members) {
      const projectMembersMap: Record<string, string[]> = {};
      const batch = adminDb.batch();
      
      for (const m of members) {
        if (!projectMembersMap[m.project_id]) projectMembersMap[m.project_id] = [];
        projectMembersMap[m.project_id].push(m.user_id);

        const roleRef = adminDb.collection('project_member_roles').doc(`${m.project_id}_${m.user_id}`);
        batch.set(roleRef, {
          project_id: m.project_id,
          user_id: m.user_id,
          role: m.role,
        }, { merge: true });
      }

      // Actualizar el array members en projects
      for (const [projectId, userIds] of Object.entries(projectMembersMap)) {
        const pRef = adminDb.collection('projects').doc(projectId);
        batch.update(pRef, { members: userIds });
      }
      await batch.commit();
      results.members = members.length;
    }

    // 4. Migrar Gantt Elements (Partidas -> Items -> Activities)
    const { data: partidas } = await supabase.from('partidas').select('*');
    const { data: items } = await supabase.from('items').select('*');
    const { data: activities } = await supabase.from('activities').select('*');

    let ganttCount = 0;
    if (partidas && items && activities) {
      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = adminDb.batch();
      let opCount = 0;

      const commitBatch = async () => {
        batches.push(currentBatch);
        currentBatch = adminDb.batch();
        opCount = 0;
      };

      for (const p of partidas) {
        const ref = adminDb.collection('gantt_elements').doc(p.id);
        currentBatch.set(ref, {
          type: 'partida',
          project_id: p.project_id,
          parent_id: null,
          name: p.name,
          sort_order: p.sort_order,
          created_at: p.created_at
        });
        opCount++;
        ganttCount++;
        if (opCount >= 450) await commitBatch();
      }

      for (const i of items) {
        // Encontrar a qué proyecto pertenece
        const partida = partidas.find(p => p.id === i.partida_id);
        if (!partida) continue;

        const ref = adminDb.collection('gantt_elements').doc(i.id);
        currentBatch.set(ref, {
          type: 'item',
          project_id: partida.project_id,
          parent_id: i.partida_id,
          name: i.name,
          sort_order: i.sort_order,
          created_at: i.created_at
        });
        opCount++;
        ganttCount++;
        if (opCount >= 450) await commitBatch();
      }

      for (const a of activities) {
        // Encontrar proyecto
        const item = items.find(i => i.id === a.item_id);
        if (!item) continue;
        const partida = partidas.find(p => p.id === item.partida_id);
        if (!partida) continue;

        const ref = adminDb.collection('gantt_elements').doc(a.id);
        currentBatch.set(ref, {
          type: 'activity',
          project_id: partida.project_id,
          parent_id: a.item_id,
          name: a.name,
          start_date: a.start_date,
          end_date: a.end_date,
          weight: a.weight,
          sort_order: a.sort_order,
          created_at: a.created_at
        });
        opCount++;
        ganttCount++;
        if (opCount >= 450) await commitBatch();
      }

      if (opCount > 0) batches.push(currentBatch);
      for (const b of batches) await b.commit();
      
      results.ganttElements = ganttCount;
    }

    // 5. Migrar Daily Progress
    const { data: progress } = await supabase.from('daily_progress').select('*');
    if (progress && progress.length > 0) {
      const batches = [];
      let currentBatch = adminDb.batch();
      let opCount = 0;

      for (const dp of progress) {
        const ref = adminDb.collection('daily_progress').doc(dp.id);
        currentBatch.set(ref, dp);
        opCount++;
        if (opCount >= 450) {
          batches.push(currentBatch);
          currentBatch = adminDb.batch();
          opCount = 0;
        }
      }
      if (opCount > 0) batches.push(currentBatch);
      for (const b of batches) await b.commit();
      results.dailyProgress = progress.length;
    }

    // 6. Migrar Milestones
    const { data: milestones } = await supabase.from('project_milestones').select('*');
    if (milestones && milestones.length > 0) {
      const batch = adminDb.batch();
      for (const m of milestones) {
        const ref = adminDb.collection('project_milestones').doc(m.id);
        batch.set(ref, m);
      }
      await batch.commit();
      results.milestones = milestones.length;
    }

    // 7. Migrar Alertas
    const { data: alerts } = await supabase.from('alerts').select('*');
    if (alerts && alerts.length > 0) {
      const batches = [];
      let currentBatch = adminDb.batch();
      let opCount = 0;

      for (const a of alerts) {
        const ref = adminDb.collection('alerts').doc(a.id);
        currentBatch.set(ref, a);
        opCount++;
        if (opCount >= 450) {
          batches.push(currentBatch);
          currentBatch = adminDb.batch();
          opCount = 0;
        }
      }
      if (opCount > 0) batches.push(currentBatch);
      for (const b of batches) await b.commit();
      results.alerts = alerts.length;
    }

    return NextResponse.json({ success: true, message: "Migración completada", results });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
