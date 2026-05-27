import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center">
        <div className="text-6xl mb-4">🚑</div>
        <h1 className="text-3xl font-bold text-verde-800 mb-2">Croce Verde – Gestione Turni</h1>
        <p className="text-gray-500">Seleziona una sezione dal menu in alto per iniziare</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        <Link href="/turni" className="card hover:shadow-md transition-shadow flex flex-col items-center gap-3 text-center cursor-pointer group">
          <span className="text-4xl">📅</span>
          <div>
            <div className="font-semibold text-verde-700 group-hover:text-verde-800">Turni</div>
            <div className="text-xs text-gray-500 mt-1">Compila e gestisci la turnazione settimanale</div>
          </div>
        </Link>
        <Link href="/personale" className="card hover:shadow-md transition-shadow flex flex-col items-center gap-3 text-center cursor-pointer group">
          <span className="text-4xl">👥</span>
          <div>
            <div className="font-semibold text-verde-700 group-hover:text-verde-800">Personale</div>
            <div className="text-xs text-gray-500 mt-1">Gestisci autisti e soccorritori</div>
          </div>
        </Link>
        <Link href="/report" className="card hover:shadow-md transition-shadow flex flex-col items-center gap-3 text-center cursor-pointer group">
          <span className="text-4xl">📊</span>
          <div>
            <div className="font-semibold text-verde-700 group-hover:text-verde-800">Report</div>
            <div className="text-xs text-gray-500 mt-1">Riepilogo ore mensile per dipendente</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
