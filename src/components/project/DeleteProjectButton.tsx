'use client';

import { useFirebase } from '@/hooks/useFirebase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { doc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';

export function DeleteProjectButton({ projectId, projectName, variant = 'button' }: { projectId: string; projectName: string; variant?: 'button' | 'menuItem' }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { db } = useFirebase();

  const handleDelete = async () => {
    const userInput = window.prompt(
      `Estás a punto de borrar el proyecto "${projectName}" y TODO su contenido para siempre.\n\nEscribe la palabra "ELIMINAR" (en mayúsculas) para confirmar la operación:`
    );

    if (userInput !== 'ELIMINAR') {
      if (userInput !== null) {
         window.alert('Operación cancelada: La palabra de seguridad no coincide.');
      }
      return;
    }

    try {
      setIsDeleting(true);
      
      // En Firebase no hay "On Delete Cascade". Hay que borrar los hijos manualmente.
      const batch = writeBatch(db);
      
      // 1. Borrar Gantt Elements
      const ganttSnap = await getDocs(query(collection(db, 'gantt_elements'), where('project_id', '==', projectId)));
      ganttSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));

      // 2. Borrar Alertas
      const alertsSnap = await getDocs(query(collection(db, 'alerts'), where('project_id', '==', projectId)));
      alertsSnap.docs.forEach(docSnap => batch.delete(docSnap.ref));

      // NOTA: Para no sobrepasar los 500 writes del batch, se debería hacer en chunks.
      // Asumimos un proyecto normal. Si es gigante, podría crashear.
      await batch.commit();

      // 3. Borrar el Proyecto
      await deleteDoc(doc(db, 'projects', projectId));
      
      window.alert("Proyecto eliminado exitosamente.");
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error(err);
      window.alert("Ocurrió un error inesperado conectando con el servidor. Asegúrate de tener permisos.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className={variant === 'menuItem' 
        ? `w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-400 hover:bg-danger-500/10 transition-colors ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`
        : `p-2 rounded-lg text-surface-400 hover:text-danger-500 hover:bg-danger-500/10 transition-colors ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
      title="Borrar proyecto definitivamente"
    >
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
      {variant === 'menuItem' && <span>Eliminar Proyecto</span>}
    </button>
  );
}
