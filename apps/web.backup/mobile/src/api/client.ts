import * as Keychain from 'react-native-keychain';

// Configuration
// In a real app, use react-native-config
const API_BASE_URL = 'https://api.vitalcv.com';

export interface ApiClient {
  login: (username: string, password: string) => Promise<void>;
  fetchCredentials: () => Promise<any[]>;
  scanQR: (data: string) => Promise<void>;
  notifications: () => Promise<any[]>;
}

/**
 * Login user and store auth token in secure keychain
 */
export const login = async (username: string, password: string): Promise<void> => {
  try {
    // TODO: Replace with actual API call
    console.log('Logging in...', username);

    // Mock token for now
    const mockToken = 'mock.jwt.token';

    // Store token securely
    await Keychain.setGenericPassword(username, mockToken, { service: 'auth_token' });
    console.log('Auth token stored securely');
  } catch (error) {
    console.error('Login failed', error);
    throw error;
  }
};

/**
 * Fetch Verifiable Credentials using stored auth token
 */
export const fetchCredentials = async (): Promise<any[]> => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: 'auth_token' });
    if (!credentials) {
      throw new Error('No auth token found');
    }

    const token = credentials.password;

    // TODO: Replace with actual API call
    // const response = await fetch(`${API_BASE_URL}/credentials`, {
    //   headers: { Authorization: `Bearer ${token}` }
    // });
    // return await response.json();

    return []; // Mock empty list
  } catch (error) {
    console.error('Failed to fetch credentials', error);
    throw error;
  }
};

/**
 * Process scanned QR code data
 */
export const scanQR = async (data: string): Promise<void> => {
  console.log('Processing QR code:', data);
  // TODO: Parse QR code and handle actions (e.g., connection request, credential offer)
};

/**
 * Fetch user notifications
 */
export const notifications = async (): Promise<any[]> => {
  try {
    // TODO: Auth check and API call
    return [];
  } catch (error) {
    console.error('Failed to fetch notifications', error);
    return [];
  }
};

/**
 * Securely store encryption passphrase for mobile vault
 */
export const storeVaultPassphrase = async (passphrase: string): Promise<void> => {
  await Keychain.setInternetCredentials('mobile_vault', 'user', passphrase);
};

/**
 * Retrieve mobile vault passphrase
 */
export const getVaultPassphrase = async (): Promise<string | null> => {
  const credentials = await Keychain.getInternetCredentials('mobile_vault');
  return credentials ? credentials.password : null;
};














