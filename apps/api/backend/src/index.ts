import app from './app';

export default app;

export async function startServer() {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}
