const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const newHooks = `
function EmployerActionHooks({ npi }: { npi: string }) {
  const [loading, setLoading] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');

  const handleAction = async (action: string, msg: string) => {
    setLoading(true);
    try {
      await fetch('/api/pilot/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi, actionTaken: action }),
      });
      setSuccessMsg(msg);
      // Wait 1.5s, clear msg, and force a page refresh so the reuse signal updates
      setTimeout(() => {
        setSuccessMsg('');
        window.location.reload();
      }, 1500);
    } catch (e) {
      setLoading(false);
    }
  };

  if (successMsg) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-6 py-5 text-center">
          <p className="text-sm font-bold text-green-600">✓ {successMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl px-6 py-3">
        <div className="flex items-center justify-center gap-4 pb-2">
          <p className="text-xs text-muted-foreground">Did this decision make sense?</p>
          <button
            disabled={loading}
            onClick={() => handleAction('feedback_clear', 'Thanks for the feedback!')}
            className="text-xs text-green-600 hover:underline disabled:opacity-50"
          >Yes</button>
          <button
            disabled={loading}
            onClick={() => {
              const c = prompt('What was confusing?');
              if (c) {
                setLoading(true);
                fetch('/api/pilot/friction', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ npi, contextPhase: 'decision_view', userComment: c }),
                }).then(() => {
                  setSuccessMsg('Feedback logged. Thank you.');
                  setTimeout(() => setSuccessMsg(''), 2000);
                  setLoading(false);
                });
              }
            }}
            className="text-xs text-red-500 hover:underline disabled:opacity-50"
          >No</button>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            disabled={loading}
            onClick={() => handleAction('flag', 'Issue flagged for review.')}
            className="rounded-md border border-red-200 bg-red-50 text-red-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-red-100 disabled:opacity-50"
          >Flag Issue</button>
          <button
            disabled={loading}
            onClick={() => handleAction('request_data', 'Request sent to clinician.')}
            className="rounded-md border border-amber-200 bg-amber-50 text-amber-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-100 disabled:opacity-50"
          >Request More Data</button>
          <button
            disabled={loading}
            onClick={() => handleAction('accept', 'Candidate accepted.')}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >Accept Candidate</button>
        </div>
      </div>
    </div>
  );
}
`;

code = code.replace(/function postTelemetry[\s\S]*?^}/m, newHooks);

fs.writeFileSync(path, code);
console.log('Done');