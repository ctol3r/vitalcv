import app from './app';
import { startErasureScheduler } from './queues/erasureScheduler';

async function main() {
  const port = process.env.PORT || 4000;
  startErasureScheduler();
  app.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
