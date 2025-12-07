import React, { useState, useEffect } from 'react';

interface Step {
  title: string;
  content: string;
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
    title: 'Complete',
    content: 'You\'re all set. Enjoy using the platform.'
  }
];

function getGptHint(stepIndex: number): string {
  const hints = [
    'Ask GPT for an overview of platform features.',
    'GPT can help you understand how to use your API key securely.',
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

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('apiKey', apiKey);
    }
  }, [apiKey]);

  const generateKey = () => {
    const key = Math.random().toString(36).substring(2, 15);
    setApiKey(key);
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
