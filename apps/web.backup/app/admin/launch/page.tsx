"use client";
import { useEffect, useState } from 'react';

export default function Launch() {
  const [statusData, setStatusData] = useState<any>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_AGENT_BASE || '';
        const url = base.replace('/api/agent', '/statuspage');
        const r = await fetch(url);
        if (r.ok) {
          setStatusData(await r.json());
        }
      } catch (e) {
        console.error('Status check failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isHealthy = statusData?.status === 'operational';

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-xl font-bold mb-2'>Launch Checklist</h1>
      <p className='text-sm opacity-70 mb-6'>
        Pre-flight checks before going live
      </p>

      {loading ? (
        <div className='text-sm opacity-70'>Checking status...</div>
      ) : (
        <div className={`mb-6 p-4 rounded border ${
          isHealthy
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className='flex items-center gap-2'>
            <span className='text-2xl'>{isHealthy ? '✓' : '✗'}</span>
            <div>
              <p className='font-medium'>
                {isHealthy ? 'RC Gate: GREEN' : 'RC Gate: RED'}
              </p>
              <p className='text-xs opacity-70'>
                {isHealthy
                  ? 'All systems operational'
                  : 'Issues detected - do not launch'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className='space-y-4'>
        <Section title="Infrastructure">
          <CheckItem>Helm deploy applied (ingress/HPA)</CheckItem>
          <CheckItem>CORS restricted to *.vitalcv.app</CheckItem>
          <CheckItem>Rate limits configured</CheckItem>
          <CheckItem>SSL/TLS certificates valid</CheckItem>
        </Section>

        <Section title="Monitoring">
          <CheckItem>Alerts configured</CheckItem>
          <CheckItem>Grafana dashboard accessible</CheckItem>
          <CheckItem>Log shipping enabled</CheckItem>
          <CheckItem>Status page healthy</CheckItem>
        </Section>

        <Section title="Security">
          <CheckItem>CSP headers configured</CheckItem>
          <CheckItem>API versioning enabled</CheckItem>
          <CheckItem>WAF rules active</CheckItem>
          <CheckItem>Secrets rotation scheduled</CheckItem>
        </Section>

        <Section title="Operations">
          <CheckItem>Blue/Green cutover tested</CheckItem>
          <CheckItem>Runbooks accessible</CheckItem>
          <CheckItem>On-call rotation set</CheckItem>
          <CheckItem>Rollback plan documented</CheckItem>
        </Section>

        <Section title="Compliance">
          <CheckItem>DSAR export verified</CheckItem>
          <CheckItem>Privacy policy updated</CheckItem>
          <CheckItem>Terms of service current</CheckItem>
          <CheckItem>Data retention configured</CheckItem>
        </Section>
      </div>

      <div className='mt-8 p-4 bg-gray-50 border rounded'>
        <p className='text-xs font-mono opacity-70'>
          See backend doc <code>/docs/launch.md</code> for detailed procedures
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='border rounded p-4'>
      <h2 className='font-medium mb-3'>{title}</h2>
      <div className='space-y-2'>{children}</div>
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <label className='flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded'>
      <input type='checkbox' className='w-4 h-4' />
      <span>{children}</span>
    </label>
  );
}

