"use client";
import { useEffect, useState } from 'react';
import { can } from '@/app/lib/guard';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function InvoiceHistory() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [promo, setPromo] = useState('');
  const [vat, setVat] = useState('');
  const [email, setEmail] = useState('');
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [region, setRegion] = useState<string>('');

  // RBAC guard
  const user = { role: 'admin' }; // TODO: get from session/context
  if (!can(user, 'manage_billing')) {
    return <div className='p-8 text-center'>Not authorized to access billing.</div>;
  }

  useEffect(() => {
    fetchInvoices();
    fetchUsage();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch(`${BASE}/api/billing/invoices?tenant_id=default-tenant`);
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch {}
  };

  const fetchUsage = async () => {
    try {
      const response = await fetch(`${BASE}/api/billing/usage?tenant_id=default-tenant`);
      const data = await response.json();
      setUsage(data);
    } catch {}
  };

  const generateInvoice = async () => {
    try {
      const response = await fetch(`${BASE}/billing/invoice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'default' },
        body: JSON.stringify({ org_id: 'default', promo }),
      });
      const data = await response.json();
      setPromoApplied(data.promo);
      setRegion(data.region);
      fetchInvoices();
    } catch {}
  };

  const payInvoice = async (invoiceId: string) => {
    try {
      await fetch(`${BASE}/billing/invoice/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId, email }),
      });
      fetchInvoices();
    } catch {}
  };

  return (
    <div className='max-w-4xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>Billing & Usage</h1>
      <p className='text-sm text-gray-600 mb-4'>
        Hosted invoices available via the Hosted Link in Billing Center; PDF renderer is a preview stub.
      </p>

      {/* Promo & VAT Controls */}
      <div className='mb-6 p-4 bg-white dark:bg-gray-800 border rounded-lg'>
        <h3 className='font-semibold mb-3'>Invoice Controls</h3>
        <div className='flex gap-3 mb-3'>
          <input
            type='text'
            placeholder='Promo code'
            className='border px-3 py-2 rounded flex-1'
            value={promo}
            onChange={e => setPromo(e.target.value)}
          />
          <input
            type='text'
            placeholder='VAT number'
            className='border px-3 py-2 rounded flex-1'
            value={vat}
            onChange={e => setVat(e.target.value)}
          />
          <button
            onClick={generateInvoice}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            Generate Invoice
          </button>
        </div>
        {promoApplied && (
          <div className='text-sm text-gray-600'>
            Promo: {promoApplied} • Region: {region} • VAT: {vat || '-'}
          </div>
        )}
      </div>

      {usage && (
        <div className='mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg'>
          <h3 className='font-semibold mb-4'>Current Period Usage</h3>
          <div className='grid grid-cols-3 gap-6'>
            <div>
              <p className='text-sm text-gray-600 dark:text-gray-400'>Used</p>
              <p className='text-2xl font-bold'>{usage.usage?.agent_runs || 0}</p>
            </div>
            <div>
              <p className='text-sm text-gray-600 dark:text-gray-400'>Quota</p>
              <p className='text-2xl font-bold'>{usage.quota?.agent_runs || 0}</p>
            </div>
            <div>
              <p className='text-sm text-gray-600 dark:text-gray-400'>Utilization</p>
              <p className='text-2xl font-bold'>{((usage.utilization || 0) * 100).toFixed(1)}%</p>
            </div>
          </div>

          <div className='mt-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
            <div
              className='h-full bg-blue-600'
              style={{ width: `${Math.min((usage.utilization || 0) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      <h2 className='text-xl font-semibold mb-4'>Invoice History</h2>

      {/* Email for receipt */}
      <div className='mb-4'>
        <input
          type='email'
          placeholder='Email for receipt'
          className='border px-3 py-2 rounded w-full max-w-md'
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      <div className='space-y-2'>
        {invoices.length === 0 ? (
          <p className='text-gray-500'>No invoices available</p>
        ) : (
          invoices.map((invoice) => (
            <div key={invoice.id} className='p-4 bg-white dark:bg-gray-800 border rounded-lg flex justify-between items-center'>
              <div>
                <p className='font-medium'>Invoice #{invoice.id.slice(0, 8)}</p>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                </p>
                <p className='text-sm text-gray-600'>Status: {invoice.status}</p>
              </div>
              <div className='text-right space-y-2'>
                <p className='font-bold'>${invoice.amount || invoice.total}</p>
                <div className='flex gap-2 justify-end'>
                  {invoice.status !== 'paid' && (
                    <button
                      onClick={() => payInvoice(invoice.id)}
                      className='text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700'
                    >
                      Mark Paid
                    </button>
                  )}
                  <a
                    className='text-sm px-3 py-1 border rounded hover:bg-gray-50'
                    href={`${BASE}/billing/invoice/${invoice.id}`}
                    target='_blank'
                    rel='noreferrer'
                  >
                    Hosted Link
                  </a>
                </div>
                <a
                  href={invoice.pdf_url || `${BASE}/billing/invoice/pdf`}
                  target='_blank'
                  rel='noreferrer'
                  className='block text-sm text-blue-600 hover:underline'
                >
                  Download PDF
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
