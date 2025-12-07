/**
 * DeviceCapabilityService
 *
 * Detects capabilities of the device:
 * - OS, screen size, camera availability, biometrics support
 * - Exposes API for components to adapt functionality
 * - Includes tests for different mock devices
 */

export interface DeviceCapabilities {
  os: {
    name: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
    version: string;
  };
  screen: {
    width: number;
    height: number;
    pixelRatio: number;
    orientation: 'portrait' | 'landscape';
  };
  camera: {
    available: boolean;
    frontFacing: boolean;
    rearFacing: boolean;
  };
  biometrics: {
    available: boolean;
    types: Array<'fingerprint' | 'face' | 'iris' | 'voice'>;
  };
  network: {
    online: boolean;
    type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
    effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  };
  storage: {
    available: number; // bytes
    quota: number; // bytes
    usage: number; // bytes
  };
  features: {
    geolocation: boolean;
    notifications: boolean;
    serviceWorker: boolean;
    indexedDB: boolean;
    webGL: boolean;
  };
}

/**
 * Device capability detection service
 */
export class DeviceCapabilityService {
  private cachedCapabilities: DeviceCapabilities | null = null;

  /**
   * Get all device capabilities
   */
  async getCapabilities(): Promise<DeviceCapabilities> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    this.cachedCapabilities = await this.detectCapabilities();
    return this.cachedCapabilities;
  }

  /**
   * Refresh capabilities (useful when device state changes)
   */
  async refreshCapabilities(): Promise<DeviceCapabilities> {
    this.cachedCapabilities = null;
    return this.getCapabilities();
  }

  /**
   * Detect all device capabilities
   */
  private async detectCapabilities(): Promise<DeviceCapabilities> {
    const os = this.detectOS();
    const screen = await this.detectScreen();
    const camera = await this.detectCamera();
    const biometrics = await this.detectBiometrics();
    const network = await this.detectNetwork();
    const storage = await this.detectStorage();
    const features = this.detectFeatures();

    return {
      os,
      screen,
      camera,
      biometrics,
      network,
      storage,
      features,
    };
  }

  /**
   * Detect operating system
   */
  private detectOS(): DeviceCapabilities['os'] {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      // Node.js environment
      const platform = process.platform;
      const version = process.version;

      const osMap: Record<string, DeviceCapabilities['os']['name']> = {
        darwin: 'macos',
        win32: 'windows',
        linux: 'linux',
      };

      return {
        name: osMap[platform] || 'unknown',
        version,
      };
    }

    const userAgent = navigator.userAgent.toLowerCase();
    let name: DeviceCapabilities['os']['name'] = 'unknown';
    let version = '';

    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      name = 'ios';
      const match = userAgent.match(/os (\d+[._]\d+)/);
      version = match ? match[1].replace('_', '.') : '';
    } else if (userAgent.includes('android')) {
      name = 'android';
      const match = userAgent.match(/android (\d+\.\d+)/);
      version = match ? match[1] : '';
    } else if (userAgent.includes('win')) {
      name = 'windows';
      const match = userAgent.match(/windows nt (\d+\.\d+)/);
      version = match ? match[1] : '';
    } else if (userAgent.includes('mac')) {
      name = 'macos';
      const match = userAgent.match(/mac os x (\d+[._]\d+)/);
      version = match ? match[1].replace('_', '.') : '';
    } else if (userAgent.includes('linux')) {
      name = 'linux';
    }

    return { name, version };
  }

  /**
   * Detect screen capabilities
   */
  private async detectScreen(): Promise<DeviceCapabilities['screen']> {
    if (typeof window === 'undefined' || typeof screen === 'undefined') {
      return {
        width: 1920,
        height: 1080,
        pixelRatio: 1,
        orientation: 'landscape',
      };
    }

    const width = screen.width || window.innerWidth;
    const height = screen.height || window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    let orientation: 'portrait' | 'landscape' = 'portrait';
    if (typeof screen.orientation !== 'undefined') {
      orientation = screen.orientation.angle === 90 || screen.orientation.angle === 270
        ? 'landscape'
        : 'portrait';
    } else {
      orientation = width > height ? 'landscape' : 'portrait';
    }

    return {
      width,
      height,
      pixelRatio,
      orientation,
    };
  }

  /**
   * Detect camera availability
   */
  private async detectCamera(): Promise<DeviceCapabilities['camera']> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return {
        available: false,
        frontFacing: false,
        rearFacing: false,
      };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');

      const hasFrontFacing = videoDevices.some((device) =>
        device.label.toLowerCase().includes('front') ||
        device.label.toLowerCase().includes('facing'),
      );

      return {
        available: videoDevices.length > 0,
        frontFacing: hasFrontFacing,
        rearFacing: videoDevices.length > (hasFrontFacing ? 1 : 0),
      };
    } catch {
      return {
        available: false,
        frontFacing: false,
        rearFacing: false,
      };
    }
  }

  /**
   * Detect biometric capabilities
   */
  private async detectBiometrics(): Promise<DeviceCapabilities['biometrics']> {
    if (typeof window === 'undefined') {
      return {
        available: false,
        types: [],
      };
    }

    const types: Array<'fingerprint' | 'face' | 'iris' | 'voice'> = [];

    // Check for WebAuthn (supports biometrics)
    if (typeof window.PublicKeyCredential !== 'undefined') {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          // Can't determine specific type via WebAuthn API
          // Assume fingerprint or face based on OS
          const os = this.detectOS();
          if (os.name === 'ios') {
            types.push('face'); // Face ID
          } else {
            types.push('fingerprint'); // Touch ID or Android fingerprint
          }
        }
      } catch {
        // WebAuthn not available
      }
    }

    return {
      available: types.length > 0,
      types,
    };
  }

  /**
   * Detect network capabilities
   */
  private async detectNetwork(): Promise<DeviceCapabilities['network']> {
    if (typeof navigator === 'undefined') {
      return {
        online: true,
        type: 'unknown',
      };
    }

    const online = navigator.onLine;
    let type: 'wifi' | 'cellular' | 'ethernet' | 'unknown' = 'unknown';
    let effectiveType: '2g' | '3g' | '4g' | 'slow-2g' | undefined;

    // Check Connection API (if available)
    const connection = (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      type = connection.type || 'unknown';
      effectiveType = connection.effectiveType;
    }

    return {
      online,
      type,
      effectiveType,
    };
  }

  /**
   * Detect storage capabilities
   */
  private async detectStorage(): Promise<DeviceCapabilities['storage']> {
    if (typeof navigator === 'undefined' || !('storage' in navigator)) {
      return {
        available: 0,
        quota: 0,
        usage: 0,
      };
    }

    try {
      if ('estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          available: (estimate.quota || 0) - (estimate.usage || 0),
          quota: estimate.quota || 0,
          usage: estimate.usage || 0,
        };
      }
    } catch {
      // Storage API not available
    }

    return {
      available: 0,
      quota: 0,
      usage: 0,
    };
  }

  /**
   * Detect browser features
   */
  private detectFeatures(): DeviceCapabilities['features'] {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        geolocation: false,
        notifications: false,
        serviceWorker: false,
        indexedDB: false,
        webGL: false,
      };
    }

    return {
      geolocation: 'geolocation' in navigator,
      notifications: 'Notification' in window,
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window,
      webGL: !!(
        document.createElement('canvas').getContext('webgl') ||
        document.createElement('canvas').getContext('experimental-webgl')
      ),
    };
  }

  /**
   * Check if a specific capability is available
   */
  async hasCapability(
    capability: keyof DeviceCapabilities,
  ): Promise<boolean> {
    const caps = await this.getCapabilities();

    switch (capability) {
      case 'camera':
        return caps.camera.available;
      case 'biometrics':
        return caps.biometrics.available;
      case 'network':
        return caps.network.online;
      default:
        return true;
    }
  }

  /**
   * Get device type classification
   */
  async getDeviceType(): Promise<'mobile' | 'tablet' | 'desktop'> {
    const caps = await this.getCapabilities();
    const { width, height } = caps.screen;
    const maxDimension = Math.max(width, height);

    if (maxDimension < 768) {
      return 'mobile';
    } else if (maxDimension < 1024) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }
}

export const deviceCapabilityService = new DeviceCapabilityService();

