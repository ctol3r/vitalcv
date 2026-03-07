import { initializeTrustAlertsPersistence } from '../alerts/trustAlerts';
import { initializeOnboardingFlowsPersistence } from '../missionOps/onboardingFlows';
import { initializeTrustRegistryPersistence } from '../registry/trustRegistry';

let initializationPromise: Promise<void> | null = null;

export async function initializeWave126Persistence(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = Promise.all([
    initializeTrustRegistryPersistence(),
    initializeTrustAlertsPersistence(),
    initializeOnboardingFlowsPersistence(),
  ]).then(() => undefined).catch((error) => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}
