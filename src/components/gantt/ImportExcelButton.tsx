'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useFirebase } from '@/hooks/useFirebase';
import { doc, collection, writeBatch } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

interface Props {
  projectId: string;
}

export function ImportExcelButton({ projectId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { db } = useFirebase();
  const router = useRouter();

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Tipo: 'Partida', Nombre: 'Estructuras', Inicio: '', Fin: '', Peso: '' },
      { Tipo: 'Item', Nombre: 'Zapatas', Inicio: '', Fin: '', Peso: '' },
      { Tipo: 'Actividad', Nombre: 'Excavación manual', Inicio: '2024-05-01', Fin: '2024-05-05', Peso: '1' },
      { Tipo: 'Actividad', Nombre: 'Vaciado de concreto', Inicio: '2024-05-06', Fin: '2024-05-07', Peso: '2' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_cronograma.xlsx");
  };

  const processFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, string | number>[];

      if (rows.length === 0) {
        throw new Error('El archivo Excel está vacío.');
      }

      let currentPartidaId: string | null = null;
      let currentItemId: string | null = null;

      let partidaSortOrder = 0;
      let itemSortOrder = 0;
      let activitySortOrder = 0;

      const batch = writeBatch(db);
      let batchCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const tipo = (row['Tipo'] || '').toString().trim().toLowerCase();
        const nombre = (row['Nombre'] || '').toString().trim();
        const inicio = (row['Inicio'] || '').toString().trim();
        const fin = (row['Fin'] || '').toString().trim();
        const peso = parseFloat(String(row['Peso'] ?? 1)) || 1;

        if (!tipo || !nombre) continue;

        if (tipo === 'partida') {
          const docRef = doc(collection(db, 'gantt_elements'));
          currentPartidaId = docRef.id;
          currentItemId = null;
          itemSortOrder = 0;

          batch.set(docRef, {
            project_id: projectId,
            type: 'partida',
            parent_id: null,
            name: nombre,
            sort_order: partidaSortOrder++,
            created_at: new Date().toISOString()
          });
          batchCount++;
        } else if (tipo === 'item') {
          if (!currentPartidaId) {
            const pRef = doc(collection(db, 'gantt_elements'));
            currentPartidaId = pRef.id;
            batch.set(pRef, {
              project_id: projectId,
              type: 'partida',
              parent_id: null,
              name: 'Partida por Defecto',
              sort_order: partidaSortOrder++,
              created_at: new Date().toISOString()
            });
            batchCount++;
          }
          const iRef = doc(collection(db, 'gantt_elements'));
          currentItemId = iRef.id;
          activitySortOrder = 0;

          batch.set(iRef, {
            project_id: projectId,
            type: 'item',
            parent_id: currentPartidaId,
            name: nombre,
            sort_order: itemSortOrder++,
            created_at: new Date().toISOString()
          });
          batchCount++;

        } else if (tipo === 'actividad' || tipo === 'activity') {
          if (!currentItemId) {
            if (!currentPartidaId) {
              const pRef = doc(collection(db, 'gantt_elements'));
              currentPartidaId = pRef.id;
              batch.set(pRef, {
                project_id: projectId,
                type: 'partida',
                parent_id: null,
                name: 'Partida por Defecto',
                sort_order: partidaSortOrder++,
                created_at: new Date().toISOString()
              });
              batchCount++;
            }
            const iRef = doc(collection(db, 'gantt_elements'));
            currentItemId = iRef.id;
            batch.set(iRef, {
              project_id: projectId,
              type: 'item',
              parent_id: currentPartidaId,
              name: 'Ítem por Defecto',
              sort_order: itemSortOrder++,
              created_at: new Date().toISOString()
            });
            batchCount++;
          }

          let startDate = inicio || new Date().toISOString().split('T')[0];
          let endDate = fin || new Date().toISOString().split('T')[0];

          if (!isNaN(Number(startDate)) && String(startDate).indexOf('-') === -1) {
            const dateObj = new Date((Number(startDate) - (25567 + 2)) * 86400 * 1000);
            startDate = dateObj.toISOString().split('T')[0];
          }
          if (!isNaN(Number(endDate)) && String(endDate).indexOf('-') === -1) {
            const dateObj = new Date((Number(endDate) - (25567 + 2)) * 86400 * 1000);
            endDate = dateObj.toISOString().split('T')[0];
          }

          const aRef = doc(collection(db, 'gantt_elements'));
          batch.set(aRef, {
            project_id: projectId,
            type: 'activity',
            parent_id: currentItemId,
            name: nombre,
            start_date: startDate,
            end_date: endDate,
            weight: peso,
            sort_order: activitySortOrder++,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          batchCount++;
        }

        if (batchCount >= 400) {
          throw new Error('Archivo demasiado grande para una sola transacción en Firebase (>400 elementos). Redúcelo.');
        }
      }

      await batch.commit();
      router.refresh(); 
    } catch (err: unknown) {
      console.error(err);
      setError((err instanceof Error ? err.message : String(err)) || 'Ocurrió un error al procesar el archivo Excel.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      <button
        onClick={handleDownloadTemplate}
        disabled={loading}
        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 border-accent-400/40 text-accent-600 bg-accent-400/10 hover:bg-accent-400 hover:text-primary-900 transition-all font-semibold whitespace-nowrap"
        title="Descargar Plantilla Excel"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        <span className="hidden md:inline">Plantilla</span>
      </button>

      <label className={`btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`} title="Importar">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <span className="hidden sm:inline">{loading ? 'Importando...' : 'Importar'}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          className="hidden"
          onChange={processFile}
        />
      </label>
      {error && <span className="absolute mt-10 right-0 text-danger-400 text-[10px] truncate max-w-[200px]" title={error}>{error}</span>}
    </div>
  );
}
