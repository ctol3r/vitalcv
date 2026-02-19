import app from './app';
import { log } from './obs/logger';

export default app;

export async function startServer() {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    log('info', 'Server ready', {
      event: 'server_ready',
      url: `http://localhost:${port}`,
    });
  });
}

if (require.main === module) {
  startServer();
}
