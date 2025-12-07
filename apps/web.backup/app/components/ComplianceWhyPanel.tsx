"use client";
import { AlertCircle, CheckCircle, ArrowRight, ExternalLink } from 'lucide-react';

interface ComplianceResult {
  authorized: boolean;
  reasons: string[];
  missing: string[];
}

export default function ComplianceWhyPanel({
  result,
  context = 'telehealth',
}: {
  result: ComplianceResult;
  context?: string;
}) {
  const getRemediationLink = (missing: string) => {
    const links: Record<string, { url: string; text: string }> = {
      'NLC compact membership': {
        url: 'https://www.ncsbn.org/nlc',
        text: 'Apply for NLC multistate license',
      },
      'PSYPACT E.Passport credential': {
        url: 'https://psypact.org/',
        text: 'Apply for E.Passport',
      },
      'APRN Compact membership': {
        url: 'https://www.aprncompact.org/',
        text: 'APRN Compact information',
      },
      'State registration': {
        url: '/help/telehealth-registration',
        text: 'State telehealth registration guide',
      },
    };

    // Find best match
    for (const [key, value] of Object.entries(links)) {
      if (missing.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    return { url: '/help', text: 'View help documentation' };
  };

  return (
    <div
      className={`p-4 border rounded-lg ${
        result.authorized
          ? 'bg-green-50 border-green-300'
          : 'bg-red-50 border-red-300'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        {result.authorized ? (
          <CheckCircle size={24} className="text-green-600 flex-shrink-0" />
        ) : (
          <AlertCircle size={24} className="text-red-600 flex-shrink-0" />
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            {result.authorized ? 'Authorized' : 'Not Authorized'}
          </h3>
          <p className="text-sm text-gray-700">
            {result.authorized
              ? `You meet all requirements for ${context} practice.`
              : `You're missing one or more requirements for ${context} practice.`}
          </p>
        </div>
      </div>

      {result.reasons.length > 0 && (
        <div className="mb-3">
          <div className="text-sm font-medium text-gray-900 mb-1">
            ✓ Current qualifications:
          </div>
          <ul className="text-sm text-gray-700 space-y-1">
            {result.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.missing.length > 0 && (
        <div className="pt-3 border-t border-red-200">
          <div className="text-sm font-medium text-red-900 mb-2">
            ✗ Missing requirements:
          </div>
          <div className="space-y-2">
            {result.missing.map((missing, i) => {
              const link = getRemediationLink(missing);
              return (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 p-2 bg-white rounded border border-red-200"
                >
                  <div className="flex items-start gap-2 flex-1">
                    <AlertCircle
                      size={16}
                      className="text-red-600 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-900">{missing}</span>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs whitespace-nowrap"
                  >
                    <span>{link.text}</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!result.authorized && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <a
            href="/compliance/help"
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <span>Need help meeting these requirements?</span>
            <ArrowRight size={16} />
          </a>
        </div>
      )}
    </div>
  );
}

