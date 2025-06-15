import 'dotenv/config';
import { createConfig, createServer, Routing } from 'express-zod-api';
import { config as appConfig } from './config/index.js';
import { healthEndpoint } from './routes/health.routes.js';
import { txWebhook } from './routes/txWebhook.routes.js';

const config = createConfig({
  http: {
    listen: appConfig.port,
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

const server = createServer(config, routing).then((server) => {
  server.logger.info('Server configuration:', {
    yodl: appConfig.yodl,
    beerTaps: appConfig.beerTaps.map((tap) => ({
      transactionReceiverEns: tap.transactionReceiverEns,
      transactionMemo: tap.transactionMemo,
      transactionCurrency: tap.transactionCurrency,
      transactionAmount: tap.transactionAmount,
      blynkServer: tap.blynkServer,
    })),
  });
});

server.catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});
