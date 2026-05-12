'use client';

/**
 * DownloadReceiptButton — client-side download trigger.
 *
 * Two modes:
 *   1. vcJson provided → downloads a VC 2.0 JSON blob
 *   2. print mode      → triggers window.print() for offline verifier PDF
 */

interface DownloadReceiptButtonProps {
  receiptId: string;
  vcJson?: object;
  label: string;
  filename?: string;
  /** If true, triggers window.print() instead of file download */
  printMode?: boolean;
  className?: string;
}

export function DownloadReceiptButton({
  receiptId,
  vcJson,
  label,
  filename,
  printMode = false,
  className = '',
}: DownloadReceiptButtonProps) {
  const handleClick = () => {
    if (printMode) {
      window.print();
      return;
    }
    if (!vcJson) return;

    const blob = new Blob([JSON.stringify(vcJson, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `vcv-receipt-${receiptId}.vc.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        'inline-flex items-center gap-2 rounded px-4 py-2',
        'text-sm font-semibold transition-colors',
        'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900',
        className,
      ]
        .join(' ')
        .trim()}
    >
      {label}
    </button>
  );
}

export default DownloadReceiptButton;
