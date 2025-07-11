import 'dotenv/config';
import { createConfig, createServer, Routing } from 'express-zod-api';
import { config as appConfig } from './config/index.js';
import { healthEndpoint } from './routes/health.routes.js';
import { txWebhook } from './routes/txWebhook.routes.js';
import { beerTapsEndpoint } from './routes/beerTaps.routes.js';
import { statusEndpoint } from './routes/status.js';
import { QueueManagerService } from './services/queue/queue-manager.service.js';

const config = createConfig({
  http: {
    listen: appConfig.server.port,
  },
  cors: true,
  logger: {
    level: 'info',
    color: true,
  },
  startupLogo: false,
});

const routing: Routing = {
  v1: {
    health: healthEndpoint,
    callback: txWebhook,
    'beer-taps': beerTapsEndpoint,
    status: {
      ':txHash': statusEndpoint,
    },
  },
};

// Initialize queue system and start server
async function startServer() {
  try {
    const queueManager = QueueManagerService.getInstance();
    await queueManager.init();

    const server = await createServer(config, routing);

    process.on('SIGTERM', async () => {
      await queueManager.destroy();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      await queueManager.destroy();
      process.exit(0);
    });

    return server;
  } catch {
    process.exit(1);
  }
}

startServer().catch(() => {
  process.exit(1);
});
