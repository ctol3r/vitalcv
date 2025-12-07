export default function PublicStatusDoc() {
  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>Public Status (Vanity)</h1>

      <div className='prose max-w-none'>
        <p className='text-gray-700 mb-6'>
          The public status page is a lightweight static site that displays system health without requiring authentication.
          It can be hosted on any CDN or static hosting service.
        </p>

        <h2 className='text-xl font-semibold mt-8 mb-4'>Quick Start</h2>
        <ol className='list-decimal ml-5 space-y-3 text-sm'>
          <li>
            <strong>Build the static site:</strong>
            <pre className='bg-gray-50 p-3 rounded mt-2 overflow-x-auto'>
              ./scripts/export_public_status.sh
            </pre>
          </li>
          <li>
            <strong>Upload to your preferred host:</strong>
            <p className='mt-2 text-gray-600'>The built files will be in <code className='bg-gray-100 px-1 py-0.5 rounded'>dist/public-status/</code></p>
          </li>
          <li>
            <strong>Point your domain:</strong>
            <p className='mt-2 text-gray-600'>Configure <code className='bg-gray-100 px-1 py-0.5 rounded'>status.yourdomain.com</code> to point at the hosted site</p>
          </li>
        </ol>

        <h2 className='text-xl font-semibold mt-8 mb-4'>Deployment Examples</h2>

        <div className='space-y-6'>
          <div>
            <h3 className='font-semibold mb-2'>AWS S3 + CloudFront</h3>
            <pre className='bg-gray-50 p-3 rounded text-xs overflow-x-auto'>
{`# Upload to S3 bucket
aws s3 sync dist/public-status/ s3://status.yourdomain.com/

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"`}
            </pre>
          </div>

          <div>
            <h3 className='font-semibold mb-2'>Netlify</h3>
            <pre className='bg-gray-50 p-3 rounded text-xs overflow-x-auto'>
{`# Deploy to Netlify
netlify deploy --dir=dist/public-status --prod`}
            </pre>
          </div>

          <div>
            <h3 className='font-semibold mb-2'>Vercel</h3>
            <pre className='bg-gray-50 p-3 rounded text-xs overflow-x-auto'>
{`# Deploy to Vercel
vercel --prod dist/public-status`}
            </pre>
          </div>

          <div>
            <h3 className='font-semibold mb-2'>GitHub Pages</h3>
            <pre className='bg-gray-50 p-3 rounded text-xs overflow-x-auto'>
{`# Copy to gh-pages branch
cp -r dist/public-status/* .
git checkout gh-pages
git add .
git commit -m "Update status page"
git push origin gh-pages`}
            </pre>
          </div>
        </div>

        <h2 className='text-xl font-semibold mt-8 mb-4'>What It Shows</h2>
        <ul className='list-disc ml-5 space-y-2 text-sm text-gray-700'>
          <li>API Health Status</li>
          <li>JWKS Availability</li>
          <li>Metrics Endpoint Status</li>
        </ul>

        <h2 className='text-xl font-semibold mt-8 mb-4'>Configuration</h2>
        <p className='text-sm text-gray-700 mb-2'>
          The status page fetches data from the <code className='bg-gray-100 px-1 py-0.5 rounded'>/statuspage</code> endpoint.
          Make sure your backend is configured with CORS to allow requests from your status page domain.
        </p>

        <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6'>
          <h3 className='font-semibold text-blue-900 mb-2'>💡 Pro Tip</h3>
          <p className='text-sm text-blue-800'>
            Set up a GitHub Action to automatically rebuild and deploy the status page whenever your backend health checks change.
          </p>
        </div>
      </div>
    </div>
  );
}

