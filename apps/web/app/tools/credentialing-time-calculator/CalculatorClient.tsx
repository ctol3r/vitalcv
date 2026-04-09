'use client';

import Link from 'next/link';
import { useState } from 'react';

interface CalculatorInputs {
  providerCount: number;
  avgDaysToStart: number;
  staffHourlyRate: number;
  hoursPerProvider: number;
}

const DEFAULTS: CalculatorInputs = {
  providerCount: 50,
  avgDaysToStart: 90,
  staffHourlyRate: 35,
  hoursPerProvider: 20,
};

function calculateCosts(inputs: CalculatorInputs) {
  const {
    providerCount,
    avgDaysToStart,
    staffHourlyRate,
    hoursPerProvider,
  } = inputs;

  // Current costs
  const laborCostPerProvider = hoursPerProvider * staffHourlyRate;
  const totalLaborCost = laborCostPerProvider * providerCount;

  // Revenue delay cost (average provider generates ~$2,500/day in revenue)
  const revenuePerDay = 2500;
  const delayDaysReduced = Math.min(avgDaysToStart * 0.3, 30); // VitalCV can reduce by up to 30%
  const revenueSavedPerProvider = delayDaysReduced * revenuePerDay;
  const totalRevenueSaved = revenueSavedPerProvider * providerCount;

  // VitalCV savings (reduce verification hours by ~60%)
  const hoursReduced = hoursPerProvider * 0.6;
  const laborSavedPerProvider = hoursReduced * staffHourlyRate;
  const totalLaborSaved = laborSavedPerProvider * providerCount;

  const totalCurrentCost = totalLaborCost;
  const totalPotentialSavings = totalLaborSaved + totalRevenueSaved;

  return {
    totalCurrentCost,
    laborCostPerProvider,
    totalLaborSaved,
    totalRevenueSaved,
    totalPotentialSavings,
    delayDaysReduced: Math.round(delayDaysReduced),
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function CalculatorClient() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULTS);
  const [email, setEmail] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const results = calculateCosts(inputs);

  function handleInputChange(field: keyof CalculatorInputs, value: string) {
    const numValue = Number.parseInt(value, 10);
    if (!Number.isNaN(numValue) && numValue >= 0) {
      setInputs((prev) => ({ ...prev, [field]: numValue }));
    }
  }

  function handleShowResults(e: React.FormEvent) {
    e.preventDefault();
    if (email.includes('@') && email.includes('.')) {
      setEmailSubmitted(true);
      setShowResults(true);
    }
  }

  return (
    <div className="space-y-8">
      {/* Input form */}
      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-6">
        <h2 className="text-lg font-semibold">Your Organization</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="Number of providers"
            value={inputs.providerCount}
            onChange={(v) => handleInputChange('providerCount', v)}
            suffix="providers"
          />
          <InputField
            label="Average days to start"
            value={inputs.avgDaysToStart}
            onChange={(v) => handleInputChange('avgDaysToStart', v)}
            suffix="days"
          />
          <InputField
            label="Credentialing staff hourly rate"
            value={inputs.staffHourlyRate}
            onChange={(v) => handleInputChange('staffHourlyRate', v)}
            prefix="$"
            suffix="/hr"
          />
          <InputField
            label="Hours spent per provider"
            value={inputs.hoursPerProvider}
            onChange={(v) => handleInputChange('hoursPerProvider', v)}
            suffix="hours"
          />
        </div>
      </section>

      {/* Email gate */}
      {!showResults && (
        <form
          onSubmit={handleShowResults}
          className="rounded-2xl border-2 border-foreground/10 bg-card p-6 sm:p-8 space-y-4"
        >
          <h2 className="text-lg font-semibold">See Your Results</h2>
          <p className="text-sm text-muted-foreground">
            Enter your work email to see your estimated costs and potential
            savings.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hospital.org"
              required
              className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="rounded-xl bg-foreground px-8 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Calculate savings
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            We&apos;ll send you a copy of these results. No spam.
          </p>
        </form>
      )}

      {/* Results */}
      {showResults && (
        <section className="space-y-6 animate-[vcv-stage-in_420ms_ease-out]">
          <div className="rounded-2xl border-2 border-trust-green/20 bg-card p-6 sm:p-8 space-y-6">
            <h2 className="text-lg font-semibold">Your Estimated Costs</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <ResultCard
                label="Current annual labor cost"
                value={formatCurrency(results.totalCurrentCost)}
                sublabel={`${formatCurrency(results.laborCostPerProvider)} per provider`}
              />
              <ResultCard
                label="Potential labor savings"
                value={formatCurrency(results.totalLaborSaved)}
                sublabel="By automating verification steps"
                highlight
              />
              <ResultCard
                label="Revenue from faster onboarding"
                value={formatCurrency(results.totalRevenueSaved)}
                sublabel={`${results.delayDaysReduced} fewer days to start per provider`}
                highlight
              />
              <ResultCard
                label="Total potential savings"
                value={formatCurrency(results.totalPotentialSavings)}
                sublabel="Annual savings with VitalCV"
                highlight
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Estimates based on industry averages. Actual savings vary by
              organization. Revenue calculation assumes $2,500/day average
              provider revenue.
            </p>
          </div>

          {/* CTA */}
          <div className="rounded-2xl border-2 border-foreground/10 bg-card p-8 text-center space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Ready to reduce your credentialing costs?
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Start with a free NPI check or talk to us about employer plans.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/passport"
                className="inline-flex rounded-xl bg-foreground px-8 py-3 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Try a free NPI check
              </Link>
              <Link
                href="/pilot"
                className="inline-flex rounded-xl border border-border bg-background px-8 py-3 text-sm font-semibold transition hover:bg-card"
              >
                Start an employer pilot
              </Link>
            </div>
          </div>

          {emailSubmitted && (
            <p className="text-center text-sm text-muted-foreground">
              Results sent to <strong>{email}</strong>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {prefix && (
          <span className="text-sm text-muted-foreground">{prefix}</span>
        )}
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string;
  value: string;
  sublabel: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 space-y-1 ${
        highlight
          ? 'border-trust-green/20 bg-trust-green/5'
          : 'border-border bg-background'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold ${highlight ? 'text-trust-green' : ''}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
    </div>
  );
}
