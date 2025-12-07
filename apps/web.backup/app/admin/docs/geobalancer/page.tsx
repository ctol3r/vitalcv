export default function GeoDocs() {
  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-xl font-bold mb-4'>Geo-balancer Recipes</h1>
      <p className='text-sm text-gray-600 mb-6'>
        Configuration templates for geo-steering and latency-based routing.
      </p>

      <div className='space-y-6'>
        <div className='border rounded-lg p-4'>
          <h2 className='text-lg font-semibold mb-2'>Cloudflare Load Balancer</h2>
          <ul className='list-disc ml-5 text-sm space-y-1'>
            <li>Create LB → Pools: <code className='bg-gray-100 px-1'>us-agent</code>, <code className='bg-gray-100 px-1'>eu-agent</code></li>
            <li>Origins: <code className='bg-gray-100 px-1'>https://us.agent.example.com</code>, <code className='bg-gray-100 px-1'>https://eu.agent.example.com</code></li>
            <li>Geo steering: US/CA → us-agent; EU → eu-agent; fallback round-robin</li>
            <li>Health monitors: GET <code className='bg-gray-100 px-1'>/aa/health</code> expects <code className='bg-gray-100 px-1'>{'{ ok: true, region }'}</code></li>
            <li>Session affinity: cookie <code className='bg-gray-100 px-1'>vitalcv_sticky</code> (24h)</li>
          </ul>
        </div>

        <div className='border rounded-lg p-4'>
          <h2 className='text-lg font-semibold mb-2'>Route 53 Latency Routing</h2>
          <ul className='list-disc ml-5 text-sm space-y-1'>
            <li>Two A/ALIAS records: <code className='bg-gray-100 px-1'>agent.example.com</code> → <code className='bg-gray-100 px-1'>us-alb</code>, <code className='bg-gray-100 px-1'>eu-alb</code></li>
            <li>Health checks: <code className='bg-gray-100 px-1'>/aa/health</code></li>
            <li>Weighted failover set to 0 when unhealthy</li>
          </ul>
        </div>

        <div className='mt-6 p-4 bg-blue-50 rounded border border-blue-200'>
          <p className='text-xs text-blue-900'>
            💡 <strong>Tip:</strong> Both recipes support active-active geo distribution with automatic failover.
            Test with <code className='bg-blue-100 px-1'>curl -v https://agent.example.com/aa/health</code> from different regions.
          </p>
        </div>
      </div>
    </div>
  );
}

