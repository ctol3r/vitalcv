import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { localCredentialStore } from '../src/services/LocalCredentialStore';
import { walletTheme } from '../src/theme';

type OnboardingStep = 'welcome' | 'npi' | 'biometrics' | 'success';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [npi, setNpi] = useState('');
  const [npiError, setNpiError] = useState<string | null>(null);
  const [biometricOptIn, setBiometricOptIn] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authResult, setAuthResult] = useState<'success' | 'skipped' | null>(null);

  useEffect(() => {
    void (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
    })();
  }, []);

  const validateNpi = (value: string): boolean => {
    if (!value) {
      setNpiError('NPI is required');
      return false;
    }
    if (!/^\d{10}$/.test(value)) {
      setNpiError('NPI must be exactly 10 digits');
      return false;
    }
    setNpiError(null);
    return true;
  };

  const handleNpiSubmit = (): void => {
    if (validateNpi(npi)) {
      if (biometricAvailable && biometricOptIn) {
        setStep('biometrics');
      } else {
        completeOnboarding();
      }
    }
  };

  const handleBiometricSetup = async (): Promise<void> => {
    setIsAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric authentication',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Skip',
      });

      setAuthResult(result.success ? 'success' : 'skipped');
    } catch {
      setAuthResult('skipped');
    } finally {
      setIsAuthenticating(false);
      await completeOnboarding();
    }
  };

  const skipBiometrics = async (): Promise<void> => {
    setAuthResult('skipped');
    await completeOnboarding();
  };

  const completeOnboarding = async (): Promise<void> => {
    try {
      await localCredentialStore.setStoredNpi(npi.trim());
      await localCredentialStore.getOrCreateKeyPair();
      setStep('success');
    } catch (error) {
      setNpiError(error instanceof Error ? error.message : 'Failed to save NPI');
    }
  };

  const finishOnboarding = (): void => {
    router.replace('/(tabs)/wallet');
  };

  const renderWelcome = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconEmoji}>🏥</Text>
      </View>
      <Text style={styles.stepTitle}>Welcome to VitalCV</Text>
      <Text style={styles.stepDescription}>
        Securely store and present your healthcare credentials. Your medical credentials are
        encrypted on your device and never shared without your consent.
      </Text>
      <View style={styles.featureList}>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🔒</Text>
          <Text style={styles.featureText}>Encrypted local storage</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>🔐</Text>
          <Text style={styles.featureText}>Biometric authentication</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureIcon}>📱</Text>
          <Text style={styles.featureText}>Offline presentation</Text>
        </View>
      </View>
    </View>
  );

  const renderNpi = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Enter Your NPI</Text>
      <Text style={styles.stepDescription}>
        Your National Provider Identifier is a unique 10-digit number assigned to healthcare
        providers in the United States.
      </Text>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>NPI Number</Text>
        <TextInput
          value={npi}
          onChangeText={(text) => {
            const digitsOnly = text.replace(/\D/g, '').slice(0, 10);
            setNpi(digitsOnly);
            if (digitsOnly.length === 10) {
              validateNpi(digitsOnly);
            } else {
              setNpiError(null);
            }
          }}
          placeholder="1234567890"
          placeholderTextColor={walletTheme.textMuted}
          keyboardType="number-pad"
          maxLength={10}
          style={styles.input}
          autoFocus
        />
        {npiError ? <Text style={styles.errorText}>{npiError}</Text> : null}
      </View>
      <Text style={styles.hintText}>
        💡 You can find your NPI at{' '}
        <Text style={styles.linkText}>https://npiregistry.cms.hhs.gov</Text>
      </Text>
    </View>
  );

  const renderBiometrics = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconEmoji}>🔐</Text>
      </View>
      <Text style={styles.stepTitle}>Enable Biometrics</Text>
      <Text style={styles.stepDescription}>
        Protect your credentials with Face ID, Touch ID, or fingerprint authentication.
      </Text>
      <View style={styles.toggleContainer}>
        <Pressable
          style={[styles.toggleButton, biometricOptIn && styles.toggleButtonActive]}
          onPress={() => setBiometricOptIn(true)}
        >
          <Text style={[styles.toggleButtonText, biometricOptIn && styles.toggleButtonTextActive]}>
            Enable
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, !biometricOptIn && styles.toggleButtonActive]}
          onPress={() => setBiometricOptIn(false)}
        >
          <Text
            style={[styles.toggleButtonText, !biometricOptIn && styles.toggleButtonTextActive]}
          >
            Skip
          </Text>
        </Pressable>
      </View>
      {biometricOptIn ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            You'll be asked to authenticate with Face ID, Touch ID, or fingerprint whenever you
            present credentials.
          </Text>
        </View>
      ) : (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Without biometrics, you can still use the app, but your credentials won't have the
            additional layer of protection.
          </Text>
        </View>
      )}
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.stepContent}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconEmoji}>✅</Text>
      </View>
      <Text style={styles.stepTitle}>All Set!</Text>
      <Text style={styles.stepDescription}>
        Your wallet is now ready. You can sync credentials from the VitalCV API, add them manually,
        or receive them from issuers.
      </Text>
      {authResult === 'success' ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Biometric authentication enabled</Text>
        </View>
      ) : null}
      {authResult === 'skipped' ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Biometrics skipped. You can enable it later in Settings.
          </Text>
        </View>
      ) : null}
      <View style={styles.nextSteps}>
        <Text style={styles.nextStepsTitle}>Next Steps:</Text>
        <Text style={styles.nextStepsText}>• Pull down on Wallet to sync credentials</Text>
        <Text style={styles.nextStepsText}>• Add credentials manually</Text>
        <Text style={styles.nextStepsText}>• Present credentials offline</Text>
      </View>
    </View>
  );

  const canProceed = (): boolean => {
    switch (step) {
      case 'npi':
        return /^\d{10}$/.test(npi);
      case 'biometrics':
        return !isAuthenticating;
      default:
        return true;
    }
  };

  const handleNext = (): void => {
    switch (step) {
      case 'welcome':
        setStep('npi');
        break;
      case 'npi':
        handleNpiSubmit();
        break;
      case 'biometrics':
        if (biometricOptIn) {
          void handleBiometricSetup();
        } else {
          void skipBiometrics();
        }
        break;
      case 'success':
        finishOnboarding();
        break;
    }
  };

  const handleBack = (): void => {
    switch (step) {
      case 'npi':
        setStep('welcome');
        break;
      case 'biometrics':
        setStep('npi');
        break;
      case 'success':
        setStep('biometrics');
        break;
      default:
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.progressContainer}>
            {['welcome', 'npi', 'biometrics', 'success'].map((s, index) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  ['welcome', 'npi', 'biometrics', 'success'].indexOf(step) >= index &&
                    styles.progressDotActive,
                  step === s && styles.progressDotCurrent,
                ]}
              />
            ))}
          </View>

          {step === 'welcome' && renderWelcome()}
          {step === 'npi' && renderNpi()}
          {step === 'biometrics' && renderBiometrics()}
          {step === 'success' && renderSuccess()}
        </ScrollView>

        <View style={styles.footer}>
          {step !== 'welcome' && step !== 'success' && (
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>
              {isAuthenticating ? 'Authenticating...' : step === 'success' ? 'Get Started' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: walletTheme.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 32,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: walletTheme.panelMuted,
  },
  progressDotActive: {
    backgroundColor: walletTheme.accent,
  },
  progressDotCurrent: {
    width: 32,
    borderRadius: 6,
  },
  stepContent: {
    gap: 20,
  },
  iconContainer: {
    alignSelf: 'center',
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderRadius: 999,
    borderWidth: 2,
    padding: 24,
  },
  iconEmoji: {
    fontSize: 48,
  },
  stepTitle: {
    color: walletTheme.text,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  stepDescription: {
    color: walletTheme.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  featureList: {
    gap: 16,
    marginTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderRadius: 16,
    padding: 16,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    color: walletTheme.text,
    fontSize: 15,
    fontWeight: '600',
  },
  inputContainer: {
    gap: 8,
    marginTop: 12,
  },
  inputLabel: {
    color: walletTheme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: walletTheme.panelMuted,
    borderColor: walletTheme.border,
    borderRadius: 16,
    borderWidth: 2,
    color: walletTheme.text,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
    padding: 16,
    textAlign: 'center',
  },
  errorText: {
    color: walletTheme.danger,
    fontSize: 14,
  },
  hintText: {
    color: walletTheme.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  linkText: {
    color: walletTheme.accentStrong,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: walletTheme.panelMuted,
    borderColor: walletTheme.border,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 14,
  },
  toggleButtonActive: {
    backgroundColor: walletTheme.accentStrong,
    borderColor: walletTheme.accentStrong,
  },
  toggleButtonText: {
    color: walletTheme.textMuted,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  toggleButtonTextActive: {
    color: walletTheme.background,
  },
  infoBox: {
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  infoText: {
    color: walletTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  nextSteps: {
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
    marginTop: 12,
  },
  nextStepsTitle: {
    color: walletTheme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  nextStepsText: {
    color: walletTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: walletTheme.background,
  },
  backButton: {
    flex: 1,
    backgroundColor: walletTheme.panel,
    borderColor: walletTheme.border,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 16,
  },
  backButtonText: {
    color: walletTheme.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextButton: {
    flex: 2,
    backgroundColor: walletTheme.accentStrong,
    borderRadius: 16,
    paddingVertical: 16,
  },
  nextButtonDisabled: {
    backgroundColor: walletTheme.panelMuted,
  },
  nextButtonText: {
    color: walletTheme.background,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
