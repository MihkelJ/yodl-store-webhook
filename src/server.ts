import 'dotenv/config';
import { createConfig, createServer, Routing } from 'express-zod-api';
import { healthEndpoint } from './routes/health.routes.js';
import { txWebhook } from './routes/txWebhook.routes.js';

const config = createConfig({
  http: {
    listen: process.env.PORT || 3000,
  },
  cors: false,
  logger: {
    level: 'debug',
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

const server = createServer(config, routing);

server.catch((err) => {
  console.error('Server error:', err);
  process.exit(1);
});
