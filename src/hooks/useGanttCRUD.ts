import { useCallback, useState } from 'react';
import { useFirebase } from './useFirebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { GanttDbType } from '@/lib/gantt/types';
import { toDbEndDate } from '@/lib/gantt/date-utils';

interface CrudResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

export function useGanttCRUD() {
  const { db } = useFirebase();
  const [isProcessing, setIsProcessing] = useState(false);

  const createTask = useCallback(async (
    type: GanttDbType,
    projectId: string,
    parentId: string | null,
    ganttTask: Record<string, unknown>,
    sortOrder: number
  ): Promise<CrudResult> => {
    setIsProcessing(true);
    try {
      const insertData: Record<string, unknown> = {
        project_id: projectId,
        type: type,
        name: String(ganttTask.text),
        sort_order: sortOrder,
        parent_id: type === 'partida' ? null : (type === 'item' ? parentId?.replace('p_', '') : parentId?.replace('i_', '')),
        created_at: new Date().toISOString()
      };

      if (type === 'activity') {
        insertData.start_date = ganttTask.start_date ? new Date(String(ganttTask.start_date)).toISOString().split('T')[0] : null;
        insertData.end_date = ganttTask.end_date ? toDbEndDate(String(ganttTask.end_date)) : null;
        insertData.weight = 1;
        insertData.updated_at = new Date().toISOString();
      }

      // Se guarda en una coleccion unificada para Gantt
      const docRef = await addDoc(collection(db, 'gantt_elements'), insertData);
      
      return { success: true, data: { id: docRef.id, ...insertData } };
    } catch (err: unknown) {
      console.error(`Error creating ${type}:`, err);
      return { success: false, error: extractErrorMessage(err) };
    } finally {
      setIsProcessing(false);
    }
  }, [db]);

  const updateTask = useCallback(async (
    type: GanttDbType,
    dbId: string,
    updates: Record<string, unknown>
  ): Promise<CrudResult> => {
    setIsProcessing(true);
    try {
      const docRef = doc(db, 'gantt_elements', dbId);
      if (type === 'activity') {
        updates.updated_at = new Date().toISOString();
      }
      await updateDoc(docRef, updates);
      return { success: true };
    } catch (err: unknown) {
      console.error(`Error updating ${type}:`, err);
      return { success: false, error: extractErrorMessage(err) };
    } finally {
      setIsProcessing(false);
    }
  }, [db]);

  const deleteTask = useCallback(async (
    type: GanttDbType,
    dbId: string
  ): Promise<CrudResult> => {
    setIsProcessing(true);
    try {
      // NOTA: Firebase no tiene "ON DELETE CASCADE".
      // Si borras una partida, deberías borrar sus items y actividades.
      // Por simplicidad en este CRUD, se asume que una Cloud Function o un query buscará los hijos para borrarlos.
      await deleteDoc(doc(db, 'gantt_elements', dbId));
      return { success: true };
    } catch (err: unknown) {
      console.error(`Error deleting ${type}:`, err);
      return { success: false, error: extractErrorMessage(err) };
    } finally {
      setIsProcessing(false);
    }
  }, [db]);

  const reorderSiblings = useCallback(async (
    type: GanttDbType,
    siblingDbIds: string[]
  ): Promise<CrudResult> => {
    setIsProcessing(true);
    try {
      // Reemplazo del RPC 'batch_update_sort_orders' usando un WriteBatch de Firestore
      const batch = writeBatch(db);
      
      siblingDbIds.forEach((id, index) => {
        const docRef = doc(db, 'gantt_elements', id);
        batch.update(docRef, { sort_order: index });
      });

      await batch.commit();
      return { success: true };
    } catch (err: unknown) {
      console.error(`Error reordering ${type}s:`, err);
      return { success: false, error: extractErrorMessage(err) };
    } finally {
      setIsProcessing(false);
    }
  }, [db]);

  return {
    isProcessing,
    createTask,
    updateTask,
    deleteTask,
    reorderSiblings
  };
}
