import { Router } from 'express';
import crypto from 'crypto';

export const linkedinRouter = Router();

/**
 * LinkedIn OAuth 2.0 flow
 * Scopes: r_liteprofile, r_emailaddress
 * MUST use state param and HTTPS in production
 */

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:4000/auth/linkedin/callback';

/**
 * GET /auth/linkedin
 * Initiates OAuth flow
 */
linkedinRouter.get('/linkedin', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in session (in production use Redis/encrypted cookie)
  (req as any).session = { ...((req as any).session || {}), linkedinState: state };

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
    `response_type=code&` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `state=${state}&` +
    `scope=r_liteprofile%20r_emailaddress`;

  res.redirect(authUrl);
});

/**
 * GET /auth/linkedin/callback
 * OAuth callback handler
 */
linkedinRouter.get('/linkedin/callback', async (req, res) => {
  const { code, state } = req.query;

  // Validate state
  const sessionState = (req as any).session?.linkedinState;
  if (!state || state !== sessionState) {
    return res.status(400).send('Invalid state parameter');
  }

  if (!code) {
    return res.status(400).send('No authorization code received');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('Failed to obtain access token');
    }

    // TODO: Store tokens securely (HttpOnly, Secure cookies or server-side session)
    // TODO: Fetch profile data and hydrate user record

    // Stub response
    res.send(`
      <html>
        <body>
          <h2>LinkedIn Connected!</h2>
          <p>Access token received (length: ${tokenData.access_token.length})</p>
          <p>Redirect to profile page...</p>
          <script>
            setTimeout(() => {
              window.location.href = '/profile';
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('LinkedIn OAuth error:', err);
    res.status(500).send('OAuth failed: ' + err.message);
  }
});

