export function getVersion() {
  return {
    branch: process.env.GIT_BRANCH || 'unknown',
    sha: process.env.GIT_SHA || 'unknown',
    ts: Date.now()
  };
}

