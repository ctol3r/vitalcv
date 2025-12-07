/**
 * B241C-I18N-027: LocaleSpecificOnboarding UI
 *
 * Localised onboarding flows: delivers content and steps based on selected locale;
 * ensures right-to-left languages are displayed correctly; dynamic forms with translated labels
 */

'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';
import { useLocalisedValidation, LocalisedErrorMessages } from '@/components/i18n/LocalisedErrorMessages';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { type Locale } from '@/i18n';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  fields?: OnboardingField[];
  component?: React.ReactNode;
}

interface OnboardingField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select' | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: any;
}

export default function LocaleSpecificOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params.locale as Locale) || 'en-US';
  const { t, changeLocale } = useTranslation();
  const { validate } = useLocalisedValidation();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, any>>({});
  const [isRTL, setIsRTL] = useState(false);

  // Set locale and RTL direction
  useEffect(() => {
    changeLocale(locale);
    // RTL languages
    const rtlLocales = ['ar', 'he', 'fa', 'ur'];
    const isRTL = rtlLocales.some((rtl) => locale.startsWith(rtl));
    setIsRTL(isRTL);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale, changeLocale]);

  // Define onboarding steps (would be loaded from i18n in production)
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: t('onboarding.welcome.title', 'Welcome'),
      description: t('onboarding.welcome.description', 'Let\'s get you started'),
    },
    {
      id: 'profile',
      title: t('onboarding.profile.title', 'Your Profile'),
      description: t('onboarding.profile.description', 'Tell us about yourself'),
      fields: [
        {
          name: 'name',
          label: t('onboarding.profile.name', 'Full Name'),
          type: 'text',
          required: true,
          validation: { required: true, minLength: 2 },
        },
        {
          name: 'email',
          label: t('onboarding.profile.email', 'Email Address'),
          type: 'email',
          required: true,
          validation: { required: true, email: true },
        },
      ],
    },
    {
      id: 'preferences',
      title: t('onboarding.preferences.title', 'Preferences'),
      description: t('onboarding.preferences.description', 'Customize your experience'),
      fields: [
        {
          name: 'language',
          label: t('onboarding.preferences.language', 'Preferred Language'),
          type: 'select',
          required: true,
          options: [
            { value: 'en-US', label: 'English' },
            { value: 'es-ES', label: 'Español' },
            { value: 'fr-FR', label: 'Français' },
          ],
        },
        {
          name: 'notifications',
          label: t('onboarding.preferences.notifications', 'Enable Notifications'),
          type: 'checkbox',
        },
      ],
    },
    {
      id: 'complete',
      title: t('onboarding.complete.title', 'All Set!'),
      description: t('onboarding.complete.description', 'You\'re ready to get started'),
    },
  ];

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Validate current step
  const validateStep = (): boolean => {
    if (!currentStepData.fields) return true;

    const stepErrors: Record<string, any> = {};
    let isValid = true;

    currentStepData.fields.forEach((field) => {
      const value = formData[field.name];
      const fieldValidate = validate(field.validation || { required: field.required });

      if (fieldValidate) {
        const error = fieldValidate(value);
        if (error) {
          stepErrors[field.name] = error;
          isValid = false;
        }
      }
    });

    setErrors(stepErrors);
    return isValid;
  };

  // Handle next step
  const handleNext = () => {
    if (validateStep()) {
      if (isLastStep) {
        // Complete onboarding
        handleComplete();
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  // Handle form field change
  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Complete onboarding
  const handleComplete = () => {
    // Save onboarding data
    console.log('Onboarding complete:', formData);
    // Redirect to dashboard or next page
    router.push('/demo');
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const ArrowIconPrev = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className={cn('min-h-screen flex items-center justify-center p-4', isRTL && 'rtl')}>
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center',
                  index < steps.length - 1 && 'flex-1'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2',
                    index <= currentStep
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted text-muted-foreground'
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-1 mx-2',
                      index < currentStep ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="bg-card border rounded-lg p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">{currentStepData.title}</h1>
            <p className="text-muted-foreground">{currentStepData.description}</p>
          </div>

          {/* Form fields */}
          {currentStepData.fields && (
            <div className="space-y-4">
              {currentStepData.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === 'text' || field.type === 'email' || field.type === 'password' ? (
                    <Input
                      id={field.name}
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className={errors[field.name] ? 'border-destructive' : ''}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">{t('common.select', 'Select...')}</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={field.name}
                        checked={formData[field.name] || false}
                        onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                  ) : null}
                  {errors[field.name] && (
                    <LocalisedErrorMessages errors={errors[field.name]} variant="destructive" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className={cn('flex items-center justify-between pt-4', isRTL && 'flex-row-reverse')}>
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep}
            >
              <ArrowIconPrev className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              {t('common.back', 'Back')}
            </Button>
            <Button onClick={handleNext}>
              {isLastStep ? t('common.finish', 'Finish') : t('common.next', 'Next')}
              <ArrowIcon className={cn('h-4 w-4', isRTL ? 'mr-2' : 'ml-2')} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

