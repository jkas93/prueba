export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center p-4 z-50">
      <div className="relative w-24 h-24 mb-6">
        {/* Anillos concéntricos animados */}
        <div className="absolute inset-0 rounded-full border-t-2 border-accent-500 border-opacity-80 animate-spin" style={{ animationDuration: '1s' }}></div>
        <div className="absolute inset-2 rounded-full border-r-2 border-primary-500 border-opacity-60 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
        <div className="absolute inset-4 rounded-full border-b-2 border-accent-400 border-opacity-40 animate-spin" style={{ animationDuration: '2s' }}></div>
        
        {/* Centro brillante */}
        <div className="absolute inset-8 rounded-full bg-accent-500/20 blur-md pulse-slow"></div>
      </div>
      
      <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-400 to-primary-400 animate-pulse tracking-widest uppercase">
        Cargando
      </h3>
      <p className="text-surface-400 text-sm mt-2 font-mono">Preparando el entorno de trabajo...</p>
    </div>
  );
}
