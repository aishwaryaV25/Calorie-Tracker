import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const app = createApp();
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`API listening on port ${config.port} (${config.nodeEnv})`);
  console.log(`Database ${config.databaseLabel}`);
  if (
    config.isProduction &&
    config.corsOrigins.every((origin) => origin === 'http://localhost:3000')
  ) {
    console.warn('CORS_ORIGIN is still localhost. Set it to the Vercel URL after the web app is live.');
  }
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down.`);

  server.close(async (error) => {
    if (error) {
      console.error('Error while closing the server:', error);
    }
    await prisma.$disconnect();
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
