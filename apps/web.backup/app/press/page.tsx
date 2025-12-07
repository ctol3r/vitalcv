export default function Press() {
  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold mb-4'>Press Kit</h1>
      <p className='text-sm opacity-80 mb-6'>
        Download our official brand assets and boilerplate text for press and marketing materials.
      </p>
      <div className='space-y-3'>
        <div className='p-4 border rounded hover:bg-gray-50 dark:hover:bg-gray-900 transition'>
          <h2 className='font-semibold mb-1'>Logo (SVG)</h2>
          <p className='text-xs opacity-70 mb-2'>Official VitalCV logo in vector format</p>
          <a
            className='text-blue-600 underline text-sm'
            href='/press/logo.svg'
            download
          >
            Download logo.svg
          </a>
        </div>
        <div className='p-4 border rounded hover:bg-gray-50 dark:hover:bg-gray-900 transition'>
          <h2 className='font-semibold mb-1'>Brand Colors (JSON)</h2>
          <p className='text-xs opacity-70 mb-2'>Official color palette</p>
          <a
            className='text-blue-600 underline text-sm'
            href='/press/colors.json'
            download
          >
            Download colors.json
          </a>
        </div>
        <div className='p-4 border rounded hover:bg-gray-50 dark:hover:bg-gray-900 transition'>
          <h2 className='font-semibold mb-1'>Boilerplate (TXT)</h2>
          <p className='text-xs opacity-70 mb-2'>Standard company description</p>
          <a
            className='text-blue-600 underline text-sm'
            href='/press/boilerplate.txt'
            download
          >
            Download boilerplate.txt
          </a>
        </div>
      </div>
      <div className='mt-8 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-sm'>
        <strong>Media Inquiries:</strong> For additional assets or questions, please contact{' '}
        <a className='underline text-blue-600' href='mailto:press@vitalcv.com'>
          press@vitalcv.com
        </a>
      </div>
    </div>
  );
}

