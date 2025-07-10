import 'dotenv/config';
import { createConfig, createServer, Routing } from 'express-zod-api';
import { config as appConfig } from './config/index.js';
import { healthEndpoint } from './routes/health.routes.js';
import { txWebhook } from './routes/txWebhook.routes.js';
import { QueueManagerService } from './services/queue-manager.service.js';

const config = createConfig({
  http: {
    listen: appConfig.server.port,
  },
  cors: false,
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
  },
};

// Initialize queue system and start server
async function startServer() {
  try {
    // Initialize queue manager
    const queueManager = QueueManagerService.getInstance();
    await queueManager.init();

    // Create and start the server
    const server = await createServer(config, routing);

    server.logger.info('Server configuration:', {
      yodl: appConfig.yodl,
      redis: {
        url: appConfig.redis.url,
      },
      beerTaps: appConfig.beerTaps.map((tap, index) => ({
        id: tap.id || `beer-tap-${index}`,
        transactionReceiverEns: tap.transactionReceiverEns,
        transactionMemo: tap.transactionMemo,
        transactionCurrency: tap.transactionCurrency,
        transactionAmount: tap.transactionAmount,
        thingsBoardDeviceToken: tap.thingsBoardDeviceToken?.substring(0, 8) + '...',
        thingsBoardCupSize: tap.thingsBoardCupSize,
        thingsBoardServerUrl: tap.thingsBoardServerUrl,
      })),
    });

    server.logger.info('Queue system initialized successfully');

    // Setup graceful shutdown
    process.on('SIGTERM', async () => {
      server.logger.info('SIGTERM received, shutting down gracefully');
      await queueManager.destroy();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      server.logger.info('SIGINT received, shutting down gracefully');
      await queueManager.destroy();
      process.exit(0);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error('Server startup error:', err);
  process.exit(1);
});
