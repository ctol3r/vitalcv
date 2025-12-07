export interface DeviceFingerprint {
  userAgent: string;
  platform: string;
  timezone: string;
  canvasHash: string;
  webglHash: string;
}

export async function getDeviceFingerprint(): Promise<DeviceFingerprint | null> {
  if (typeof window === 'undefined') return null;

  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const canvasHash = await getCanvasHash();
  const webglHash = await getWebGLHash();

  return {
    userAgent,
    platform,
    timezone,
    canvasHash,
    webglHash,
  };
}

async function getCanvasHash(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("VitalCV Fingerprint", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("VitalCV Fingerprint", 4, 17);

    const dataUrl = canvas.toDataURL();
    return sha256(dataUrl);
  } catch (e) {
    return '';
  }
}

async function getWebGLHash(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';

    // We need to cast to any or specific WebGL type to access debug info constants if strict types are on
    const extension = (gl as any).getExtension('WEBGL_debug_renderer_info');
    if (!extension) return '';

    const vendor = (gl as any).getParameter(extension.UNMASKED_VENDOR_WEBGL);
    const renderer = (gl as any).getParameter(extension.UNMASKED_RENDERER_WEBGL);

    return sha256(vendor + renderer);
  } catch (e) {
    return '';
  }
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

