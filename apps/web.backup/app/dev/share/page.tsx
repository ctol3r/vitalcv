"use client";

export default function Share() {
  const url = '/api/dev/share-report.html';

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.origin + url);
    alert('Link copied to clipboard!');
  };

  return (
    <div className='max-w-5xl mx-auto py-8'>
      <h1 className='text-xl font-bold mb-4'>Share Preview</h1>

      <div className='flex gap-2 text-xs mb-3'>
        <button
          className='px-3 py-2 border rounded hover:bg-gray-50'
          onClick={copyLink}
        >
          📋 Copy Link
        </button>
        <a
          className='px-3 py-2 border rounded hover:bg-gray-50 inline-block'
          href={url}
          target='_blank'
          rel='noopener noreferrer'
        >
          🔗 Open in new tab
        </a>
        <a
          className='px-3 py-2 border rounded hover:bg-gray-50 inline-block'
          href='/api/dev/share-report.pdf'
          target='_blank'
          rel='noopener noreferrer'
        >
          📄 Download PDF
        </a>
      </div>

      <iframe
        src={url}
        className='w-full h-[70vh] border rounded'
        title='Share Preview Report'
      />
    </div>
  );
}

