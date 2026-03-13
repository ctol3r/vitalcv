import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ background: '#080e1a', color: '#e2e8f0' }}
    >
      <div className="text-center max-w-md px-6">
        <div className="text-6xl font-bold mb-4 text-white/20">404</div>
        <h1 className="text-2xl font-semibold mb-3 text-white">
          Page not found
        </h1>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          This page doesn&apos;t exist or may have been moved. Head back to
          explore VitalCV.
        </p>
        <Link
          href="/"
          className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#080e1a] hover:bg-white/90 transition"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
