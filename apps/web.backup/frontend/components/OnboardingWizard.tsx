import React, { useState, useEffect } from 'react';

interface Step {
  title: string;
  content: string;
}

interface LinkedinProfile {
  id?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  profileUrl?: string;
}

// Simplified onboarding wizard with contextual GPT hints
const steps: Step[] = [
  {
    title: 'Welcome',
    content: 'Welcome to the Chai VC Platform. This wizard will help you get started.'
  },
  {
    title: 'API Key',
    content: 'Generate and store your API key. Keep it safe!'
  },
  {
    title: 'LinkedIn Connection',
    content: 'Connect your LinkedIn profile to verify your professional credentials.'
  },
  {
    title: 'Complete',
    content: 'You\'re all set. Enjoy using the platform.'
  }
];

function getGptHint(stepIndex: number): string {
  const hints = [
    'Ask GPT for an overview of platform features.',
    'GPT can help you understand how to use your API key securely.',
    'GPT can explain how LinkedIn OAuth enhances credential verification.',
    'Need more help? GPT can answer further questions.'
  ];
  return hints[stepIndex] || '';
}

export const OnboardingWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('apiKey') || '';
    }
    return '';
  });
  const [linkedinProfile, setLinkedinProfile] = useState<LinkedinProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('linkedinProfile');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  });

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('apiKey', apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    if (linkedinProfile) {
      localStorage.setItem('linkedinProfile', JSON.stringify(linkedinProfile));
    }
  }, [linkedinProfile]);

  const generateKey = () => {
    const key = Math.random().toString(36).substring(2, 15);
    setApiKey(key);
  };

  // LinkedIn OAuth stub - for pilot only, no actual client secret in repo
  const handleLinkedInConnect = async () => {
    try {
      // Stub OAuth flow - in production, this would redirect to LinkedIn OAuth
      // For pilot: simulate successful connection with mock data
      const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'pilot_client_id_stub';
      
      // Simulate OAuth callback with mock profile data
      const mockProfile: LinkedinProfile = {
        id: `li_${Date.now()}`,
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Healthcare Professional',
        profileUrl: 'https://www.linkedin.com/in/johndoe',
      };

      // In real implementation, this would be:
      // 1. Redirect to LinkedIn OAuth authorization URL
      // 2. Receive callback with authorization code
      // 3. Exchange code for access token (server-side)
      // 4. Fetch profile using access token
      // 5. Store profile metadata in claim session

      // Save to claim session (localStorage for pilot)
      setLinkedinProfile(mockProfile);
      
      // In production, also send to backend to store in claim session
      // await fetch('/api/claim/session', {
      //   method: 'POST',
      //   body: JSON.stringify({ provider: 'linkedin', metadata: mockProfile }),
      // });

      console.log('LinkedIn OAuth stub: Profile connected', mockProfile);
    } catch (error) {
      console.error('Error connecting LinkedIn:', error);
    }
  };

  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const step = steps[currentStep];
  const gptHint = getGptHint(currentStep);

  return (
    <div>
      <h2>{step.title}</h2>
      <p>{step.content}</p>
      {currentStep === 1 && (
        <div>
          <button onClick={generateKey}>Generate Key</button>
          {apiKey && <p>Your key: {apiKey}</p>}
        </div>
      )}
      {currentStep === 2 && (
        <div>
          {!linkedinProfile ? (
            <button 
              onClick={handleLinkedInConnect}
              style={{
                backgroundColor: '#0077b5',
                color: 'white',
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Connect LinkedIn
            </button>
          ) : (
            <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <p>✓ Connected as: {linkedinProfile.firstName} {linkedinProfile.lastName}</p>
              <p style={{ fontSize: '14px', color: '#666' }}>{linkedinProfile.headline}</p>
            </div>
          )}
        </div>
      )}
      <p style={{ fontStyle: 'italic' }}>Hint: {gptHint}</p>
      <div>
        {currentStep > 0 && <button onClick={prevStep}>Back</button>}
        {currentStep < steps.length - 1 && (
          <button onClick={nextStep}>Next</button>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
