import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MatchaExplanation } from '../components/matcha/MatchaExplanation';
import { OpportunityIntelligenceCard } from '../components/matcha/OpportunityIntelligenceCard';
import { MatchaProfile } from '../components/matcha/MatchaProfile';
import { deriveMatchaProfile } from '../lib/matcha/profile';

// Truth-contract strings that must never appear in MATCHA copy.
const BANNED = [
  'automatically verified',
  'guaranteed verification',
  'legally accepted',
  'risk transferred',
  'HIPAA compliant',
];

function expectNoBanned(markup: string) {
  const lower = markup.toLowerCase();
  for (const phrase of BANNED) {
    expect(lower).not.toContain(phrase.toLowerCase());
  }
}

describe('MatchaExplanation', () => {
  it('renders given reasons with the canonical heading', () => {
    const markup = renderToStaticMarkup(
      <MatchaExplanation
        reasons={[
          { label: 'You prefer teaching hospitals', positive: true, source: 'your preferences' },
          { label: 'Compensation is below your minimum', positive: false },
        ]}
      />,
    );
    expect(markup).toContain('Recommended because');
    expect(markup).toContain('You prefer teaching hospitals');
    expect(markup).toContain('Compensation is below your minimum');
    expectNoBanned(markup);
  });

  it('shows an honest empty state instead of inventing reasons', () => {
    const markup = renderToStaticMarkup(<MatchaExplanation reasons={[]} />);
    // Assert the honest claim, not one spelling of the contraction: the empty
    // state must say it lacks the information, never invent a reason.
    expect(markup.toLowerCase()).toMatch(/do(?:es)?n[’']t have enough/);
    expect(markup).toContain('enough of your preferences');
  });
});

describe('OpportunityIntelligenceCard', () => {
  const opportunity = {
    id: 'opp-1',
    title: 'Cardiologist',
    organization: 'Bay Area Cardiac',
    location: 'San Jose, CA',
    specialty: 'Cardiology',
    payRange: '$300k–$360k',
  };

  it('renders the engine band, fit score, and an honesty footer', () => {
    const markup = renderToStaticMarkup(
      <OpportunityIntelligenceCard
        opportunity={opportunity}
        explanation={{
          matchBand: 'CLEAR',
          matchScore: 88,
          confidence: 0.9,
          fitReasons: [{ label: 'State license on file', positive: true, dimension: 'license' }],
          missingCredentials: [],
          blockers: [],
          instantOfferEligible: false,
        }}
        preferenceReasons={[{ label: 'In CA, one of your preferred locations', positive: true }]}
      />,
    );
    expect(markup).toContain('Cleared to apply');
    expect(markup).toContain('88');
    expect(markup).toContain('State license on file');
    expect(markup).toContain('In CA, one of your preferred locations');
    // Honesty: does not claim to estimate interview outcomes.
    expect(markup).toContain('does not estimate interview outcomes');
    expectNoBanned(markup);
  });

  it('degrades honestly when the engine explanation is absent', () => {
    const markup = renderToStaticMarkup(
      <OpportunityIntelligenceCard
        opportunity={opportunity}
        preferenceReasons={[{ label: 'Cardiology matches your specialty focus', positive: true }]}
      />,
    );
    expect(markup).toContain('Live fit scoring is unavailable');
    expect(markup).toContain('Cardiology matches your specialty focus');
    // No fabricated band when there is no engine output.
    expect(markup).not.toContain('Cleared to apply');
  });
});

describe('MatchaProfile', () => {
  it('renders every insight with its provenance trail', () => {
    const derived = deriveMatchaProfile({
      currentSpecialties: ['Cardiology'],
      preferredStates: ['CA'],
      teachingInterest: 'passionate',
    });
    const markup = renderToStaticMarkup(<MatchaProfile derived={derived} clinicianName="Sarah" />);
    expect(markup).toContain('What we know about you');
    expect(markup).toContain('because you told us');
    expect(markup).toContain('Cardiology');
    expectNoBanned(markup);
  });

  it('shows a learning-ready empty state with no invented insights', () => {
    const markup = renderToStaticMarkup(<MatchaProfile derived={deriveMatchaProfile({})} />);
    expect(markup.toLowerCase()).toContain('ready to learn about you');
    expect(markup).not.toContain('because you told us');
  });
});
