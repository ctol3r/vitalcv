/**
 * Apple App Site Association (AASA) — serves the manifest required for
 * iOS Universal Links and App Clips.
 *
 * Apple fetches this file from /.well-known/apple-app-site-association
 * and caches it for up to 24 hours. It must be served without a file
 * extension and with Content-Type: application/json.
 *
 * @see https://developer.apple.com/documentation/bundleresources/applinks
 * @see https://developer.apple.com/documentation/app_clips
 */

const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID ?? 'XXXXXXXXXX';
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? 'com.vitalcv.app';
const APPLE_CLIP_BUNDLE_ID = process.env.APPLE_CLIP_BUNDLE_ID ?? 'com.vitalcv.app.Clip';

export async function GET() {
  const appId = `${APPLE_TEAM_ID}.${APPLE_BUNDLE_ID}`;
  const clipId = `${APPLE_TEAM_ID}.${APPLE_CLIP_BUNDLE_ID}`;

  const body = {
    applinks: {
      details: [
        {
          appIDs: [appId, clipId],
          components: [
            {
              '/': '/verify/*',
              comment: 'NPI verification deep links',
            },
            {
              '/': '/clip/verify/*',
              comment: 'App Clip instant verification receipts',
            },
          ],
        },
      ],
    },
    appclips: {
      apps: [clipId],
    },
  };

  return Response.json(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
