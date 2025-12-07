'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { US_STATES, type StateCode } from '@/lib/constants/states';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

type CompactType = 'IMLC' | 'PSYPACT' | 'COUNSELING';
type LicenseType = 'MD' | 'DO' | 'PSYCHOLOGY' | 'LPC' | 'LMFT' | 'LCSW' | 'OTHER';

interface EligibilityResult {
  compact: CompactType;
  eligible: boolean;
  reason: string;
  memberStates: StateCode[];
  officialUrl: string;
  requirements: string[];
}

/**
 * Clinician Wizard: Am I Eligible for IMLC/PSYPACT?
 *
 * Interactive helper to check compact eligibility
 *
 * Acceptance Criteria:
 * - Asks home state + license states
 * - Output shows approximate eligibility
 * - Directs to official sites
 * - Disclaimers clear
 * - Accessible with keyboard and screen readers
 */
export default function CompactEligibilityWizard() {
  const [step, setStep] = useState(1);
  const [licenseType, setLicenseType] = useState<LicenseType | null>(null);
  const [homeState, setHomeState] = useState<StateCode | null>(null);
  const [licensedStates, setLicensedStates] = useState<StateCode[]>([]);
  const [results, setResults] = useState<EligibilityResult[]>([]);

  // Mock compact member states (in production, fetch from API)
  const IMLC_STATES: StateCode[] = ['AL', 'AZ', 'CO', 'GA', 'ID', 'IL', 'IA', 'KS', 'KY', 'ME', 'MD', 'MI', 'MN', 'MS', 'MT', 'NE', 'NH', 'PA', 'SD', 'TN', 'UT', 'WA', 'WV', 'WI', 'WY'];
  const PSYPACT_STATES: StateCode[] = ['AL', 'AZ', 'AR', 'CO', 'CT', 'DE', 'GA', 'ID', 'IL', 'IN', 'KS', 'KY', 'ME', 'MD', 'MI', 'MN', 'MO', 'NE', 'NV', 'NH', 'NJ', 'NC', 'OH', 'OK', 'PA', 'TN', 'TX', 'UT', 'VA', 'WA', 'WV', 'WI'];
  const COUNSELING_STATES: StateCode[] = ['AL', 'CO', 'DE', 'FL', 'GA', 'IA', 'KS', 'KY', 'MD', 'MO', 'NE', 'NH', 'NC', 'OH', 'OK', 'SC', 'TN', 'UT', 'VA', 'WV'];

  const handleLicenseTypeChange = (value: LicenseType) => {
    setLicenseType(value);
  };

  const handleHomeStateChange = (value: string) => {
    setHomeState(value as StateCode);
  };

  const toggleLicensedState = (state: StateCode) => {
    setLicensedStates((prev) =>
      prev.includes(state)
        ? prev.filter((s) => s !== state)
        : [...prev, state]
    );
  };

  const calculateEligibility = () => {
    if (!licenseType || !homeState) return;

    const results: EligibilityResult[] = [];

    // IMLC Eligibility
    if (licenseType === 'MD' || licenseType === 'DO') {
      const isHomeStateInImlc = IMLC_STATES.includes(homeState);
      const hasFullLicense = licensedStates.length > 0;

      results.push({
        compact: 'IMLC',
        eligible: isHomeStateInImlc && hasFullLicense,
        reason: !isHomeStateInImlc
          ? `Your home state (${homeState}) is not an IMLC member state`
          : !hasFullLicense
          ? 'You need a full, unrestricted medical license in your home state'
          : 'You meet the basic eligibility requirements for IMLC',
        memberStates: IMLC_STATES,
        officialUrl: 'https://www.imlcc.org/',
        requirements: [
          'Hold a full, unrestricted medical license in an IMLC member state',
          'Designate that state as your "state of principal license"',
          'No pending disciplinary actions',
          'No criminal history that would disqualify you',
          'Complete the IMLC application process',
        ],
      });
    }

    // PSYPACT Eligibility
    if (licenseType === 'PSYCHOLOGY') {
      const isHomeStateInPsypact = PSYPACT_STATES.includes(homeState);
      const hasFullLicense = licensedStates.length > 0;

      results.push({
        compact: 'PSYPACT',
        eligible: isHomeStateInPsypact && hasFullLicense,
        reason: !isHomeStateInPsypact
          ? `Your home state (${homeState}) is not a PSYPACT member state`
          : !hasFullLicense
          ? 'You need a full psychology license in your home state'
          : 'You meet the basic eligibility requirements for PSYPACT',
        memberStates: PSYPACT_STATES,
        officialUrl: 'https://www.psypact.org/',
        requirements: [
          'Hold a full, unrestricted psychology license in a PSYPACT state',
          'Designate that state as your "home state"',
          'Doctoral degree in psychology from accredited institution',
          'Completed supervised experience requirements',
          'Pass EPPP examination',
        ],
      });
    }

    // Counseling Compact Eligibility
    if (licenseType === 'LPC' || licenseType === 'LMFT' || licenseType === 'LCSW') {
      const isHomeStateInCounseling = COUNSELING_STATES.includes(homeState);
      const hasFullLicense = licensedStates.length > 0;

      results.push({
        compact: 'COUNSELING',
        eligible: isHomeStateInCounseling && hasFullLicense,
        reason: !isHomeStateInCounseling
          ? `Your home state (${homeState}) is not a Counseling Compact member state`
          : !hasFullLicense
          ? 'You need a full professional counseling license in your home state'
          : 'You meet the basic eligibility requirements for the Counseling Compact',
        memberStates: COUNSELING_STATES,
        officialUrl: 'https://www.counseling-compact.org/',
        requirements: [
          'Hold a full, unrestricted counseling license in a Compact state',
          "Master's degree or higher in counseling or related field",
          'Completed supervised clinical experience',
          'Passed a recognized national counseling examination',
          'No disciplinary actions on your license',
        ],
      });
    }

    setResults(results);
    setStep(4);
  };

  const resetWizard = () => {
    setStep(1);
    setLicenseType(null);
    setHomeState(null);
    setLicensedStates([]);
    setResults([]);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Compact Eligibility Checker</h1>
        <p className="text-lg text-gray-600">
          Check if you're eligible for interstate compact licensure
        </p>
      </div>

      {/* Disclaimer */}
      <Alert className="mb-6 bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700">
        <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
        <AlertDescription className="text-sm">
          <strong>Important Disclaimer:</strong> This tool provides an approximate eligibility
          assessment only. Final eligibility determinations are made by the official compact
          commissions. Always verify requirements with the official compact websites.
        </AlertDescription>
      </Alert>

      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Step {step} of {results.length > 0 ? 4 : 3}
          </span>
          <span className="text-sm text-gray-600">{Math.round((step / 3) * 100)}% complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: License Type */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: What type of license do you hold?</CardTitle>
            <CardDescription>
              Select your primary professional license type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license-type">License Type</Label>
              <Select value={licenseType || ''} onValueChange={handleLicenseTypeChange}>
                <SelectTrigger id="license-type" aria-label="Select your license type">
                  <SelectValue placeholder="Select your license type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MD">MD (Doctor of Medicine)</SelectItem>
                  <SelectItem value="DO">DO (Doctor of Osteopathic Medicine)</SelectItem>
                  <SelectItem value="PSYCHOLOGY">Licensed Psychologist</SelectItem>
                  <SelectItem value="LPC">LPC (Licensed Professional Counselor)</SelectItem>
                  <SelectItem value="LMFT">LMFT (Licensed Marriage & Family Therapist)</SelectItem>
                  <SelectItem value="LCSW">LCSW (Licensed Clinical Social Worker)</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {licenseType === 'OTHER' && (
              <Alert>
                <Info className="h-4 w-4" aria-hidden="true" />
                <AlertDescription className="text-sm">
                  Interstate compacts currently cover physicians (IMLC), psychologists (PSYPACT),
                  and counselors (Counseling Compact). Other professions may not be covered.
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={!licenseType}
                className="w-full sm:w-auto"
              >
                Continue
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Home State */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: What is your home state?</CardTitle>
            <CardDescription>
              This is typically where you maintain your primary residence and practice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="home-state">Home State</Label>
              <Select
                value={homeState || ''}
                onValueChange={handleHomeStateChange}
              >
                <SelectTrigger id="home-state" aria-label="Select your home state">
                  <SelectValue placeholder="Select your home state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name} ({state.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="text-sm">
                Your home state must be a member of the compact for you to be eligible. We'll
                check this in the next step.
              </AlertDescription>
            </Alert>

            <div className="pt-4 flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!homeState}>
                Continue
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Licensed States */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Where are you currently licensed?</CardTitle>
            <CardDescription>
              Select all states where you hold an active, unrestricted license
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Licensed States (optional)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
                {US_STATES.map((state) => (
                  <div key={state.code} className="flex items-center space-x-2">
                    <Checkbox
                      id={`state-${state.code}`}
                      checked={licensedStates.includes(state.code)}
                      onCheckedChange={() => toggleLicensedState(state.code)}
                      aria-label={`Licensed in ${state.name}`}
                    />
                    <Label
                      htmlFor={`state-${state.code}`}
                      className="text-sm cursor-pointer"
                    >
                      {state.code}
                    </Label>
                  </div>
                ))}
              </div>
              {licensedStates.length > 0 && (
                <p className="text-sm text-gray-600">
                  Selected: {licensedStates.join(', ')}
                </p>
              )}
            </div>

            <div className="pt-4 flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back
              </Button>
              <Button onClick={calculateEligibility}>
                Check Eligibility
                <CheckCircle2 className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && results.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Eligibility Results</CardTitle>
              <CardDescription>
                Based on the information you provided, here's your compact eligibility status
              </CardDescription>
            </CardHeader>
          </Card>

          {results.map((result) => (
            <Card
              key={result.compact}
              className={result.eligible ? 'border-green-500' : 'border-gray-300'}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {result.eligible ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-6 w-6 text-gray-400" aria-hidden="true" />
                      )}
                      {result.compact}
                    </CardTitle>
                    <CardDescription className="mt-2">{result.reason}</CardDescription>
                  </div>
                  <Badge
                    variant={result.eligible ? 'default' : 'outline'}
                    className={result.eligible ? 'bg-green-600' : ''}
                  >
                    {result.eligible ? 'Likely Eligible' : 'Not Eligible'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Requirements:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    {result.requirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-sm">
                    Member States ({result.memberStates.length}):
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {result.memberStates.map((state) => (
                      <Badge
                        key={state}
                        variant="outline"
                        className={`text-xs ${
                          state === homeState ? 'border-blue-500 bg-blue-50' : ''
                        }`}
                      >
                        {state}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={result.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center"
                    >
                      Visit Official {result.compact} Website
                      <ExternalLink className="ml-2 h-3 w-3" aria-hidden="true" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5" aria-hidden="true" />
                Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                If you appear eligible, we recommend:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Visit the official compact website to verify current requirements</li>
                <li>Review the complete application process and fees</li>
                <li>Gather required documentation (transcripts, licenses, etc.)</li>
                <li>Submit your application through the official compact portal</li>
                <li>Monitor your application status</li>
              </ol>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={resetWizard}>
              Start Over
            </Button>
            <Button asChild>
              <a href="/dashboard/compacts">
                View My Compacts
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Footer Disclaimer */}
      <Alert className="mt-6 bg-gray-50 dark:bg-gray-900">
        <AlertDescription className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Legal Disclaimer:</strong> This eligibility checker is for informational
          purposes only and does not constitute legal or professional advice. Eligibility
          requirements may change, and additional criteria may apply. Always consult the
          official compact commission websites for the most current and accurate information.
          VitalCV is not responsible for any decisions made based on this tool.
        </AlertDescription>
      </Alert>
    </div>
  );
}

