export default function PublicDocs() {
  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Public Docs</h1>
      <div className='mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-sm'>
        <strong>✨ Dark Mode Available:</strong> Visit{' '}
        <a className='underline text-blue-600' href='/public-docs' target='_blank'>
          Branded Docs
        </a>{' '}
        and use the moon button to toggle dark mode.
      </div>
      <h2 className='text-lg font-semibold mt-4 mb-2'>Quick Links</h2>
      <ul className='list-disc ml-5 text-sm space-y-1'>
        <li>
          <a className='underline' href='/public-docs' target='_blank'>
            Branded Docs (with Dark Mode)
          </a>
        </li>
        <li>
          <a className='underline' href='/docs/portal' target='_blank'>
            API Portal
          </a>
        </li>
        <li>
          <a className='underline' href='/openapi.json' target='_blank'>
            OpenAPI JSON
          </a>
        </li>
      </ul>
      <p className='mt-4 text-sm opacity-70'>
        To publish: run <code>./scripts/export_public_docs.sh</code> then upload{' '}
        <code>dist/public-docs</code> to your CDN.
      </p>
    </div>
  );
}

