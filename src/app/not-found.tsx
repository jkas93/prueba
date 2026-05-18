import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-10 rounded-3xl text-center fade-in shadow-2xl relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-surface-100 to-surface-600 mb-2 drop-shadow-sm">
            404
          </div>
          <h2 className="text-xl font-bold text-accent-400 mb-4 tracking-wide uppercase">Ruta No Encontrada</h2>
          
          <p className="text-surface-400 mb-8 text-sm leading-relaxed">
            La página que estás buscando no existe, ha sido movida o no tienes permisos para acceder a ella.
          </p>

          <Link 
            href="/dashboard"
            className="btn-primary w-full px-6 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Volver al Centro de Control
          </Link>
        </div>
      </div>
    </div>
  );
}
