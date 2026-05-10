'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function setProjectBaseline(projectId: string) {
  const supabase = await createClient();

  // Validate owner
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'No autorizado' };

  const { data: project } = await supabase
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .single();

  if (!project || project.owner_id !== user.id) {
    return { success: false, error: 'Solo el dueño puede fijar la línea base' };
  }

  // To set the baseline, we need to copy start_date -> baseline_start and end_date -> baseline_end
  // for all activities that belong to items that belong to partidas that belong to the project.
  
  // 1. Get all activities for the project
  const { data: partidas, error: partidasError } = await supabase
    .from('partidas')
    .select('items(activities(*))')
    .eq('project_id', projectId);

  if (partidasError || !partidas) {
    return { success: false, error: 'Error al obtener actividades' };
  }

  // Flatten the activities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activitiesToUpdate: any[] = [];
  
  for (const p of partidas) {
    if (!p.items) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const i of p.items as any[]) {
      if (!i.activities) continue;
      for (const a of i.activities) {
        if (a.start_date && a.end_date) {
          activitiesToUpdate.push(a);
        }
      }
    }
  }

  if (activitiesToUpdate.length === 0) {
    return { success: true, message: 'No hay actividades para fijar' };
  }

  // Using a loop to update since Supabase doesn't support UPDATE a = b without RPC.
  // This is acceptable for a few hundred activities and only runs once manually.
  const updates = activitiesToUpdate.map(act => ({
    ...act,
    baseline_start: act.start_date,
    baseline_end: act.end_date,
    updated_at: new Date().toISOString()
  }));

  const { error: upsertError } = await supabase
    .from('activities')
    .upsert(updates, { onConflict: 'id', ignoreDuplicates: false });

  if (upsertError) {
    return { success: false, error: 'Error al guardar la línea base: ' + upsertError.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
