/**
 * Team Changelog - Batch 54
 * Displays recent commits and feature status
 */

export default function TeamChangelog() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-2">Team Changelog</h1>
      <p className="text-sm text-gray-600 mb-6">
        Track recent updates and feature rollouts. Connect to GitHub API for live commit feed.
      </p>

      {/* Placeholder for future GitHub integration */}
      <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm mb-6">
        <h2 className="font-semibold mb-3">Recent Updates</h2>
        <div className="space-y-3 text-sm">
          <div className="flex gap-3 pb-3 border-b border-gray-200">
            <div className="w-20 text-gray-500 flex-shrink-0">Today</div>
            <div>
              <div className="font-medium">Batch 54: EUDI Wallet + Behavioral Compacts</div>
              <div className="text-xs text-gray-600 mt-1">
                Added EUDI issuer profiles, PSYPACT/Counseling eligibility, NCQA PSV events,
                Joint Commission survey export, multi-agent health endpoints
              </div>
            </div>
          </div>

          <div className="flex gap-3 pb-3 border-b border-gray-200">
            <div className="w-20 text-gray-500 flex-shrink-0">Yesterday</div>
            <div>
              <div className="font-medium">Batch 37: Core Routes & Middleware</div>
              <div className="text-xs text-gray-600 mt-1">
                Wired NLC, APRN, PSYPACT, PECOS, telehealth routes with hardened middleware
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Status Quick Links */}
      <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
        <h3 className="font-semibold text-sm mb-2">Quick Links</h3>
        <div className="flex flex-wrap gap-2">
          <a
            href="/dev/checklist"
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
          >
            Feature Checklist →
          </a>
          <a
            href="/dev/status"
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
          >
            System Status →
          </a>
          <a
            href="/api/agents/health"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50"
          >
            Agent Health API →
          </a>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-6">
        <strong>Coming soon:</strong> Live GitHub commit feed, PR status, and automated
        release notes. For now, use your repository's compare view or the{' '}
        <code className="bg-gray-100 px-1 py-0.5 rounded">/dev/checklist</code> page.
      </p>
    </div>
  );
}

