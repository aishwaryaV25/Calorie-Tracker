import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

/** Finish in-flight requests and release the database pool before exiting. */
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
