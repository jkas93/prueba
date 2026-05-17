'use client';

import { useState, useRef, useEffect } from 'react';
import { DeleteProjectButton } from './DeleteProjectButton';
import { ReportExportButton } from './ReportExportButton';
import { TeamModal } from './TeamModal';
import { ShareModal } from './ShareModal';
import { ServicesModal } from './ServicesModal';
import type { PartidaWithItems } from '@/lib/types';

interface ProjectActionsMenuProps {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  project: any;
  partidas?: PartidaWithItems[];
  isOwner: boolean;
}

export function ProjectActionsMenu({ project, partidas = [], isOwner }: ProjectActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 transition-all flex items-center justify-center ${
          isOpen 
            ? 'text-accent-400 scale-110' 
            : 'text-surface-200/40 hover:text-surface-100 hover:scale-110'
        }`}
        title="Opciones del Proyecto"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-surface-900 border border-surface-700/50 rounded-xl shadow-2xl z-[100] overflow-hidden fade-in py-1">
          {/* Section: Management */}
          <div className="py-1">
            <TeamModal 
              projectId={project.id} 
              projectName={project.name} 
              isOwner={isOwner} 
              variant="menuItem" 
            />
            <ShareModal 
              projectId={project.id} 
              initialToken={project.share_token} 
              projectName={project.name} 
              variant="menuItem"
            />
            <ServicesModal
              project={project}
              partidas={partidas}
              isOwner={isOwner}
              variant="menuItem"
            />
          </div>

          <div className="border-t border-surface-800 my-1"></div>

          {/* Section: Output */}
          <div className="py-1">
            <ReportExportButton projectId={project.id} variant="menuItem" />
          </div>

          {isOwner && (
            <>
              <div className="border-t border-surface-800 my-1"></div>
              {/* Section: Danger */}
              <div className="py-1">
                <DeleteProjectButton 
                   projectId={project.id} 
                   projectName={project.name} 
                   variant="menuItem" 
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
