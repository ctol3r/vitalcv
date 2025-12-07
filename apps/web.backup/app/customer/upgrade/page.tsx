"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function BillingUpgrade() {
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan] = useState('starter');

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${BASE}/api/billing/plans`);
        const data = await response.json();
        setPlans(data.plans || []);
      } catch {
        setPlans([]);
      }
    })();
  }, []);

  const handleUpgrade = async (planId: string) => {
    try {
      await fetch(`${BASE}/api/billing/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: 'default-tenant', plan_id: planId }),
      });
      alert(`Upgraded to ${planId} plan!`);
    } catch {
      alert('Upgrade failed');
    }
  };

  return (
    <div className='max-w-5xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-2'>Choose Your Plan</h1>
      <p className='text-gray-600 dark:text-gray-400 mb-8'>Select the plan that best fits your needs</p>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`p-6 border rounded-lg ${
              currentPlan === plan.id
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <h3 className='text-xl font-bold mb-2'>{plan.name}</h3>
            <p className='text-3xl font-bold mb-4'>
              ${plan.price}
              <span className='text-sm font-normal text-gray-600 dark:text-gray-400'>/month</span>
            </p>

            <div className='mb-6'>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-2'>
                {plan.quota_runs.toLocaleString()} credentials/month
              </p>
              <ul className='text-sm space-y-1'>
                {plan.features?.map((feature: string, i: number) => (
                  <li key={i} className='flex items-start'>
                    <span className='mr-2'>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {currentPlan === plan.id ? (
              <button
                disabled
                className='w-full px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed'
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(plan.id)}
                className='w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
              >
                Upgrade
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
