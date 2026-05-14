import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { triggerProjectAlerts } from '@/app/actions/alerts';
import { compressImage } from '@/lib/utils/imageCompression';
import { EditedValues, EnhancedActivity, EnhancedPartida } from './types';
import { useFirebase } from '@/hooks/useFirebase';
import { doc, writeBatch } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface UsePulseSaveProps {
  projectId: string;
  selectedDate: string;
  activeActivitiesByPartida: EnhancedPartida[];
  onSaveSuccess: () => void;
}

export function usePulseSave({ 
  projectId, 
  selectedDate, 
  activeActivitiesByPartida, 
  onSaveSuccess 
}: UsePulseSaveProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { auth, db } = useFirebase();
  const router = useRouter();

  const handleSaveAll = async (editedValues: EditedValues) => {
    if (isSubmitting) return;
    
    const activitiesToSave = Object.keys(editedValues).filter(id => {
      const val = editedValues[id];
      return val.percent !== '' || val.notes !== '' || val.files.length > 0 || val.hasRestriction !== undefined || val.restrictionReason !== '';
    });

    if (activitiesToSave.length === 0) {
      setError("No hay cambios para guardar.");
      return;
    }

    setIsSubmitting(true);
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Usuario no autenticado');

      const batchRecords: any[] = [];
      const photoUploads: { activityId: string, files: File[] }[] = [];

      for (const activityId of activitiesToSave) {
        const { percent, notes, files, hasRestriction, restrictionReason } = editedValues[activityId];
        
        let activityInfo: EnhancedActivity | null = null;
        activeActivitiesByPartida.forEach((p) => {
          p.items.forEach((i) => {
            const found = i.activities.find((a) => a.id === activityId);
            if (found) activityInfo = found;
          });
        });

        if (!activityInfo) continue;
        const info = activityInfo as EnhancedActivity;

        const proposedPercent = parseFloat(percent || '0');
        const previousTodayPercent = info.existingTodayPercent ? Number(info.existingTodayPercent) : 0;
        const accumulatedWithoutToday = info.totalProgress - previousTodayPercent;

        if (accumulatedWithoutToday + proposedPercent > 100) {
          throw new Error(`Progreso inválido en "${info.name}". Acumulado > 100%.`);
        }

        if (files && files.length > 0) {
          photoUploads.push({ activityId, files });
        }

        const finalPercent = percent !== '' && percent !== undefined ? parseFloat(percent) : (info.existingTodayPercent || 0);
        const finalNotes = notes !== '' && notes !== undefined ? notes : info.existingTodayNotes || null;
        const finalRestriction = hasRestriction !== undefined ? hasRestriction : info.existingTodayRestriction || false;
        const finalReason = restrictionReason !== '' && restrictionReason !== undefined ? restrictionReason : info.existingTodayRestrictionReason || null;

        batchRecords.push({
          activity_id: activityId,
          date: selectedDate,
          progress_percent: finalPercent,
          notes: finalNotes || '',
          created_by: user.uid,
          photo_urls: info.existingTodayPhotos || [],
          has_restriction: finalRestriction,
          restriction_reason: finalReason || '',
          created_at: new Date().toISOString()
        });
      }

      // Phase 1: Upload Photos
      const storage = getStorage();
      for (const upload of photoUploads) {
        const record = batchRecords.find(r => r.activity_id === upload.activityId);
        if (!record) continue;

        const photoUrls: string[] = [];
        for (const file of upload.files) {
          const compressedFile = await compressImage(file);
          const fileName = `${projectId}/${upload.activityId}/${selectedDate}_${Math.random().toString(36).substring(7)}.webp`;
          const storageRef = ref(storage, `evidence/${fileName}`);
          
          await uploadBytes(storageRef, compressedFile);
          const downloadUrl = await getDownloadURL(storageRef);
          photoUrls.push(downloadUrl);
        }
        record.photo_urls = [...record.photo_urls, ...photoUrls];
      }

      // Phase 2: Massive Batch Upsert to Firebase
      // Using composite ID to ensure upsert behavior similar to Postgres composite unique key
      const batch = writeBatch(db);
      for (const record of batchRecords) {
        const docId = `${record.activity_id}_${record.date}`;
        const ref = doc(db, 'daily_progress', docId);
        batch.set(ref, record, { merge: true });
      }
      await batch.commit();

      onSaveSuccess();
      triggerProjectAlerts(projectId).catch(console.error);
      router.refresh();

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar los avances.');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  return { handleSaveAll, loading, error, setError };
}
