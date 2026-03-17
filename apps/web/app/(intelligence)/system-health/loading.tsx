export default function Loading() {
  return (
    <div className="min-h-screen bg-[#080e1a] flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}
