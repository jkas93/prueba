'use client';

import Link from 'next/link';
import { useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

interface SidebarProps {
  user: {
    email?: string;
  };
  profile: {
    full_name?: string;
    avatar_url?: string;
    system_role?: 'user' | 'superadmin';
  } | null;
}

export function Sidebar({ user, profile }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const userInitial = (profile?.full_name || user.email || 'U').charAt(0).toUpperCase();
  const isInProject = pathname?.startsWith('/project/');

  return (
    <aside 
      className={`hidden md:flex flex-col shrink-0 border-r border-white/5 bg-primary-800/90 backdrop-blur-xl transition-all duration-300 ease-in-out relative shadow-[4px_0_24px_rgba(0,11,28,0.5)] z-[100] ${
        isCollapsed ? 'w-[40px]' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button - Ahora cuenta con ARIA tags para accesibilidad */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
        className={`absolute top-5 w-[18px] h-[18px] bg-accent-500 text-primary-900 rounded-full flex items-center justify-center hover:bg-accent-400 transition-transform z-50 shadow-md border-2 border-primary-800 ${isCollapsed ? '-right-2' : '-right-2.5'}`}
      >
        <svg 
          className={`w-3.5 h-3.5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Brand */}
      <div className={`flex items-center border-b border-white/5 transition-all duration-300 overflow-hidden ${isCollapsed ? 'p-0 h-[56px] justify-center' : 'p-6 justify-start h-[88px]'}`}>
        <Link href="/dashboard" className={`flex items-center gap-3 group ${isCollapsed ? 'justify-center w-full' : 'w-full'}`} title={isCollapsed ? "Cronogramas" : ""}>
          <div className={`${isCollapsed ? 'w-[22px] h-[22px] rounded-md' : 'w-10 h-10 rounded-xl'} shrink-0 bg-gradient-to-br from-accent-500 via-accent-400 to-[#F7C20E] flex items-center justify-center shadow-lg shadow-accent-400/20 group-hover:scale-105 transition-all`}>
            <svg className={`${isCollapsed ? 'w-[12px] h-[12px]' : 'w-5 h-5'} text-primary-800`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isCollapsed ? 2.5 : 2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012-2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          {!isCollapsed && <span className="font-extrabold text-xl gradient-text whitespace-nowrap fade-in-fast tracking-tight">Cronograma</span>}
        </Link>
      </div>

      {/* Quick Context Badge */}
      {isInProject && !isCollapsed && (
        <div className="px-6 pt-5 pb-1 fade-in-fast">
          <div className="px-3 py-1.5 rounded-md bg-accent-500/10 border border-accent-500/20 text-accent-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400 animate-pulse box-shadow-glow"></span>
            Contexto: Proyecto
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 custom-scrollbar ${isCollapsed ? 'py-4 flex flex-col items-center gap-0 w-full' : 'p-4 mt-2 space-y-2'}`}>
        <NavItem 
          href="/dashboard"
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />}
          label={isInProject ? "Mis Proyectos" : "Dashboard"}
          isActive={pathname === '/dashboard' || isInProject}
          isCollapsed={isCollapsed}
        />
        <NavItem 
          href="/profile"
          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />}
          label="Mi Perfil"
          isActive={pathname === '/profile'}
          isCollapsed={isCollapsed}
        />
        {/* ADMIN NAV */}
        {profile?.system_role === 'superadmin' && (
          <NavItem 
            href="/admin"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />}
            label="Gestión de Cuentas"
            isActive={pathname?.startsWith('/admin')}
            isCollapsed={isCollapsed}
          />
        )}
      </nav>

      {/* User section */}
      {/* User section */}
      <div className={`border-t border-white/5 transition-all duration-300 overflow-x-hidden relative z-10 ${isCollapsed ? 'py-4 flex flex-col items-center gap-3 w-full bg-transparent border-t-0' : 'p-4 gap-0 bg-primary-900/40'}`}>
        <div className={`flex items-center w-full ${isCollapsed ? 'justify-center' : 'gap-3'}`} title={isCollapsed ? profile?.full_name || 'Usuario' : ""}>
          <div className={`relative isolate group cursor-pointer shrink-0 ${isCollapsed ? '' : 'mx-auto'}`}>
            <div className="absolute inset-0 bg-accent-400 rounded-full blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300"></div>
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt="User Avatar" width={40} height={40} className={`${isCollapsed ? 'w-[22px] h-[22px]' : 'w-10 h-10'} rounded-full object-cover border-[1px] border-primary-800 shadow-sm relative z-10 transition-all`} />
            ) : (
              <div className={`${isCollapsed ? 'w-[22px] h-[22px] text-[9px] border-[0.5px]' : 'w-10 h-10 text-sm border'} rounded-full bg-gradient-to-br from-accent-400/20 to-accent-500/10 flex items-center justify-center font-bold text-accent-400 border-accent-400/30 shadow-inner relative z-10 transition-all group-hover:scale-105`}>
                {userInitial}
              </div>
            )}
            {!isCollapsed && <span className={`absolute bottom-0 right-[-2px] w-2.5 h-2.5 bg-green-500 border-2 border-primary-900 rounded-full z-20 shadow-sm`} title="En línea"></span>}
          </div>
          
          {!isCollapsed && (
            <div className="flex-1 min-w-0 fade-in-fast cursor-default">
              <p className="text-sm font-semibold text-slate-100 truncate w-[160px] tracking-tight">
                {profile?.full_name || 'Usuario'}
              </p>
              <p className="text-[11px] text-slate-400 truncate w-[160px] font-medium">
                {user.email}
              </p>
            </div>
          )}
        </div>
        
        <div className={`w-full ${isCollapsed ? 'flex justify-center' : 'mt-4'}`}>
          <button
            onClick={async () => {
              await fetch('/api/logout', { method: 'GET' });
              window.location.href = '/login';
            }}
            title={isCollapsed ? "Cerrar Sesión" : ""}
            className={`text-left text-sm font-medium transition-all text-slate-500 hover:text-danger-400 active:scale-95 flex items-center justify-center group ${
              isCollapsed ? 'w-full h-8 rounded-none p-0 mx-auto hover:bg-transparent' : 'w-full rounded-lg px-4 py-2.5 gap-3 hover:bg-danger-500/10'
            }`}
          >
            <svg className={`${isCollapsed ? 'w-[16px] h-[16px]' : 'w-5 h-5'} shrink-0 group-hover:text-danger-400 transition-colors`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isCollapsed ? 1.5 : 2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            {!isCollapsed && <span className="whitespace-nowrap fade-in-fast tracking-wide">Cerrar Sesión</span>}
          </button>
        </div>
      </div>

    </aside>
  );
}

// Sub-component for Navigation Items
function NavItem({ 
  href, 
  icon, 
  label, 
  isActive, 
  isCollapsed 
}: { 
  href: string; 
  icon: ReactNode; 
  label: string; 
  isActive: boolean; 
  isCollapsed: boolean; 
}) {
  return (
    <Link
      href={href}
      title={isCollapsed ? label : ""}
      className={`group relative flex items-center transition-all duration-200 overflow-hidden ${
        isCollapsed 
          ? `w-full h-[40px] justify-center hover:bg-transparent ${isActive ? 'text-accent-400' : 'text-slate-500 hover:text-slate-300'}`
          : `px-4 py-3 w-full gap-3 rounded-xl text-sm font-semibold ${isActive ? 'text-accent-400 bg-accent-400/10 shadow-[inner_0_1px_rgba(255,255,255,0.05)]' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`
      }`}
    >
      {/* Active Indicator Line */}
      {isActive && (
        <div className={`absolute left-0 w-[2px] bg-accent-400 shadow-[0_0_8px_rgba(247,194,14,0.4)] ${isCollapsed ? 'top-0 bottom-0 rounded-r-none' : 'top-1/2 -translate-y-1/2 h-full rounded-r-full w-1'}`} />
      )}
      
      <svg className={`shrink-0 transition-transform duration-300 ${isActive ? 'rotate-0 text-accent-400' : 'group-hover:scale-110'} ${isCollapsed ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
        {icon}
      </svg>
      {!isCollapsed && <span className="whitespace-nowrap fade-in-fast tracking-wide">{label}</span>}
    </Link>
  );
}
