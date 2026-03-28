import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Request Pilot — VitalCV",
  description: "Request pilot access to the VitalCV employer review workflow.",
};

export default function PilotPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white flex items-center justify-center px-6 py-20">
      <div className="max-w-lg w-full">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300 mb-6">
          Silent Pilot
        </span>
        <h1 className="text-3xl font-semibold text-white">
          Request pilot access.
        </h1>
        <p className="mt-4 text-base text-white/65 leading-7">
          VitalCV connects clinician source-backed readiness to your employer review workflow.
          One NPI. NPPES identity, OIG/LEIE screening, and PECOS enrollment — before the conversation starts.
        </p>
        <div className="mt-8 space-y-3">
          <a
            href="mailto:pilots@vitalcv.com?subject=Pilot+access+request"
            className="block w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 px-6 py-4 text-center text-sm font-bold text-black transition-all shadow-lg shadow-emerald-500/20"
          >
            Email pilots@vitalcv.com
          </a>
          <Link
            href="/review"
            className="block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-center text-sm font-medium text-white/70 hover:text-white transition"
          >
            See how review works →
          </Link>
        </div>
        <p className="mt-6 text-xs text-white/35 text-center">
          No account required to preview. Pilot access is granted directly — no plan selection.
        </p>
      </div>
    </div>
  );
}
