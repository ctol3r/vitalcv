"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function TrafficManagement() {
  const [health, setHealth] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);

  useEffect(() => {
    fetchHealth();
    fetchRoutes();
  }, []);

  const fetchHealth = async () => {
    try {
      const response = await fetch(`${BASE}/api/traffic/health`);
      const data = await response.json();
      setHealth(data);
    } catch {}
  };

  const fetchRoutes = async () => {
    try {
      const response = await fetch(`${BASE}/api/traffic/routes`);
      const data = await response.json();
      setRoutes(data.routes || []);
    } catch {}
  };

  return (
    <div className='max-w-4xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>Active-Active Traffic Management</h1>

      {health && (
        <div className='mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='font-semibold'>Current Instance</h3>
            <span className={`px-3 py-1 rounded ${health.healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {health.healthy ? 'Healthy' : 'Degraded'}
            </span>
          </div>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <p className='text-gray-600 dark:text-gray-400'>Region</p>
              <p className='font-medium'>{health.region}</p>
            </div>
            <div>
              <p className='text-gray-600 dark:text-gray-400'>Instance ID</p>
              <p className='font-medium'>{health.instance}</p>
            </div>
          </div>
        </div>
      )}

      <h2 className='text-xl font-semibold mb-4'>Traffic Routes</h2>
      <div className='space-y-2'>
        {routes.length === 0 ? (
          <p className='text-gray-500'>No routing rules configured</p>
        ) : (
          routes.map((route, i) => (
            <div key={i} className='p-3 bg-white dark:bg-gray-800 border rounded-lg'>
              <div className='flex justify-between items-center'>
                <div>
                  <p className='font-medium'>{route.pattern}</p>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>→ {route.target_region}</p>
                </div>
                <div className='text-right'>
                  <p className='text-sm text-gray-600 dark:text-gray-400'>Weight</p>
                  <p className='font-medium'>{route.weight}%</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
