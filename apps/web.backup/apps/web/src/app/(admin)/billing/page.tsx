'use client';

import React, { useState, useEffect } from 'react';

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('demo-org'); // Default or get from context

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  useEffect(() => {
    fetchSubscription();
  }, [orgId]);

  const fetchSubscription = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/billing/subscription?orgId=${orgId}`);
      const data = await res.json();
      setSubscription(data.subscription);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = async (planId: string) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/api/billing/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, planId }),
      });
      await fetchSubscription();
    } catch (err) {
      console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const updateSeats = async (action: 'add' | 'remove') => {
    if (!subscription) return;
    try {
        await fetch(`${API_BASE}/api/billing/seat/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id }),
        });
        await fetchSubscription();
    } catch (err) {
        console.error(err);
    }
  };

  if (loading) return <div className="p-8">Loading billing info...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Billing & Subscription</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6 border">
        <h2 className="text-xl font-semibold mb-4">Current Plan</h2>

        {subscription ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-medium text-lg">{subscription.items.data[0].price.nickname || 'Standard Plan'}</p>
                <p className="text-gray-500">{subscription.status.toUpperCase()}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {(subscription.items.data[0].price.unit_amount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  <span className="text-sm text-gray-500 font-normal"> / seat / month</span>
                </p>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-2">Seats</h3>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold">{subscription.items.data[0].quantity}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateSeats('remove')}
                    className="px-3 py-1 border rounded hover:bg-gray-50"
                    disabled={subscription.items.data[0].quantity <= 1}
                  >
                    -
                  </button>
                  <button
                    onClick={() => updateSeats('add')}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

             <div className="mt-6 pt-4 border-t flex gap-4">
                 {/* Upgrade/Downgrade Mock */}
                <button className="text-blue-600 hover:underline" onClick={() => alert('Feature coming soon')}>Change Plan</button>
             </div>

          </div>
        ) : (
          <div className="text-center py-8">
            <p className="mb-4 text-gray-500">No active subscription found.</p>
            <div className="flex gap-4 justify-center">
                <button
                    onClick={() => subscribe('price_standard')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Subscribe to Standard
                </button>
                 <button
                    onClick={() => subscribe('price_pro')}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                    Subscribe to Pro
                </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <a
            href="#"
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
            onClick={(e) => {
                e.preventDefault();
                alert("This would open the Stripe Customer Portal.");
            }}
        >
            Manage Billing in Stripe Portal &rarr;
        </a>
      </div>
    </div>
  );
}















