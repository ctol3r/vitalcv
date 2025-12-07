'use client';

export default function ApiPortal() {
  return (
    <div className='max-w-5xl mx-auto py-8'>
      <h1 className='text-xl font-bold mb-4'>API Portal</h1>
      <div className='border rounded overflow-hidden'>
        <iframe
          src='/docs/portal'
          className='w-full h-[600px]'
          title='API Documentation Portal'
        />
      </div>
      <div className='mt-4 p-3 border rounded text-xs bg-gray-50 dark:bg-gray-900'>
        <strong>Install CLI (demo):</strong>{' '}
        <code className='bg-white dark:bg-gray-800 px-2 py-1 rounded'>
          curl -fsSL /cli/install.sh | bash
        </code>
      </div>
    </div>
  );
}

