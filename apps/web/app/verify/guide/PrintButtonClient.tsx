'use client';

export default function PrintButtonClient() {
  return (
    <button
      onClick={() => window.print()}
      className="text-blue-600 hover:text-blue-800 underline underline-offset-2 text-sm"
    >
      Download offline guide (print)
    </button>
  );
}
