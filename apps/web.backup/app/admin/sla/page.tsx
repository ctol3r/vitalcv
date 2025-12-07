"use client";

export default function SLA() {
  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-xl font-bold mb-4'>SLA Weekly Report</h1>

      <div className='bg-blue-50 border border-blue-200 rounded p-4 mb-6'>
        <p className='text-sm text-blue-900 mb-2'>
          <strong>Generate SLA Report:</strong>
        </p>
        <code className='text-xs bg-blue-100 px-2 py-1 rounded block mb-2'>
          pnpm tsx scripts/sla_weekly.ts
        </code>
        <p className='text-xs text-blue-800'>
          This script outputs weekly SLA metrics (success rate, total runs) from the AgentTrace table.
          Upload results to your reporting store and wire the endpoint in a future round.
        </p>
      </div>

      <div className='border rounded p-4'>
        <h2 className='font-semibold mb-3'>SLA Metrics</h2>
        <div className='grid gap-3'>
          <MetricCard label="Target SLA" value="99.5%" status="target" />
          <MetricCard label="Current Week" value="Pending" status="pending" />
          <MetricCard label="Last 30 Days" value="Pending" status="pending" />
        </div>
      </div>

      <div className='mt-6 text-xs text-gray-600'>
        <p>
          <strong>Next Steps:</strong> Wire this page to pull live SLA data from your backend API endpoint.
          Consider adding charts, trends, and alerting thresholds.
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, status }: { label: string; value: string; status: 'target' | 'good' | 'warning' | 'pending' }) {
  const colors = {
    target: 'bg-gray-50 border-gray-200',
    good: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    pending: 'bg-blue-50 border-blue-200',
  };

  return (
    <div className={`p-3 border rounded ${colors[status]}`}>
      <div className='text-xs opacity-70 mb-1'>{label}</div>
      <div className='font-semibold'>{value}</div>
    </div>
  );
}

