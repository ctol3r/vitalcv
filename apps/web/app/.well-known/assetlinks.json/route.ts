/**
 * Android Digital Asset Links — serves the manifest required for
 * Android App Links and Instant Apps.
 *
 * Android fetches this from /.well-known/assetlinks.json.
 * The response must be an array of statement objects.
 *
 * @see https://developer.android.com/training/app-links/verify-android-applinks
 * @see https://developers.google.com/digital-asset-links/v1/getting-started
 */

const ANDROID_PACKAGE_NAME =
  process.env.ANDROID_PACKAGE_NAME ?? 'com.vitalcv.app';
const ANDROID_SHA256_FINGERPRINT =
  process.env.ANDROID_SHA256_FINGERPRINT ??
  '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';

export async function GET() {
  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: [ANDROID_SHA256_FINGERPRINT],
      },
    },
  ];

  return Response.json(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
