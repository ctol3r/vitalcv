/**
 * Global pilot mode banner.
 * Reads PILOT_MODE env at build/runtime — server component.
 */
export default function PilotBanner() {
  if (process.env.PILOT_MODE !== "true") {
    return null;
  }

  return (
    <div className="w-full px-4 py-2 bg-surface border-b border-border text-center text-sm text-muted">
      Pilot Mode — For credentialing teams evaluating start-date acceleration.
    </div>
  );
}
