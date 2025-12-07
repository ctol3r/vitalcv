'use client';

export default function ExecBrief() {
  const htmlUrl = '/api/dev/exec-brief.html';
  const pdfUrl = '/api/dev/exec-brief.pdf';

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Executive Brief</h1>

      <div className="flex gap-2 mb-4">
        <a
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          href={htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          📄 Open HTML
        </a>
        <a
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          download="vitalcv-exec-brief.pdf"
        >
          📥 Download PDF
        </a>
      </div>

      <div className="border rounded-lg shadow-sm overflow-hidden">
        <iframe
          src={htmlUrl}
          className="w-full h-[75vh]"
          title="Executive Brief Preview"
        />
      </div>

      <div className="mt-4 text-xs text-gray-500">
        This brief aggregates: Dev Status, Checklist, Compliance Snapshot (NCQA/JC), Compact Coverage, and Recent Verifications.
      </div>
    </div>
  );
}

